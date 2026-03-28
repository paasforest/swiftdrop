/**
 * ONE-TIME seed endpoint — creates test sender + driver accounts.
 * Protected by SEED_SECRET env var. DELETE THIS FILE after seeding.
 */
const express = require('express');
const router = express.Router();
const { getAdminAuth, getRealtimeDb } = require('../services/firebaseAdmin');
const db = require('../database/connection');

const SEED_SECRET = process.env.SEED_SECRET || 'swiftdrop-seed-2026';

const USERS = [
  {
    email: 'sender@swiftdroptest.com',
    password: 'Test1234',
    phone: '+27774388845',
    name: 'Test Sender',
    role: 'sender',
    userType: 'customer',
    defaultAddress: '12 Bree Street, Cape Town, 8001',
  },
  {
    email: 'driver@swiftdroptest.com',
    password: 'Test1234',
    phone: '+27679518124',
    name: 'Test Driver',
    role: 'driver',
    userType: 'driver',
    idNumber: '9001015009087',
    vehicleType: 'Car',
    vehicleReg: 'CA 441 GP',
  },
];

router.post('/create-test-users', async (req, res) => {
  if (req.headers['x-seed-secret'] !== SEED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return res.status(500).json({ error: 'Firebase Admin not initialized' });
  }

  const results = [];

  for (const u of USERS) {
    try {
      let firebaseUid;
      // Create or update Firebase user
      try {
        const existing = await adminAuth.getUserByEmail(u.email);
        firebaseUid = existing.uid;
        await adminAuth.updateUser(firebaseUid, {
          password: u.password,
          displayName: u.name,
          emailVerified: true,
        });
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          const created = await adminAuth.createUser({
            email: u.email,
            password: u.password,
            displayName: u.name,
            emailVerified: true,
          });
          firebaseUid = created.uid;
        } else throw e;
      }

      // Upsert Postgres user
      const userRes = await db.query(`
        INSERT INTO users (firebase_uid, email, phone, password_hash, full_name,
                           user_type, app_role, profile_completed, is_verified, is_active)
        VALUES ($1,$2,$3,'firebase-auth',$4,$5,$6,true,true,true)
        ON CONFLICT (firebase_uid) DO UPDATE
          SET email=$2, phone=$3, full_name=$4, user_type=$5, app_role=$6,
              profile_completed=true, is_verified=true, is_active=true, updated_at=NOW()
        RETURNING id
      `, [firebaseUid, u.email, u.phone, u.name, u.userType, u.role]);

      const userId = userRes.rows[0].id;

      if (u.role === 'driver') {
        await db.query(`
          INSERT INTO driver_profiles (user_id, verification_status, vehicle_make, vehicle_plate)
          VALUES ($1,'approved',$2,$3)
          ON CONFLICT (user_id) DO UPDATE
            SET verification_status='approved', vehicle_make=$2, vehicle_plate=$3
        `, [userId, u.vehicleType, u.vehicleReg]);
        await db.query(
          `UPDATE users SET sa_id_number=$1 WHERE id=$2`,
          [u.idNumber, userId]
        );
      } else {
        await db.query(
          `UPDATE users SET default_pickup_address=$1 WHERE id=$2`,
          [u.defaultAddress, userId]
        );
      }

      results.push({
        role: u.role,
        email: u.email,
        password: u.password,
        phone: u.phone,
        firebaseUid,
        postgresId: userId,
        status: 'created',
      });
    } catch (err) {
      results.push({ role: u.role, email: u.email, status: 'error', error: err.message });
    }
  }

  return res.json({ results });
});

module.exports = router;
