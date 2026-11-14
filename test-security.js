const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- TEST 1: Old static cookie authenticated_admin_valid must return 401 ---');
  const res1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/photos',
    method: 'GET',
    headers: {
      'Cookie': 'strovyn_admin_session=authenticated_admin_valid'
    }
  });
  console.log('Result 1: Status =', res1.status, '| Body =', res1.body);

  console.log('\n--- TEST 2: Unauthenticated GET /api/admin/photos must return 401 ---');
  const res2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/photos',
    method: 'GET'
  });
  console.log('Result 2: Status =', res2.status, '| Body =', res2.body);

  console.log('\n--- TEST 3: Admin login with missing/wrong key must return 403 ---');
  const res3 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/photos',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ action: 'login', key: 'wrong-passphrase' }));
  console.log('Result 3: Status =', res3.status, '| Body =', res3.body);

  console.log('\n--- TEST 4: Quote POST with invalid email must return 400 with Zod error ---');
  const res4 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/quotes',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ fullName: 'Test', email: 'not-an-email', phone: '123456', serviceRequired: 'Painting', description: 'Testing quote validation' }));
  console.log('Result 4: Status =', res4.status, '| Body =', res4.body);

  console.log('\n--- TEST 5: Upload with invalid magic bytes / file extension must return 400 ---');
  const boundary = '----WebKitFormBoundaryTest123';
  const fakeFile = Buffer.from('THIS IS NOT A VALID JPEG OR MAGIC BYTES');
  const pre = '--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="malicious.exe"\r\nContent-Type: image/jpeg\r\n\r\n';
  const post = '\r\n--' + boundary + '--\r\n';
  const payload = Buffer.concat([Buffer.from(pre), fakeFile, Buffer.from(post)]);

  const res5 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': payload.length
    }
  }, payload);
  console.log('Result 5: Status =', res5.status, '| Body =', res5.body);

  console.log('\n--- TEST 6: Feedback POST with invalid rating must return 400 ---');
  const res6 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/feedback',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ customerName: 'Alex', rating: 10, message: 'Great job' }));
  console.log('Result 6: Status =', res6.status, '| Body =', res6.body);

  console.log('\n--- TEST 7: AI Assistant query rate limit and role validation ---');
  const res7 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/ai-assistant',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ message: 'What is Level 5 finish?' }));
  console.log('Result 7: Status =', res7.status, '| Body =', res7.body);
}

runTests().catch(console.error);
