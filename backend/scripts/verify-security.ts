import request from 'supertest';
import app from '../src/app';

async function verifySecurity() {
  console.log('Starting Security Verification...');

  // 1. Health Check & Headers
  console.log('\nTesting /health endpoint...');
  const res = await request(app).get('/health');
  
  if (res.status === 200) {
    console.log('✅ /health is reachable');
  } else {
    console.error('❌ /health failed:', res.status);
  }

  // 2. Rate Limiting Headers
  console.log('\nChecking Rate Limit Headers...');
  if (res.headers['ratelimit-limit']) {
    console.log(`✅ RateLimit-Limit found: ${res.headers['ratelimit-limit']}`);
  } else {
    console.error('❌ RateLimit-Limit header missing');
  }

  // 3. CORS Headers
  console.log('\nChecking CORS Headers...');
  const corsRes = await request(app)
    .options('/health')
    .set('Origin', 'http://localhost:3000')
    .set('Access-Control-Request-Method', 'GET');

  if (corsRes.headers['access-control-allow-origin'] === 'http://localhost:3000') {
    console.log('✅ CORS Origin header correct for localhost:3000');
  } else {
    console.error(`❌ CORS Origin header incorrect: ${corsRes.headers['access-control-allow-origin']}`);
  }

  const badCorsRes = await request(app)
    .options('/health')
    .set('Origin', 'http://evil.com')
    .set('Access-Control-Request-Method', 'GET');

  if (!badCorsRes.headers['access-control-allow-origin']) {
    console.log('✅ CORS Origin header missing for evil.com (Blocked)');
  } else {
    console.error(`❌ CORS Origin header present for evil.com: ${badCorsRes.headers['access-control-allow-origin']}`);
  }

  // 4. Helmet Headers
  console.log('\nChecking Security Headers (Helmet)...');
  if (res.headers['x-dns-prefetch-control']) {
    console.log('✅ Helmet headers detected (X-DNS-Prefetch-Control)');
  } else {
    console.error('❌ Helmet headers missing');
  }
}

verifySecurity().catch(console.error);
