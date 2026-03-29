// seedRoutes.js — test-user seeding endpoint (protected by SEED_SECRET)
const express = require('express');
const router = express.Router();
const { getAdminAuth } = require('../services/firebaseAdmin');
const db = require('../database/connection');

const SEED_SECRET = process.env.SEED_SECRET || 'swiftdrop-seed-2026';

const USERS = require('./seedTestUsers.json');

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
      // 1. Get or create Firebase user
      let firebaseUid;
      try {
        const fbUser = await adminAuth.getUserByEmail(u.email);
        firebaseUid = fbUser.uid;
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
        } else {
          throw e;
        }
      }

      // 2. Free up phone on any conflicting row (phone is NOT NULL so use placeholder)
      await db.query(
        `UPDATE users SET phone = 'freed_' || id::text
         WHERE phone = $1
           AND (firebase_uid IS DISTINCT FROM $2)
           AND (email IS DISTINCT FROM $3)`,
        [u.phone, firebaseUid, u.email]
      );

      // 3. Find existing row by uid or email
      const found = await db.query(
        `SELECT id FROM users WHERE firebase_uid = $1 OR email = $2 LIMIT 1`,
        [firebaseUid, u.email]
      );

      let userId;
      if (found.rows.length > 0) {
        userId = found.rows[0].id;
        await db.query(
          `UPDATE users
           SET firebase_uid=$1, email=$2, phone=$3, full_name=$4,
               user_type=$5, app_role=$6, profile_completed=true,
               is_verified=true, is_active=true, updated_at=NOW()
           WHERE id=$7`,
          [firebaseUid, u.email, u.phone, u.name, u.userType, u.role, userId]
        );
      } else {
        const ins = await db.query(
          `INSERT INTO users
             (firebase_uid, email, phone, password_hash, full_name,
              user_type, app_role, profile_completed, is_verified, is_active)
           VALUES ($1,$2,$3,'firebase-auth',$4,$5,$6,true,true,true)
           RETURNING id`,
          [firebaseUid, u.email, u.phone, u.name, u.userType, u.role]
        );
        userId = ins.rows[0].id;
      }

      // 4. Role-specific profile
      if (u.role === 'driver') {
        const dp = await db.query(
          `SELECT id FROM driver_profiles WHERE user_id = $1`,
          [userId]
        );
        if (dp.rows.length > 0) {
          await db.query(
            `UPDATE driver_profiles
             SET verification_status='approved', vehicle_make=$1, vehicle_plate=$2
             WHERE user_id=$3`,
            [u.vehicleType, u.vehicleReg, userId]
          );
        } else {
          await db.query(
            `INSERT INTO driver_profiles (user_id, verification_status, vehicle_make, vehicle_plate)
             VALUES ($1,'approved',$2,$3)`,
            [userId, u.vehicleType, u.vehicleReg]
          );
        }
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
