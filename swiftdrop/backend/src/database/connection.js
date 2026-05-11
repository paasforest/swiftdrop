const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

const isProd = process.env.NODE_ENV === 'production';

// node-pg Pool does not support `min` connections; only `max` and idle timeouts apply.
const pool = new Pool({
  connectionString,
  ssl: isProd ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

pool.on('connect', () => {
  console.log('New database connection');
});

const getClient = async () => pool.connect();

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient,
  pool,
};
