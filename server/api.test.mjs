import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { after, before, test } from 'node:test';
import express from 'express';
import { createApiRouter } from './api.mjs';
import { createDatabase } from './db.mjs';

const password = 'Test-Password-123!';
let db;
let server;
let baseUrl;
const cookies = new Map();

function addUser(id, role, email) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, salt, 64).toString('hex');
  db.prepare(`
    INSERT INTO users (id, full_name, email, role, password_hash, password_salt, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, `Akun ${id}`, email, role, passwordHash, salt, new Date().toISOString());
}

async function call(path, { user, method = 'GET', body } = {}) {
  const headers = {};
  if (user && cookies.has(user)) headers.Cookie = cookies.get(user);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cookie = response.headers.get('set-cookie');
  if (user && cookie) cookies.set(user, cookie.split(';')[0]);
  const data = response.status === 204 ? null : await response.json();
  return { response, data };
}

async function login(email, user) {
  const result = await call('/auth/login', {
    user,
    method: 'POST',
    body: { email, password, termsAccepted: true },
  });
  assert.equal(result.response.status, 200);
  assert.ok(cookies.has(user));
  return result.data;
}

before(async () => {
  db = createDatabase(':memory:');
  addUser('employee-1', 'employee', 'one@example.test');
  addUser('employee-2', 'employee', 'two@example.test');
  addUser('manager-1', 'casemanager', 'manager@example.test');
  addUser('manager-2', 'casemanager', 'manager2@example.test');
  addUser('psychologist-1', 'psychologist', 'psychologist@example.test');
  addUser('admin-1', 'admin', 'admin@example.test');
  db.prepare('UPDATE psychologists SET user_id = ? WHERE id = ?').run('psychologist-1', 'psy-1');

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(db));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
});

test('authentication requires terms, hashes credentials, and invalidates logout sessions', async () => {
  const missingTerms = await call('/auth/login', {
    method: 'POST',
    body: { email: 'one@example.test', password, termsAccepted: false },
  });
  assert.equal(missingTerms.response.status, 400);

  await login('one@example.test', 'employee');
  const currentUser = await call('/auth/me', { user: 'employee' });
  assert.equal(currentUser.data.user.role, 'employee');
  assert.equal(currentUser.data.portal, 'employee');

  await call('/auth/logout', { user: 'employee', method: 'POST' });
  cookies.delete('employee');
  const afterLogout = await call('/bootstrap');
  assert.equal(afterLogout.response.status, 401);
  const anonymousSession = await call('/auth/me');
  assert.equal(anonymousSession.response.status, 200);
  assert.equal(anonymousSession.data.user, null);
});

test('public registration creates employee-only accounts and rejects duplicate email', async () => {
  const noTerms = await call('/auth/register', {
    method: 'POST',
    body: {
      name: 'Karyawan Baru',
      email: 'new@example.test',
      password,
      termsAccepted: false,
    },
  });
  assert.equal(noTerms.response.status, 400);

  const registered = await call('/auth/register', {
    user: 'registered',
    method: 'POST',
    body: {
      name: 'Karyawan Baru',
      email: 'new@example.test',
      password,
      termsAccepted: true,
    },
  });
  assert.equal(registered.response.status, 200);
  assert.equal(registered.data.user.role, 'employee');

  const duplicate = await call('/auth/register', {
    method: 'POST',
    body: {
      name: 'Karyawan Lain',
      email: 'new@example.test',
      password,
      termsAccepted: true,
    },
  });
  assert.equal(duplicate.response.status, 409);
});

test('complaints persist with a ticket and are visible only to their owner and assigned case manager', async () => {
  await login('one@example.test', 'employee');
  await login('two@example.test', 'other');
  await login('manager@example.test', 'manager');
  await login('manager2@example.test', 'other-manager');
  await login('admin@example.test', 'admin');

  const invalid = await call('/complaints', {
    user: 'employee',
    method: 'POST',
    body: {
      anonymous: false,
      category: 'Burnout',
      department: 'Engineering',
      description: 'Terlalu singkat',
      termsAccepted: true,
    },
  });
  assert.equal(invalid.response.status, 400);

  const created = await call('/complaints', {
    user: 'employee',
    method: 'POST',
    body: {
      anonymous: false,
      category: 'Burnout',
      department: 'Engineering',
      description: 'Beban kerja berubah tanpa koordinasi selama beberapa pekan terakhir.',
      termsAccepted: true,
    },
  });
  assert.equal(created.response.status, 201);
  const ticketId = created.data.complaint.id;
  assert.match(ticketId, /^CASE-\d{4}-[A-F0-9]{8}$/);

  const ownerCases = await call('/complaints', { user: 'employee' });
  assert.equal(ownerCases.data.complaints.length, 1);
  const otherCases = await call('/complaints', { user: 'other' });
  assert.equal(otherCases.data.complaints.length, 0);

  const managerCases = await call('/complaints', { user: 'manager' });
  assert.equal(managerCases.data.complaints.length, 1);
  const wrongManager = await call(`/complaints/${ticketId}/status`, {
    user: 'other-manager',
    method: 'PATCH',
    body: { status: 'Under Review' },
  });
  assert.equal(wrongManager.response.status, 404);
  db.prepare('UPDATE complaints SET assigned_case_manager_id = NULL WHERE id = ?').run(ticketId);
  const unassignedCases = await call('/complaints', { user: 'other-manager' });
  assert.equal(unassignedCases.data.complaints.length, 1);
  const claimed = await call(`/complaints/${ticketId}/claim`, { user: 'other-manager', method: 'POST' });
  assert.equal(claimed.response.status, 200);
  assert.equal(claimed.data.complaint.owner, 'Akun manager-2');
  const previousManagerUpdate = await call(`/complaints/${ticketId}/status`, {
    user: 'manager',
    method: 'PATCH',
    body: { status: 'Under Review' },
  });
  assert.equal(previousManagerUpdate.response.status, 404);
  const adminCases = await call('/complaints', { user: 'admin' });
  assert.equal(adminCases.response.status, 403);

  const update = await call(`/complaints/${ticketId}/status`, {
    user: 'other-manager',
    method: 'PATCH',
    body: { status: 'Under Review' },
  });
  assert.equal(update.response.status, 200);
  const refreshed = await call('/complaints', { user: 'employee' });
  assert.equal(refreshed.data.complaints[0].status, 'Under Review');
  assert.equal(refreshed.data.complaints[0].timeline.length, 2);
});

test('counseling messages persist and are scoped to the employee and assigned psychologist', async () => {
  await login('one@example.test', 'employee');
  await login('two@example.test', 'other');
  await login('psychologist@example.test', 'psychologist');

  const created = await call('/conversations', {
    user: 'employee',
    method: 'POST',
    body: { psychologistId: 'psy-1' },
  });
  assert.equal(created.response.status, 201);
  const threadId = created.data.conversationId;

  const sent = await call(`/conversations/${threadId}/messages`, {
    user: 'employee',
    method: 'POST',
    body: { text: 'Saya ingin membahas tekanan pekerjaan.' },
  });
  assert.equal(sent.response.status, 201);
  assert.equal(sent.data.threads[0].messages.length, 1);

  const psychologistInbox = await call('/bootstrap', { user: 'psychologist' });
  assert.equal(psychologistInbox.data.threads.length, 1);
  assert.equal(psychologistInbox.data.threads[0].messages[0].text, 'Saya ingin membahas tekanan pekerjaan.');

  const otherUserInbox = await call('/bootstrap', { user: 'other' });
  assert.equal(otherUserInbox.data.threads.length, 0);
  const otherUserRead = await call(`/conversations/${threadId}/messages`, {
    user: 'other',
    method: 'POST',
    body: { text: 'Pesan yang tidak berwenang.' },
  });
  assert.equal(otherUserRead.response.status, 404);

  const reply = await call(`/conversations/${threadId}/messages`, {
    user: 'psychologist',
    method: 'POST',
    body: { text: 'Terima kasih sudah berbagi.' },
  });
  assert.equal(reply.response.status, 201);
  const employeeInbox = await call('/bootstrap', { user: 'employee' });
  assert.equal(employeeInbox.data.threads[0].messages.length, 2);
  assert.equal(employeeInbox.data.threads[0].messages[1].sender, 'peer');
  const markRead = await call(`/conversations/${threadId}/read`, {
    user: 'employee',
    method: 'POST',
  });
  assert.equal(markRead.response.status, 200);
  assert.ok(markRead.data.readAt);
  const psychologistAfterRead = await call('/bootstrap', { user: 'psychologist' });
  assert.ok(psychologistAfterRead.data.threads[0].messages[1].readAt);
});

test('administrator can manage publishing and profile availability without reading private conversations or complaints', async () => {
  await login('admin@example.test', 'admin');

  const deniedArticles = await call('/admin/articles', { user: 'employee' });
  assert.equal(deniedArticles.response.status, 403);

  const created = await call('/admin/articles', {
    user: 'admin',
    method: 'POST',
    body: {
      title: 'Panduan Mengelola Tekanan Kerja',
      category: 'Stres Kerja',
      author: 'Tim SEJIWA',
      excerpt: 'Panduan praktis untuk memahami tekanan kerja secara lebih terarah.',
      body: ['Perhatikan pola tekanan yang muncul dan catat hal yang dapat dibicarakan bersama tim.'],
      readMinutes: 5,
      published: true,
    },
  });
  assert.equal(created.response.status, 201);
  const articleId = created.data.article.id;
  const publicContent = await call('/content');
  assert.ok(publicContent.data.articles.some((item) => item.id === articleId));

  const update = await call(`/admin/articles/${articleId}`, {
    user: 'admin',
    method: 'PUT',
    body: {
      title: 'Panduan Mengelola Tekanan Kerja',
      category: 'Stres Kerja',
      author: 'Tim SEJIWA',
      excerpt: 'Panduan praktis untuk memahami tekanan kerja secara lebih terarah.',
      body: ['Perhatikan pola tekanan yang muncul dan catat hal yang dapat dibicarakan bersama tim.'],
      readMinutes: 5,
      published: false,
    },
  });
  assert.equal(update.response.status, 200);
  assert.equal((await call('/content')).data.articles.some((item) => item.id === articleId), false);

  const profile = await call('/admin/psychologists/psy-1', {
    user: 'admin',
    method: 'PATCH',
    body: { active: false, acceptingClients: false },
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.data.psychologist.active, false);

  const audit = await call('/admin/audit', { user: 'admin' });
  assert.ok(audit.data.entries.some((item) => item.action === 'article.create'));

  const adminInbox = await call('/bootstrap', { user: 'admin' });
  assert.equal(adminInbox.data.threads.length, 0);
  assert.equal(adminInbox.data.cases.length, 0);
  assert.ok(adminInbox.data.metrics);
});
