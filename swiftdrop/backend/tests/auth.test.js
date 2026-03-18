/**
 * SwiftDrop Auth API Tests
 * Run with: node tests/auth.test.js
 * Ensure the backend server is running: npm run dev
 */

const BASE = process.env.API_URL || 'http://localhost:4000';

async function request(method, path, body = null, token = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  const timestamp = Date.now();
  const testEmail = `test${timestamp}@swiftdrop.local`;
  const testPhone = `+27000000${String(timestamp).slice(-4)}`;

  console.log('SwiftDrop Auth Tests\n');

  // 1. Register customer - expect 201
  const reg = await request('POST', '/api/auth/register-customer', {
    full_name: 'Test User',
    email: testEmail,
    phone: testPhone,
    password: 'Password123!',
  });
  const pass1 = reg.status === 201;
  console.log(pass1 ? 'PASS' : 'FAIL', 'POST /api/auth/register-customer returns 201');
  if (!pass1) console.log('  Response:', reg.data);

  // 2. Login with valid credentials - expect token
  const login = await request('POST', '/api/auth/login', {
    email: 'customer@swiftdrop.local',
    password: 'Password123!',
  });
  const pass2 = login.status === 200 && login.data.token;
  console.log(pass2 ? 'PASS' : 'FAIL', 'POST /api/auth/login returns JWT token');
  if (!pass2) console.log('  Response:', login.data);

  // 3. Login with wrong password - expect 401
  const badLogin = await request('POST', '/api/auth/login', {
    email: 'customer@swiftdrop.local',
    password: 'WrongPassword123!',
  });
  const pass3 = badLogin.status === 401;
  console.log(pass3 ? 'PASS' : 'FAIL', 'POST /api/auth/login with wrong password returns 401');
  if (!pass3) console.log('  Response:', badLogin.data);

  const allPass = pass1 && pass2 && pass3;
  console.log('\n' + (allPass ? 'All tests passed.' : 'Some tests failed.'));
  process.exit(allPass ? 0 : 1);
}

runTests().catch((err) => {
  console.error('Test error:', err.message);
  process.exit(1);
});
