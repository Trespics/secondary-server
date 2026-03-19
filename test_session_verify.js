const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const payload = { id: 'test-id', role: 'admin', school_id: 'test-school' };
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });

console.log('Generated Token:', token);

const decoded = jwt.verify(token, JWT_SECRET);
const expDate = new Date(decoded.exp * 1000);
const now = new Date();

console.log('Decoded Payload:', decoded);
console.log('Expiration Date:', expDate.toISOString());
console.log('Current Date:', now.toISOString());

const diffDays = Math.round((expDate - now) / (1000 * 60 * 60 * 24));
console.log(`Token expires in approximately ${diffDays} days.`);

if (diffDays >= 364) {
  console.log('✅ PASS: Token session duration is correct.');
} else {
  console.log('❌ FAIL: Token session duration is too short.');
  process.exit(1);
}
