const db = require('../database/connection');

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

async function submitRating(req, res) {
  try {
    const customerId = req.user?.id;
    if (!customerId || req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const orderIdRaw =
      req.body?.order_id ?? req.body?.orderId ?? null;
    const jobIdRaw = req.body?.job_id ?? req.body?.jobId ?? null;
    let driverId = parsePositiveInt(
      req.body?.driver_id ?? req.body?.driverId
    );
    const rating = Number(req.body?.rating);
    const comment = req.body?.comment ?? null;

    const orderId = parsePositiveInt(orderIdRaw);
    const jobId = parsePositiveInt(jobIdRaw);

    if ((!orderId && !jobId)) {
      return res.status(400).json({
        error: 'order_id or job_id is required',
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5',
      });
    }

    let resolvedOrderId = orderId ?? null;
    let resolvedJobId = jobId ?? null;

    if (orderId) {
      const orderRes = await db.query(
        `
          SELECT id, driver_id, delivery_job_id FROM orders
          WHERE id = $1
            AND customer_id = $2
            AND status IN ('delivered', 'completed')
        `,
        [orderId, customerId]
      );
      const row = orderRes.rows[0];
      if (!row) {
        return res.status(403).json({
          error: 'Order not found or not yet delivered',
        });
      }

      const jobFromOrder = parsePositiveInt(row.delivery_job_id);
      if (resolvedJobId && jobFromOrder && resolvedJobId !== jobFromOrder) {
        return res.status(403).json({
          error: 'job_id does not match this order',
        });
      }
      if (!resolvedJobId && jobFromOrder) {
        resolvedJobId = jobFromOrder;
      }

      const orderDriverId = parsePositiveInt(row.driver_id);
      if (!driverId) {
        driverId = orderDriverId;
      } else if (orderDriverId && driverId !== orderDriverId) {
        return res.status(403).json({
          error: 'driver_id does not match this order',
        });
      }
      if (!driverId) {
        return res.status(400).json({
          error: 'No driver assigned to this order',
        });
      }
    }

    if (jobId) {
      const jobRes = await db.query(
        `
          SELECT id, selected_driver_id FROM delivery_jobs
          WHERE id = $1
            AND customer_id = $2
            AND status IN ('delivered', 'completed')
        `,
        [jobId, customerId]
      );
      const jobRow = jobRes.rows[0];
      if (!jobRow) {
        return res.status(403).json({
          error: 'Job not found or not yet delivered',
        });
      }

      const jobDriverId = parsePositiveInt(jobRow.selected_driver_id);
      if (!driverId) {
        driverId = jobDriverId;
      } else if (jobDriverId && driverId !== jobDriverId) {
        return res.status(403).json({
          error: 'driver_id does not match this delivery',
        });
      }
      if (!driverId) {
        return res.status(400).json({
          error: 'No driver selected for this job',
        });
      }
    }

    const dupRes = await db.query(
      `
        SELECT id FROM ratings
        WHERE customer_id = $1
          AND driver_id = $2
          AND rated_by = 'customer'
          AND (
            ($3::int IS NOT NULL AND order_id IS NOT DISTINCT FROM $3::int)
            OR ($4::int IS NOT NULL AND job_id IS NOT DISTINCT FROM $4::int)
          )
        LIMIT 1
      `,
      [customerId, driverId, resolvedOrderId, resolvedJobId]
    );
    if (dupRes.rows[0]) {
      return res.status(409).json({
        error: 'You have already rated this delivery',
      });
    }

    await db.query(
      `
        INSERT INTO ratings (
          customer_id,
          driver_id,
          order_id,
          job_id,
          rated_by,
          rating,
          comment,
          created_at
        ) VALUES ($1, $2, $3, $4, 'customer', $5, $6, NOW())
      `,
      [
        customerId,
        driverId,
        resolvedOrderId,
        resolvedJobId,
        rating,
        comment || null,
      ]
    );

    await db.query(
      `
        UPDATE driver_tiers
        SET current_rating = (
          SELECT ROUND(AVG(rating)::numeric, 2)
          FROM ratings
          WHERE driver_id = $1
            AND rated_by = 'customer'
        ),
        updated_at = NOW()
        WHERE driver_id = $1
      `,
      [driverId]
    );

    res.json({
      success: true,
      message: 'Thank you for your rating!',
    });
  } catch (err) {
    console.error('submitRating:', err);
    res.status(500).json({
      error: 'Could not submit rating',
    });
  }
}

async function getDriverRating(req, res) {
  try {
    const driverId = parsePositiveInt(req.params.driverId);
    if (!driverId) {
      return res.status(400).json({ error: 'Invalid driver id' });
    }

    const { rows } = await db.query(
      `
        SELECT
          COUNT(*)::int AS total_ratings,
          AVG(rating)::NUMERIC(3, 2) AS average_rating,
          COUNT(*) FILTER (WHERE rating = 5)::int AS five_star,
          COUNT(*) FILTER (WHERE rating = 4)::int AS four_star,
          COUNT(*) FILTER (WHERE rating = 3)::int AS three_star,
          COUNT(*) FILTER (WHERE rating = 2)::int AS two_star,
          COUNT(*) FILTER (WHERE rating = 1)::int AS one_star
        FROM ratings
        WHERE driver_id = $1
          AND rated_by = 'customer'
      `,
      [driverId]
    );

    const recent = await db.query(
      `
        SELECT
          r.rating,
          r.comment,
          r.created_at,
          u.full_name AS customer_name
        FROM ratings r
        JOIN users u ON u.id = r.customer_id
        WHERE r.driver_id = $1
          AND r.rated_by = 'customer'
          AND r.customer_id IS NOT NULL
        ORDER BY r.created_at DESC
        LIMIT 5
      `,
      [driverId]
    );

    res.json({
      stats: rows[0],
      recent_reviews: recent.rows,
    });
  } catch (err) {
    console.error('getDriverRating:', err);
    res.status(500).json({
      error: 'Could not load ratings',
    });
  }
}

async function getCustomerRating(req, res) {
  try {
    if (!req.user || req.user.user_type !== 'customer') {
      return res.status(403).json({ error: 'Customers only' });
    }

    const orderId = parsePositiveInt(req.params.orderId);
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const orderRes = await db.query(
      `SELECT id FROM orders WHERE id = $1 AND customer_id = $2`,
      [orderId, req.user.id]
    );
    if (!orderRes.rows[0]) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const ratingRes = await db.query(
      `
        SELECT r.id, r.order_id, r.job_id, r.driver_id, r.rating, r.comment, r.created_at
        FROM ratings r
        WHERE r.order_id = $1
          AND r.rated_by = 'customer'
          AND (
            r.customer_id = $2
            OR (
              r.customer_id IS NULL
              AND EXISTS (
                SELECT 1 FROM orders o
                WHERE o.id = r.order_id AND o.customer_id = $2
              )
            )
          )
        ORDER BY r.created_at DESC
        LIMIT 1
      `,
      [orderId, req.user.id]
    );

    return res.json({ rating: ratingRes.rows[0] || null });
  } catch (err) {
    console.error('getCustomerRating:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

module.exports = {
  submitRating,
  getDriverRating,
  getCustomerRating,
};
