/**
 * One-time script to create test driver + sender accounts.
 * Run: node scripts/createTestUsers.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const admin = require('firebase-admin');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const SA = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
const DB_URL = process.env.DATABASE_URL;
const RTDB_URL = process.env.FIREBASE_DATABASE_URL ||
  'https://swiftdrop-c0110-default-rtdb.europe-west1.firebasedatabase.app';

if (!SA || SA.includes('your_project')) {
  console.error('❌  FIREBASE_SERVICE_ACCOUNT_JSON not set — run this on Railway or set the env var locally.');
  process.exit(1);
}

const cred = typeof SA === 'string' ? JSON.parse(SA) : SA;
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(cred), databaseURL: RTDB_URL });
}

const pool = new Pool({ connectionString: DB_URL });

const USERS = [
  {
    email:    'sender@swiftdroptest.com',
    password: 'Test1234',
    phone:    '+27774388845',
    name:     'Test Sender',
    role:     'sender',
    defaultAddress: '12 Bree Street, Cape Town, 8001',
  },
  {
    email:    'driver@swiftdroptest.com',
    password: 'Test1234',
    phone:    '+27679518124',
    name:     'Test Driver',
    role:     'driver',
    idNumber:    '9001015009087',
    vehicleType: 'Car',
    vehicleReg:  'CA 441 GP',
  },
];

async function run() {
  for (const u of USERS) {
    console.log(`\n── Creating ${u.role}: ${u.email}`);
    let firebaseUid;

    // 1. Create or fetch Firebase user
    try {
      const existing = await admin.auth().getUserByEmail(u.email);
      firebaseUid = existing.uid;
      console.log(`   Firebase user already exists: ${firebaseUid}`);
      // Update password to make sure it matches
      await admin.auth().updateUser(firebaseUid, { password: u.password, displayName: u.name });
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        const created = await admin.auth().createUser({
          email: u.email,
          password: u.password,
          displayName: u.name,
          emailVerified: true,
        });
        firebaseUid = created.uid;
        console.log(`   Firebase user created: ${firebaseUid}`);
      } else {
        console.error('   Firebase error:', e.message);
        continue;
      }
    }

    // 2. Upsert Postgres user row
    const userType = u.role === 'driver' ? 'driver' : 'customer';
    const result = await pool.query(`
      INSERT INTO users (firebase_uid, email, phone, password_hash, full_name, user_type, app_role,
                         profile_completed, is_verified, is_active)
      VALUES ($1,$2,$3,'firebase-auth',$4,$5,$6,true,true,true)
      ON CONFLICT (firebase_uid) DO UPDATE
        SET email=$2, phone=$3, full_name=$4, user_type=$5, app_role=$6,
            profile_completed=true, is_verified=true, is_active=true, updated_at=NOW()
      RETURNING id
    `, [firebaseUid, u.email, u.phone, u.name, userType, u.role]);

    const userId = result.rows[0].id;
    console.log(`   Postgres user id: ${userId}`);

    // 3. Role-specific profile data
    if (u.role === 'driver') {
      // Ensure driver_profiles row exists
      await pool.query(`
        INSERT INTO driver_profiles (user_id, verification_status, vehicle_make, vehicle_plate)
        VALUES ($1,'approved',$2,$3)
        ON CONFLICT (user_id) DO UPDATE
          SET verification_status='approved', vehicle_make=$2, vehicle_plate=$3
      `, [userId, u.vehicleType, u.vehicleReg]);

      await pool.query(`
        UPDATE users SET sa_id_number=$1 WHERE id=$2
      `, [u.idNumber, userId]);
      console.log(`   Driver profile set — vehicle: ${u.vehicleType} ${u.vehicleReg}`);
    } else {
      await pool.query(`
        UPDATE users SET default_pickup_address=$1 WHERE id=$2
      `, [u.defaultAddress, userId]);
      console.log(`   Sender profile set — address: ${u.defaultAddress}`);
    }

    console.log(`   ✅  ${u.role} ready`);
    console.log(`       Email:    ${u.email}`);
    console.log(`       Password: ${u.password}`);
    console.log(`       Phone:    ${u.phone}`);
  }

  console.log('\n✅  Both test accounts created.\n');
  console.log('SENDER  →  sender@swiftdroptest.com  /  Test1234');
  console.log('DRIVER  →  driver@swiftdroptest.com  /  Test1234');
  await pool.end();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
