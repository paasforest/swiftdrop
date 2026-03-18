const db = require('../database/connection');
const { haversineKm } = require('../utils/distanceHelper');
const { generateOTP } = require('../utils/otpHelper');
const { runMatching } = require('../services/matchingService');
const { releaseEscrow } = require('../services/paymentService');
const { sendPushNotification } = require('../services/notificationService');
const { uploadImage } = require('../services/cloudinaryService');

const PRICING = {
  standard: { base: 80, perKm: 0.8 },
  express: { base: 150, perKm: 1.2 },
  urgent: { base: 250, perKm: 1.8 },
};
const COMMISSION_RATE = 0.15;
const INSURANCE_RATE = 0.025;
const INSURANCE_MIN = 10;

function generateOrderNumber() {
  return 'SD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function createOrder(req, res) {
  try {
    const {
      pickup_address, pickup_lat, pickup_lng,
      dropoff_address, dropoff_lat, dropoff_lng,
      parcel_type, parcel_size, parcel_value, special_handling,
      delivery_tier, insurance_selected,
      payment_method = 'card',
    } = req.body;

    if (!pickup_address || pickup_lat == null || pickup_lng == null ||
        !dropoff_address || dropoff_lat == null || dropoff_lng == null ||
        !delivery_tier) {
      return res.status(400).json({ error: 'pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, delivery_tier are required' });
    }

    const tier = PRICING[delivery_tier];
    if (!tier) return res.status(400).json({ error: 'Invalid delivery_tier' });

    const dist = haversineKm(
      parseFloat(pickup_lat), parseFloat(pickup_lng),
      parseFloat(dropoff_lat), parseFloat(dropoff_lng)
    );
    const basePrice = tier.base + dist * tier.perKm;
    let insuranceFee = 0;
    if (insurance_selected && parcel_value > 0) {
      insuranceFee = Math.max(INSURANCE_MIN, parcel_value * INSURANCE_RATE);
    }
    const commission = basePrice * COMMISSION_RATE;
    const driverEarnings = basePrice - commission;
    const totalPrice = basePrice + insuranceFee;

    const pickupOtp = generateOTP();
    const deliveryOtp = generateOTP();
    const orderNumber = generateOrderNumber();
    const customerId = req.user.id;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query(
        `INSERT INTO orders (
          order_number, customer_id, pickup_address, pickup_lat, pickup_lng,
          dropoff_address, dropoff_lat, dropoff_lng, parcel_type, parcel_size, parcel_value,
          special_handling, delivery_tier, status, base_price, insurance_fee, total_price,
          commission_amount, driver_earnings, pickup_otp, delivery_otp
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15,$16,$17,$18,$19,$20)
        RETURNING *`,
        [
          orderNumber, customerId, pickup_address, pickup_lat, pickup_lng,
          dropoff_address, dropoff_lat, dropoff_lng, parcel_type || null, parcel_size || null,
          parcel_value || null, special_handling || null, delivery_tier,
          basePrice, insuranceFee, totalPrice, commission, driverEarnings, pickupOtp, deliveryOtp,
        ]
      );
      const order = orderRes.rows[0];

      await client.query(
        `INSERT INTO payments (order_id, amount, payment_method, escrow_status)
         VALUES ($1, $2, $3, 'held')`,
        [order.id, totalPrice, payment_method]
      );

      await client.query('COMMIT');

      if (payment_method === 'wallet') {
        const balRes = await db.query(`SELECT wallet_balance FROM users WHERE id = $1`, [customerId]);
        const balance = parseFloat(balRes.rows[0].wallet_balance) || 0;
        if (balance < totalPrice) {
          return res.status(400).json({ error: 'Insufficient wallet balance' });
        }
        await db.query(
          `UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2`,
          [totalPrice, customerId]
        );
        await db.query(
          `INSERT INTO wallet_transactions (user_id, type, amount, reference, description)
           VALUES ($1, 'debit', $2, $3, 'Order payment')`,
          [customerId, totalPrice, orderNumber]
        );
        await db.query(`UPDATE orders SET status = 'matching', updated_at = NOW() WHERE id = $1`, [order.id]);
        runMatching(order.id);
      }

      const out = {
        ...order,
        price_breakdown: {
          base_price: basePrice,
          insurance_fee: insuranceFee,
          commission: commission,
          driver_earnings: driverEarnings,
          total: totalPrice,
        },
      };
      return res.status(201).json(out);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('createOrder:', err);
    return res.status(500).json({ error: 'Order creation failed' });
  }
}

async function calculatePrice(req, res) {
  try {
    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, parcel_value, insurance_selected } = req.body;
    if (pickup_lat == null || pickup_lng == null || dropoff_lat == null || dropoff_lng == null) {
      return res.status(400).json({ error: 'pickup and dropoff coordinates required' });
    }
    const dist = haversineKm(
      parseFloat(pickup_lat), parseFloat(pickup_lng),
      parseFloat(dropoff_lat), parseFloat(dropoff_lng)
    );
    const estimates = {};
    for (const [tier, p] of Object.entries(PRICING)) {
      const base = p.base + dist * p.perKm;
      let ins = 0;
      if (insurance_selected && parcel_value > 0) {
        ins = Math.max(INSURANCE_MIN, parcel_value * INSURANCE_RATE);
      }
      estimates[tier] = { base_price: base, insurance_fee: ins, total: base + ins };
    }
    return res.json({ distance_km: Math.round(dist * 100) / 100, estimates });
  } catch (err) {
    console.error('calculatePrice:', err);
    return res.status(500).json({ error: 'Price calculation failed' });
  }
}

async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const orderRes = await db.query(
      `SELECT o.*, u.full_name as driver_name, u.phone as driver_phone, u.profile_photo_url as driver_photo,
        dp.vehicle_make, dp.vehicle_model, dp.vehicle_plate, dt.current_rating as driver_rating
       FROM orders o
       LEFT JOIN users u ON u.id = o.driver_id
       LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
       LEFT JOIN driver_tiers dt ON dt.driver_id = o.driver_id
       WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id && order.driver_id !== req.user.id && req.user.user_type !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json(order);
  } catch (err) {
    console.error('getOrderById:', err);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
}

async function getCustomerOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const params = [req.user.id];
    let where = 'WHERE o.customer_id = $1';
    if (status) {
      params.push(status);
      where += ` AND o.status = $${params.length}`;
    }

    const rows = await db.query(
      `SELECT o.*, u.full_name as driver_name FROM orders o
       LEFT JOIN users u ON u.id = o.driver_id
       ${where}
       ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countRes = await db.query(
      `SELECT COUNT(*)::int as c FROM orders o ${where}`,
      params
    );
    const total = countRes.rows[0]?.c || 0;
    return res.json({ orders: rows.rows, total, page, limit });
  } catch (err) {
    console.error('getCustomerOrders:', err);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

async function cancelOrder(req, res) {
  try {
    const { id } = req.params;
    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['pending', 'matching', 'unmatched'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled in current status' });
    }

    await db.query(`UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
    const payRes = await db.query(`SELECT payment_method FROM payments WHERE order_id = $1`, [id]);
    const payment = payRes.rows[0];
    if (payment) {
      await db.query(
        `UPDATE payments SET escrow_status = 'refunded', updated_at = NOW() WHERE order_id = $1`,
        [id]
      );
      if (payment.payment_method === 'wallet') {
        await db.query(
          `UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
          [order.total_price, order.customer_id]
        );
      }
    }
    return res.json({ message: 'Order cancelled', refund: order.total_price });
  } catch (err) {
    console.error('cancelOrder:', err);
    return res.status(500).json({ error: 'Cancel failed' });
  }
}

async function getOrderTracking(req, res) {
  try {
    const { id } = req.params;
    const orderRes = await db.query(
      `SELECT o.*, o.driver_current_lat as lat, o.driver_current_lng as lng, o.driver_last_seen_at
       FROM orders o WHERE o.id = $1`,
      [id]
    );
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id && order.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({
      lat: order.lat ? parseFloat(order.lat) : null,
      lng: order.lng ? parseFloat(order.lng) : null,
      last_seen_at: order.driver_last_seen_at,
    });
  } catch (err) {
    console.error('getOrderTracking:', err);
    return res.status(500).json({ error: 'Failed to fetch tracking' });
  }
}

async function acceptOrder(req, res) {
  try {
    const { id } = req.params;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'matching') return res.status(400).json({ error: 'Order not available' });
    if (order.driver_id) return res.status(400).json({ error: 'Order already assigned' });

    const offerRes = await db.query(
      `SELECT id FROM job_offers WHERE order_id = $1 AND driver_id = $2 AND status = 'pending'`,
      [id, driverId]
    );
    if (offerRes.rows.length === 0) return res.status(400).json({ error: 'No valid offer' });

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE orders SET driver_id = $1, status = 'accepted', matched_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [driverId, id]
      );
      await client.query(
        `UPDATE job_offers SET status = 'accepted' WHERE order_id = $1 AND driver_id = $2`,
        [id, driverId]
      );
      await client.query(
        `UPDATE job_offers SET status = 'expired' WHERE order_id = $1 AND driver_id != $2`,
        [id, driverId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await sendPushNotification(
      order.customer_id,
      'Driver found!',
      `Your driver is on the way to collect your parcel.`,
      { orderId: id, type: 'driver_matched' }
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('acceptOrder:', err);
    return res.status(500).json({ error: 'Accept failed' });
  }
}

async function declineOrder(req, res) {
  try {
    const { id } = req.params;
    const driverId = req.user.id;
    await db.query(
      `UPDATE job_offers SET status = 'declined' WHERE order_id = $1 AND driver_id = $2`,
      [id, driverId]
    );
    return res.json({ message: 'Offer declined' });
  } catch (err) {
    console.error('declineOrder:', err);
    return res.status(500).json({ error: 'Decline failed' });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const valid = ['pickup_arrived', 'delivery_arrived'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });

    const expected = {
      pickup_arrived: ['accepted', 'pickup_en_route'],
      delivery_arrived: ['delivery_en_route'],
    };
    if (!expected[status].includes(order.status)) {
      return res.status(400).json({ error: `Cannot set ${status} from ${order.status}` });
    }

    const newStatus = status === 'pickup_arrived' ? 'pickup_arrived' : 'delivery_arrived';
    await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, id]
    );

    if (status === 'pickup_arrived') {
      await sendPushNotification(
        order.customer_id,
        'Driver arrived',
        `Your driver has arrived. Share your pickup code: ${order.pickup_otp}`,
        { orderId: id, type: 'pickup_arrived' }
      );
    }

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('updateOrderStatus:', err);
    return res.status(500).json({ error: 'Update failed' });
  }
}

async function confirmPickupOTP(req, res) {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'pickup_arrived') return res.status(400).json({ error: 'Invalid order status' });
    if (order.pickup_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    await db.query(
      `UPDATE orders SET status = 'collected', pickup_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await sendPushNotification(
      order.customer_id,
      'Parcel collected',
      `Your parcel has been collected and is on the way to ${order.dropoff_address}`,
      { orderId: id, type: 'collected' }
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('confirmPickupOTP:', err);
    return res.status(500).json({ error: 'Confirmation failed' });
  }
}

async function confirmDeliveryOTP(req, res) {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'delivery_arrived') return res.status(400).json({ error: 'Invalid order status' });
    if (order.delivery_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    await db.query(
      `UPDATE orders SET status = 'delivered', delivery_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await releaseEscrow(id);

    await sendPushNotification(
      order.customer_id,
      'Delivered!',
      'Your parcel has been successfully delivered. Rate your driver.',
      { orderId: id, type: 'delivered' }
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('confirmDeliveryOTP:', err);
    return res.status(500).json({ error: 'Confirmation failed' });
  }
}

async function uploadPickupPhoto(req, res) {
  try {
    const { id } = req.params;
    const file = req.file;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });
    if (!file) return res.status(400).json({ error: 'Image file required' });

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'collected') return res.status(400).json({ error: 'Confirm pickup OTP first' });

    const result = await uploadImage(file);
    const url = result.secure_url;

    await db.query(
      `UPDATE orders SET pickup_photo_url = $1, status = 'delivery_en_route', updated_at = NOW() WHERE id = $2`,
      [url, id]
    );

    await sendPushNotification(
      order.customer_id,
      'Parcel collected',
      `Your parcel has been collected and is on the way to ${order.dropoff_address}`,
      { orderId: id, type: 'collected' }
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('uploadPickupPhoto:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}

async function uploadDeliveryPhoto(req, res) {
  try {
    const { id } = req.params;
    const file = req.file;
    const driverId = req.user.id;
    if (req.user.user_type !== 'driver') return res.status(403).json({ error: 'Drivers only' });
    if (!file) return res.status(400).json({ error: 'Image file required' });

    const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = orderRes.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.driver_id !== driverId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Confirm delivery OTP first' });

    const result = await uploadImage(file);
    const url = result.secure_url;

    await db.query(
      `UPDATE orders SET delivery_photo_url = $1, status = 'completed', updated_at = NOW() WHERE id = $2`,
      [url, id]
    );

    await sendPushNotification(
      order.customer_id,
      'Delivered!',
      'Your parcel has been successfully delivered. Rate your driver.',
      { orderId: id, type: 'delivered' }
    );

    const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error('uploadDeliveryPhoto:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}

module.exports = {
  createOrder,
  calculatePrice,
  getOrderById,
  getCustomerOrders,
  cancelOrder,
  getOrderTracking,
  acceptOrder,
  declineOrder,
  updateOrderStatus,
  confirmPickupOTP,
  confirmDeliveryOTP,
};
