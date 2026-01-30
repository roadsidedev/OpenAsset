import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const secret = process.env.JWT_SECRET || 'super-secret-change-me-in-production';
const address = process.argv[2];

if (!address) {
  console.error('Usage: ts-node scripts/generate-admin-token.ts <wallet_address>');
  process.exit(1);
}

const token = jwt.sign({ address: address.toLowerCase() }, secret, {
  expiresIn: '24h',
});

console.log('\n✅ JWT Token Generated for:', address);
console.log('---------------------------------------------------');
console.log(token);
console.log('---------------------------------------------------');
console.log('\nUse this token in the Authorization header:');
console.log(`Authorization: Bearer ${token}\n`);
