import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

process.env.DATABASE_PATH = ':memory:';
process.env.NODE_ENV = 'production';

const { default: handler } = await import('../api/[...route].mjs');
const { default: nestedHandler } = await import('../api/handler.mjs');
let server;
let baseUrl;

before(async () => {
  server = createServer((request, response) => (
    request.url.startsWith('/api/handler')
      ? nestedHandler(request, response)
      : handler(request, response)
  ));
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('Vercel catch-all handler serves API routes with and without the /api prefix', async () => {
  const [health, normalizedHealth, session, content] = await Promise.all([
    fetch(`${baseUrl}/api/health`),
    fetch(`${baseUrl}/health`),
    fetch(`${baseUrl}/api/auth/me`),
    fetch(`${baseUrl}/api/content`),
  ]);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  assert.equal(normalizedHealth.status, 200);
  assert.deepEqual(await normalizedHealth.json(), { status: 'ok' });
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { user: null, portal: 'public' });
  assert.equal(content.status, 200);
  assert.equal((await content.json()).psychologists.length, 5);
});

test('Vercel catch-all handler returns JSON for unknown API endpoints', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-real-endpoint`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), { error: 'Endpoint API tidak ditemukan.' });
});

test('Vercel nested-route handler forwards auth, profile, and admin endpoints', async () => {
  const anonymousSession = await fetch(`${baseUrl}/api/handler?__api_path=auth/me`);
  assert.equal(anonymousSession.status, 200);
  assert.deepEqual(await anonymousSession.json(), { user: null, portal: 'public' });

  const unauthorizedAdmin = await fetch(`${baseUrl}/api/handler?__api_path=admin/articles`);
  assert.equal(unauthorizedAdmin.status, 401);
  assert.match(unauthorizedAdmin.headers.get('content-type'), /application\/json/);

  const profile = await fetch(`${baseUrl}/api/handler?__api_path=profile`, { method: 'GET' });
  assert.equal(profile.status, 404);
  assert.deepEqual(await profile.json(), { error: 'Endpoint API tidak ditemukan.' });

  const invalidPath = await fetch(`${baseUrl}/api/handler?__api_path=auth%2F..%2Fhealth`);
  assert.equal(invalidPath.status, 404);
});

test('Vercel handler shares registration and bootstrap sessions within the same function', async () => {
  const email = `vercel-${Date.now()}@example.test`;
  const register = await fetch(`${baseUrl}/api/handler?__api_path=auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Pengguna Vercel',
      email,
      password: 'Vercel-Test-Password-123!',
      termsAccepted: true,
    }),
  });
  assert.equal(register.status, 200);
  const { user } = await register.json();
  assert.equal(user.email, email);
  const cookie = register.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);

  const bootstrap = await fetch(`${baseUrl}/api/handler?__api_path=bootstrap`, {
    headers: { Cookie: cookie },
  });
  assert.equal(bootstrap.status, 200);
  const data = await bootstrap.json();
  assert.equal(data.user.id, user.id);
  assert.equal(data.user.email, email);

  const assistantMessage = await fetch(`${baseUrl}/api/handler?__api_path=assistant/messages`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: 'Saya merasa cemas menghadapi pekerjaan.' }),
  });
  assert.equal(assistantMessage.status, 201);
  const assistantData = await assistantMessage.json();
  assert.equal(assistantData.messages.at(-1).sender, 'assistant');
  assert.match(assistantData.messages.at(-1).body, /tekanan pekerjaan/i);
});
