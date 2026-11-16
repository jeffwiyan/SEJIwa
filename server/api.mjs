import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { Router } from 'express';
import { createId, getPublicContent } from './db.mjs';

const SESSION_COOKIE = 'sejiwa_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const TERMS_VERSION = '2026-11';
const validRoles = new Set(['employee', 'psychologist', 'casemanager', 'admin']);
const complaintCategories = new Set([
  'Workplace Stress',
  'Harassment',
  'Burnout',
  'Policy Conflict',
  'Interpersonal',
]);
const complaintStatuses = new Set(['Open', 'Under Review', 'Investigating', 'Escalated', 'Closed']);
const sessionStatuses = new Map([
  ['Open', 'Diterima'],
  ['Under Review', 'Dalam Peninjauan'],
  ['Investigating', 'Sedang Ditangani'],
  ['Escalated', 'Sedang Ditangani'],
  ['Closed', 'Selesai'],
]);

const loginAttempts = new Map();
const passwordResetAttempts = new Map();
const dummySalt = randomBytes(16).toString('hex');
const dummyPasswordHash = scryptSync(randomBytes(32), dummySalt, 64).toString('hex');

const now = () => new Date().toISOString();
const tokenDigest = (token) => createHash('sha256').update(token).digest('hex');
const publicUser = (user) => ({
  id: user.id,
  name: user.full_name,
  email: user.email,
  role: user.role,
  department: user.department,
  position: user.position,
});

function readCookie(request, name) {
  const rawCookie = request.headers.cookie || '';
  for (const item of rawCookie.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return '';
}

function setSessionCookie(response, token, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  response.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(response) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  response.setHeader('Set-Cookie', parts.join('; '));
}

function rejectCrossOrigin(request, response, next) {
  const origin = request.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== request.get('host')) {
        return response.status(403).json({ error: 'Permintaan lintas situs tidak diizinkan.' });
      }
    } catch {
      return response.status(403).json({ error: 'Asal permintaan tidak valid.' });
    }
  }
  return next();
}

function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user) return response.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    if (!roles.includes(request.user.role)) return response.status(403).json({ error: 'Anda tidak memiliki akses ke fitur ini.' });
    return next();
  };
}

function audit(db, actorId, action, targetType, targetId) {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(createId('audit'), actorId, action, targetType, targetId, now());
}

function addNotification(db, userId, title, body) {
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, body, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(createId('notification'), userId, title, body, now());
}

function getCaseTimeline(db, caseId) {
  return db.prepare(`
    SELECT status, note, created_at FROM complaint_status_history
    WHERE complaint_id = ? ORDER BY created_at ASC
  `).all(caseId).map((item) => ({
    id: `${caseId}-${item.created_at}`,
    label: item.note || sessionStatuses.get(item.status) || item.status,
    date: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' })
      .format(new Date(item.created_at)),
    state: 'done',
  }));
}

function toComplaint(db, item, viewerRole) {
  const anonymous = Boolean(item.anonymous);
  const reporterName = anonymous ? 'Pelapor Anonim' : item.reporter_name || 'Karyawan';
  return {
    id: item.id,
    title: `${item.category} — ${item.department}`,
    type: item.category,
    department: item.department,
    reporterName,
    reporterEmail: anonymous ? '' : item.reporter_email || '',
    owner: item.assigned_name || 'Belum ditugaskan',
    priority: item.priority,
    status: item.status,
    dueDate: new Date(new Date(item.created_at).getTime() + 7 * 86400000).toISOString().slice(0, 10),
    createdDate: item.created_at.slice(0, 10),
    eventsCount: db.prepare('SELECT COUNT(*) AS count FROM complaint_status_history WHERE complaint_id = ?').get(item.id).count,
    summary: viewerRole === 'admin' ? '' : item.description,
    nextAction: item.status === 'Closed' ? 'Laporan selesai.' : 'Tinjau dan tindak lanjuti sesuai prosedur.',
    timeline: getCaseTimeline(db, item.id),
  };
}

function getVisibleComplaints(db, user) {
  let rows = [];
  if (user.role === 'employee') {
    rows = db.prepare(`
      SELECT c.*, u.full_name AS assigned_name FROM complaints c
      LEFT JOIN users u ON u.id = c.assigned_case_manager_id
      WHERE c.reporter_user_id = ? ORDER BY c.created_at DESC
    `).all(user.id);
  } else if (user.role === 'casemanager') {
    rows = db.prepare(`
      SELECT c.*, u.full_name AS assigned_name FROM complaints c
      LEFT JOIN users u ON u.id = c.assigned_case_manager_id
      WHERE c.assigned_case_manager_id = ? OR c.assigned_case_manager_id IS NULL
      ORDER BY c.created_at DESC
    `).all(user.id);
  }
  return rows.map((row) => toComplaint(db, row, user.role));
}

function getVisibleConversations(db, user) {
  let rows = [];
  if (user.role === 'employee') {
    rows = db.prepare(`
      SELECT c.*, p.data_json AS psychologist_json FROM conversations c
      JOIN psychologists p ON p.id = c.psychologist_id
      WHERE c.employee_user_id = ? ORDER BY c.created_at DESC
    `).all(user.id);
  } else if (user.role === 'psychologist') {
    rows = db.prepare(`
      SELECT c.*, p.data_json AS psychologist_json FROM conversations c
      JOIN psychologists p ON p.id = c.psychologist_id
      WHERE p.user_id = ? ORDER BY c.created_at DESC
    `).all(user.id);
  }

  return rows.map((conversation) => {
    const profile = JSON.parse(conversation.psychologist_json);
    const employee = db.prepare('SELECT full_name FROM users WHERE id = ?').get(conversation.employee_user_id);
    const isEmployee = user.role === 'employee';
    const peerName = isEmployee ? profile.name : employee?.full_name || 'Karyawan';
    const messages = db.prepare(`
      SELECT m.id, m.body, m.created_at, m.sender_user_id, m.read_at, u.full_name, u.role
      FROM messages m JOIN users u ON u.id = m.sender_user_id
      WHERE m.conversation_id = ? ORDER BY m.created_at ASC
    `).all(conversation.id);
    const lastMessage = messages.at(-1);
    const unreadCount = db.prepare(`
      SELECT COUNT(*) AS count FROM messages
      WHERE conversation_id = ? AND sender_user_id != ? AND read_at IS NULL
    `).get(conversation.id, user.id).count;

    return {
      id: conversation.id,
      peerName,
      peerId: isEmployee ? conversation.psychologist_id : conversation.employee_user_id,
      peerRole: isEmployee ? 'Psikolog · Profil demo' : 'Karyawan',
      peerHandle: isEmployee ? profile.credentials : 'Percakapan privat',
      peerAvatar: isEmployee ? profile.image : '',
      status: 'Privat',
      lastMessagePreview: lastMessage?.body || 'Belum ada pesan.',
      lastTime: lastMessage?.created_at || conversation.created_at,
      unreadCount,
      messages: messages.map((message) => ({
        id: message.id,
        sender: message.sender_user_id === user.id
          ? (isEmployee ? 'user' : 'peer')
          : (isEmployee ? 'peer' : 'user'),
        senderName: message.full_name,
        text: message.body,
        timestamp: new Intl.DateTimeFormat('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Jakarta',
        }).format(new Date(message.created_at)),
        readAt: message.read_at,
      })),
    };
  });
}

function validateCredentials(email, password) {
  return typeof email === 'string'
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && typeof password === 'string'
    && password.length >= 12
    && password.length <= 256;
}

function verifyPassword(password, salt, hash) {
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function roleLanding(role) {
  return role === 'admin' ? 'admin'
    : role === 'casemanager' ? 'casemanager'
      : role === 'psychologist' ? 'psychologist' : 'employee';
}

export function createApiRouter(db) {
  const router = Router();

  router.use(rejectCrossOrigin);
  router.use((request, _response, next) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (!token) return next();
    const session = db.prepare(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
    `).get(tokenDigest(token), now());
    if (session) request.user = session;
    else db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenDigest(token));
    return next();
  });

  router.get('/health', (_request, response) => response.json({ status: 'ok' }));
  router.get('/content', (_request, response) => response.json(getPublicContent(db)));

  router.post('/auth/register', (request, response) => {
    const { name, email, password, termsAccepted } = request.body || {};
    if (!termsAccepted) return response.status(400).json({ error: 'Setujui syarat dan ketentuan untuk mendaftar.' });
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120 || !validateCredentials(email, password)) {
      return response.status(400).json({ error: 'Nama, email, atau kata sandi tidak memenuhi ketentuan.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
      return response.status(409).json({ error: 'Email tersebut sudah terdaftar.' });
    }
    const salt = randomBytes(16).toString('hex');
    const passwordHash = scryptSync(password, salt, 64).toString('hex');
    const id = createId('user');
    const createdAt = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        INSERT INTO users (id, full_name, email, role, password_hash, password_salt, created_at)
        VALUES (?, ?, ?, 'employee', ?, ?, ?)
      `).run(id, name.trim(), normalizedEmail, passwordHash, salt, createdAt);
      db.prepare('INSERT INTO terms_acceptance (id, user_id, version, accepted_at) VALUES (?, ?, ?, ?)')
        .run(createId('terms'), id, TERMS_VERSION, createdAt);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      if (error.code === 'ERR_SQLITE_CONSTRAINT_UNIQUE') {
        return response.status(409).json({ error: 'Email tersebut sudah terdaftar.' });
      }
      throw error;
    }
    return issueSession(db, request, response, id);
  });

  router.post('/auth/login', (request, response) => {
    const { email, password, accountType = 'user' } = request.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 256) {
      return response.status(400).json({ error: 'Masukkan email dan kata sandi yang valid.' });
    }
    if (!['user', 'admin'].includes(accountType)) {
      return response.status(400).json({ error: 'Jenis akun tidak valid.' });
    }

    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const attempt = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + 10 * 60 * 1000 };
    if (Date.now() > attempt.resetAt) {
      attempt.count = 0;
      attempt.resetAt = Date.now() + 10 * 60 * 1000;
    }
    if (attempt.count >= 10) return response.status(429).json({ error: 'Terlalu banyak percobaan masuk. Coba lagi dalam beberapa menit.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.trim().toLowerCase());
    const isValid = user
      ? verifyPassword(password, user.password_salt, user.password_hash)
      : verifyPassword(password, dummySalt, dummyPasswordHash);
    const expectedRole = accountType === 'admin' ? 'admin' : null;
    if (!user || !isValid || (expectedRole && user.role !== expectedRole) || (!expectedRole && user.role === 'admin')) {
      attempt.count += 1;
      loginAttempts.set(ip, attempt);
      return response.status(401).json({
        error: accountType === 'admin'
          ? 'Akun administrator tidak ditemukan atau kata sandi tidak sesuai.'
          : 'Email atau kata sandi pengguna tidak sesuai.',
      });
    }
    loginAttempts.delete(ip);
    return issueSession(db, request, response, user.id);
  });

  router.post('/auth/password-reset/request', async (request, response) => {
    const { email } = request.body || {};
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response.status(400).json({ error: 'Masukkan alamat email yang valid.' });
    }

    const configuredMailer = Boolean(
      process.env.RESEND_API_KEY
      && process.env.PASSWORD_RESET_FROM
      && process.env.APP_BASE_URL
    );
    if (configuredMailer) {
      try {
        const appUrl = new URL(process.env.APP_BASE_URL);
        if (process.env.NODE_ENV === 'production' && appUrl.protocol !== 'https:') {
          return response.status(503).json({ error: 'APP_BASE_URL harus menggunakan HTTPS untuk pemulihan kata sandi.' });
        }
      } catch {
        return response.status(503).json({ error: 'Konfigurasi APP_BASE_URL untuk pemulihan kata sandi tidak valid.' });
      }
    }
    if (process.env.NODE_ENV === 'production' && !configuredMailer) {
      return response.status(503).json({
        error: 'Pemulihan kata sandi belum dikonfigurasi. Hubungi administrator SEJIWA.',
      });
    }

    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const attempt = passwordResetAttempts.get(ip) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
    if (Date.now() > attempt.resetAt) {
      attempt.count = 0;
      attempt.resetAt = Date.now() + 15 * 60 * 1000;
    }
    if (attempt.count >= 5) {
      return response.status(429).json({ error: 'Terlalu banyak permintaan pemulihan. Coba lagi dalam beberapa menit.' });
    }
    attempt.count += 1;
    passwordResetAttempts.set(ip, attempt);

    const user = db.prepare('SELECT id, email FROM users WHERE email = ? AND active = 1')
      .get(email.trim().toLowerCase());
    let resetUrl;
    if (user) {
      const token = randomBytes(32).toString('base64url');
      const createdAt = now();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
        db.prepare(`
          INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at)
          VALUES (?, ?, ?, ?)
        `).run(tokenDigest(token), user.id, new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(), createdAt);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }

      const baseUrl = configuredMailer
        ? process.env.APP_BASE_URL
        : request.get('origin') || `http://${request.get('host')}`;
      const resetLink = new URL('/', baseUrl);
      resetLink.searchParams.set('resetToken', token);
      resetLink.hash = 'auth';
      resetUrl = resetLink.toString();

      if (configuredMailer) {
        let delivery;
        try {
          delivery = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.PASSWORD_RESET_FROM,
              to: [user.email],
              subject: 'Atur ulang kata sandi SEJIWA',
              html: `<p>Gunakan tautan berikut untuk mengatur ulang kata sandi SEJIWA Anda. Tautan berlaku selama 30 menit dan hanya dapat digunakan sekali.</p><p><a href="${resetUrl}">Atur ulang kata sandi</a></p><p>Jika Anda tidak meminta pemulihan ini, abaikan email ini.</p>`,
            }),
          });
        } catch (error) {
          db.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?').run(tokenDigest(token));
          console.error('Password reset email delivery failed:', error);
          return response.status(502).json({ error: 'Layanan email pemulihan belum dapat dijangkau. Coba kembali nanti.' });
        }
        if (!delivery.ok) {
          db.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?').run(tokenDigest(token));
          console.error('Password reset email delivery failed with HTTP status:', delivery.status);
          return response.status(502).json({ error: 'Email pemulihan belum dapat dikirim. Coba kembali nanti.' });
        }
      }
    }

    const result = { message: 'Jika email terdaftar, instruksi pemulihan akan dikirim.' };
    if (user && !configuredMailer && process.env.NODE_ENV !== 'production') result.resetUrl = resetUrl;
    return response.status(202).json(result);
  });

  router.post('/auth/password-reset/confirm', (request, response) => {
    const { token, password } = request.body || {};
    if (typeof token !== 'string' || token.length > 128
      || typeof password !== 'string' || password.length < 12 || password.length > 256) {
      return response.status(400).json({ error: 'Tautan pemulihan atau kata sandi tidak valid.' });
    }
    const tokenHash = tokenDigest(token);
    const reset = db.prepare(`
      SELECT user_id FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `).get(tokenHash, now());
    if (!reset) {
      return response.status(400).json({ error: 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.' });
    }

    const salt = randomBytes(16).toString('hex');
    const passwordHash = scryptSync(password, salt, 64).toString('hex');
    const resetAt = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      const used = db.prepare(`
        UPDATE password_reset_tokens SET used_at = ?
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
      `).run(resetAt, tokenHash, resetAt);
      if (!used.changes) {
        db.exec('ROLLBACK');
        return response.status(400).json({ error: 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.' });
      }
      const updated = db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ? AND active = 1')
        .run(passwordHash, salt, reset.user_id);
      if (!updated.changes) {
        db.exec('ROLLBACK');
        return response.status(400).json({ error: 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.' });
      }
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND token_hash != ?')
        .run(reset.user_id, tokenHash);
      audit(db, reset.user_id, 'user.password.reset', 'user', reset.user_id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return response.json({ message: 'Kata sandi berhasil diatur ulang. Silakan masuk kembali.' });
  });

  router.get('/auth/me', (request, response) => {
    if (!request.user) return response.json({ user: null, portal: 'public' });
    return response.json({ user: publicUser(request.user), portal: roleLanding(request.user.role) });
  });

  router.post('/auth/logout', (request, response) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenDigest(token));
    clearSessionCookie(response);
    return response.status(204).end();
  });

  router.get('/bootstrap', (request, response) => {
    if (!request.user) return response.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    const content = getPublicContent(db);
    const notifications = db.prepare(`
      SELECT id, title, body, read_at AS readAt, created_at AS createdAt
      FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(request.user.id);
    const result = {
      user: publicUser(request.user),
      portal: roleLanding(request.user.role),
      psychologists: content.psychologists,
      articles: content.articles,
      cases: getVisibleComplaints(db, request.user),
      threads: getVisibleConversations(db, request.user),
      notifications,
    };
    if (request.user.role === 'admin') {
      result.metrics = getAdminMetrics(db);
    }
    return response.json(result);
  });

  router.get('/complaints', (request, response) => {
    if (!request.user || !['employee', 'casemanager'].includes(request.user.role)) {
      return response.status(request.user ? 403 : 401).json({ error: 'Anda tidak memiliki akses ke data aduan.' });
    }
    return response.json({ complaints: getVisibleComplaints(db, request.user) });
  });

  router.post('/complaints', requireRole('employee'), (request, response) => {
    const { anonymous = false, category, department, description, termsAccepted } = request.body || {};
    if (typeof anonymous !== 'boolean'
      || termsAccepted !== true
      || !complaintCategories.has(category)
      || typeof department !== 'string'
      || department.trim().length < 2
      || department.trim().length > 100
      || typeof description !== 'string'
      || description.trim().length < 20
      || description.trim().length > 5000) {
      return response.status(400).json({ error: 'Setujui pemrosesan data dan periksa kategori, departemen, serta uraian aduan (20–5.000 karakter).' });
    }
    const year = new Date().getFullYear();
    const id = `CASE-${year}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const createdAt = now();
    const priority = ['Harassment', 'Burnout'].includes(category) ? 'High' : 'Medium';
    const manager = db.prepare(`
      SELECT id FROM users WHERE role = 'casemanager' AND active = 1 ORDER BY created_at LIMIT 1
    `).get();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        INSERT INTO complaints (
          id, reporter_user_id, anonymous, reporter_name, reporter_email, category, department,
          description, priority, status, assigned_case_manager_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?)
      `).run(
        id,
        request.user.id,
        anonymous ? 1 : 0,
        anonymous ? null : request.user.full_name,
        anonymous ? null : request.user.email,
        category,
        department.trim(),
        description.trim(),
        priority,
        manager?.id || null,
        createdAt,
        createdAt,
      );
      db.prepare(`
        INSERT INTO complaint_status_history (id, complaint_id, actor_user_id, status, note, created_at)
        VALUES (?, ?, ?, 'Open', 'Aduan diterima', ?)
      `).run(createId('case-event'), id, request.user.id, createdAt);
      if (manager) addNotification(db, manager.id, 'Aduan baru diterima', `Tiket ${id} menunggu peninjauan.`);
      audit(db, request.user.id, 'complaint.create', 'complaint', id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const complaint = getVisibleComplaints(db, request.user).find((item) => item.id === id);
    return response.status(201).json({ complaint });
  });

  router.post('/complaints/:id/claim', requireRole('casemanager'), (request, response) => {
    const result = db.prepare(`
      UPDATE complaints
      SET assigned_case_manager_id = ?, updated_at = ?
      WHERE id = ? AND assigned_case_manager_id IS NULL
    `).run(request.user.id, now(), request.params.id);
    if (!result.changes) {
      const alreadyAssigned = db.prepare(`
        SELECT id FROM complaints WHERE id = ? AND assigned_case_manager_id = ?
      `).get(request.params.id, request.user.id);
      if (!alreadyAssigned) return response.status(404).json({ error: 'Aduan tidak tersedia untuk ditugaskan.' });
    } else {
      const item = db.prepare('SELECT reporter_user_id FROM complaints WHERE id = ?').get(request.params.id);
      addNotification(db, item.reporter_user_id, 'Petugas ditugaskan', `Petugas telah menerima tiket ${request.params.id}.`);
      audit(db, request.user.id, 'complaint.claim', 'complaint', request.params.id);
    }
    const complaint = getVisibleComplaints(db, request.user).find((item) => item.id === request.params.id);
    return response.json({ complaint });
  });

  router.patch('/complaints/:id/status', requireRole('casemanager'), (request, response) => {
    const { status, note = '' } = request.body || {};
    if (!complaintStatuses.has(status) || typeof note !== 'string' || note.length > 500) {
      return response.status(400).json({ error: 'Status atau catatan penanganan tidak valid.' });
    }
    const item = db.prepare(`
      SELECT * FROM complaints WHERE id = ? AND assigned_case_manager_id = ?
    `).get(request.params.id, request.user.id);
    if (!item) return response.status(404).json({ error: 'Aduan tidak ditemukan atau bukan tanggung jawab Anda.' });
    const createdAt = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?').run(status, createdAt, item.id);
      db.prepare(`
        INSERT INTO complaint_status_history (id, complaint_id, actor_user_id, status, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(createId('case-event'), item.id, request.user.id, status, note.trim() || `Status diperbarui: ${sessionStatuses.get(status)}`, createdAt);
      addNotification(db, item.reporter_user_id, 'Perkembangan aduan', `Status tiket ${item.id}: ${sessionStatuses.get(status)}.`);
      audit(db, request.user.id, 'complaint.status.update', 'complaint', item.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const updated = db.prepare(`
      SELECT c.*, u.full_name AS assigned_name FROM complaints c
      LEFT JOIN users u ON u.id = c.assigned_case_manager_id WHERE c.id = ?
    `).get(item.id);
    return response.json({ complaint: toComplaint(db, updated, request.user.role) });
  });

  router.post('/conversations', requireRole('employee'), (request, response) => {
    const psychologistId = request.body?.psychologistId;
    if (typeof psychologistId !== 'string') return response.status(400).json({ error: 'Pilih profil yang tersedia.' });
    const profile = db.prepare("SELECT id FROM psychologists WHERE id = ? AND active = 1 AND json_extract(data_json, '$.acceptingClients') = 1")
      .get(psychologistId);
    if (!profile) return response.status(404).json({ error: 'Profil tidak ditemukan atau belum menerima percakapan baru.' });
    const existing = db.prepare(`
      SELECT id FROM conversations WHERE employee_user_id = ? AND psychologist_id = ?
    `).get(request.user.id, psychologistId);
    if (existing) return response.json({ conversationId: existing.id, threads: getVisibleConversations(db, request.user) });

    const conversationId = createId('conversation');
    db.prepare(`
      INSERT INTO conversations (id, employee_user_id, psychologist_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(conversationId, request.user.id, psychologistId, now());
    const psychologist = db.prepare('SELECT user_id FROM psychologists WHERE id = ?').get(psychologistId);
    if (psychologist?.user_id) addNotification(db, psychologist.user_id, 'Percakapan konseling baru', 'Seorang karyawan memulai percakapan baru.');
    return response.status(201).json({ conversationId, threads: getVisibleConversations(db, request.user) });
  });

  router.post('/conversations/:id/read', (request, response) => {
    if (!request.user || !['employee', 'psychologist'].includes(request.user.role)) {
      return response.status(request.user ? 403 : 401).json({ error: 'Anda tidak memiliki akses ke percakapan.' });
    }
    const conversation = db.prepare(`
      SELECT c.employee_user_id, p.user_id AS psychologist_user_id
      FROM conversations c JOIN psychologists p ON p.id = c.psychologist_id
      WHERE c.id = ?
    `).get(request.params.id);
    if (!conversation
      || (request.user.role === 'employee' && conversation.employee_user_id !== request.user.id)
      || (request.user.role === 'psychologist' && conversation.psychologist_user_id !== request.user.id)) {
      return response.status(404).json({ error: 'Percakapan tidak ditemukan.' });
    }
    const readAt = now();
    db.prepare(`
      UPDATE messages SET read_at = ?
      WHERE conversation_id = ? AND sender_user_id != ? AND read_at IS NULL
    `).run(readAt, request.params.id, request.user.id);
    return response.json({ readAt });
  });

  router.post('/conversations/:id/messages', (request, response) => {
    if (!request.user || !['employee', 'psychologist'].includes(request.user.role)) {
      return response.status(request.user ? 403 : 401).json({ error: 'Anda tidak memiliki akses ke percakapan.' });
    }
    const body = request.body?.text;
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 4000) {
      return response.status(400).json({ error: 'Pesan wajib diisi dan maksimal 4.000 karakter.' });
    }
    const conversation = db.prepare(`
      SELECT c.id, c.employee_user_id, p.user_id AS psychologist_user_id
      FROM conversations c JOIN psychologists p ON p.id = c.psychologist_id
      WHERE c.id = ?
    `).get(request.params.id);
    if (!conversation
      || (request.user.role === 'employee' && conversation.employee_user_id !== request.user.id)
      || (request.user.role === 'psychologist' && conversation.psychologist_user_id !== request.user.id)) {
      return response.status(404).json({ error: 'Percakapan tidak ditemukan.' });
    }
    const createdAt = now();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(createId('message'), conversation.id, request.user.id, body.trim(), createdAt);
    const recipient = request.user.role === 'employee'
      ? conversation.psychologist_user_id
      : conversation.employee_user_id;
    if (recipient) addNotification(db, recipient, 'Pesan baru', 'Anda menerima pesan di percakapan konseling.');
    return response.status(201).json({ threads: getVisibleConversations(db, request.user) });
  });

  router.post('/notifications/:id/read', (request, response) => {
    if (!request.user) return response.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    const result = db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?')
      .run(now(), request.params.id, request.user.id);
    if (!result.changes) return response.status(404).json({ error: 'Notifikasi tidak ditemukan.' });
    return response.status(204).end();
  });

  router.patch('/profile', requireRole('employee', 'psychologist', 'casemanager', 'admin'), (request, response) => {
    const { name, department = '', position = '' } = request.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120
      || typeof department !== 'string' || department.length > 100
      || typeof position !== 'string' || position.length > 100) {
      return response.status(400).json({ error: 'Periksa kembali nama, departemen, dan posisi.' });
    }
    db.prepare('UPDATE users SET full_name = ?, department = ?, position = ? WHERE id = ?')
      .run(name.trim(), department.trim(), position.trim(), request.user.id);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id);
    return response.json({ user: publicUser(updated) });
  });

  router.get('/admin/overview', requireRole('admin'), (_request, response) => response.json(getAdminMetrics(db)));
  router.get('/admin/psychologists', requireRole('admin'), (_request, response) => {
    const profiles = db.prepare(`
      SELECT id, data_json, active, verified FROM psychologists ORDER BY id
    `).all().map((item) => ({
      ...JSON.parse(item.data_json),
      active: Boolean(item.active),
      verified: Boolean(item.verified),
    }));
    return response.json({ psychologists: profiles });
  });
  router.patch('/admin/psychologists/:id', requireRole('admin'), (request, response) => {
    const { active, acceptingClients } = request.body || {};
    if (typeof active !== 'boolean' || typeof acceptingClients !== 'boolean') {
      return response.status(400).json({ error: 'Status profil tidak valid.' });
    }
    const existing = db.prepare('SELECT data_json FROM psychologists WHERE id = ?').get(request.params.id);
    if (!existing) return response.status(404).json({ error: 'Profil tidak ditemukan.' });
    const profile = JSON.parse(existing.data_json);
    profile.acceptingClients = active && acceptingClients;
    db.prepare('UPDATE psychologists SET data_json = ?, active = ? WHERE id = ?')
      .run(JSON.stringify(profile), Number(active), request.params.id);
    audit(db, request.user.id, 'psychologist.profile.update', 'psychologist', request.params.id);
    return response.json({ psychologist: { ...profile, active, verified: false } });
  });
  router.get('/admin/articles', requireRole('admin'), (_request, response) => {
    const records = db.prepare('SELECT id, data_json, published FROM articles ORDER BY created_at DESC').all()
      .map((item) => ({ ...JSON.parse(item.data_json), published: Boolean(item.published) }));
    return response.json({ articles: records });
  });
  router.post('/admin/articles', requireRole('admin'), (request, response) => {
    const parsed = validateArticle(request.body);
    if (!parsed) return response.status(400).json({ error: 'Periksa judul, kategori, ringkasan, dan isi artikel.' });
    const article = { ...parsed, id: createId('article') };
    const createdAt = now();
    db.prepare('INSERT INTO articles (id, data_json, published, created_at) VALUES (?, ?, ?, ?)')
      .run(article.id, JSON.stringify(article), Number(parsed.published), createdAt);
    audit(db, request.user.id, 'article.create', 'article', article.id);
    return response.status(201).json({ article });
  });
  router.put('/admin/articles/:id', requireRole('admin'), (request, response) => {
    const parsed = validateArticle(request.body);
    if (!parsed) return response.status(400).json({ error: 'Periksa judul, kategori, ringkasan, dan isi artikel.' });
    const existing = db.prepare('SELECT id FROM articles WHERE id = ?').get(request.params.id);
    if (!existing) return response.status(404).json({ error: 'Artikel tidak ditemukan.' });
    const article = { ...parsed, id: request.params.id };
    db.prepare('UPDATE articles SET data_json = ?, published = ? WHERE id = ?')
      .run(JSON.stringify(article), Number(parsed.published), article.id);
    audit(db, request.user.id, 'article.update', 'article', article.id);
    return response.json({ article });
  });
  router.delete('/admin/articles/:id', requireRole('admin'), (request, response) => {
    const result = db.prepare('DELETE FROM articles WHERE id = ?').run(request.params.id);
    if (!result.changes) return response.status(404).json({ error: 'Artikel tidak ditemukan.' });
    audit(db, request.user.id, 'article.delete', 'article', request.params.id);
    return response.status(204).end();
  });
  router.get('/admin/users', requireRole('admin'), (_request, response) => {
    const users = db.prepare(`
      SELECT id, full_name AS name, email, role, department, position, active, created_at AS createdAt
      FROM users ORDER BY created_at DESC
    `).all();
    response.json({ users });
  });
  router.get('/admin/audit', requireRole('admin'), (_request, response) => {
    const entries = db.prepare(`
      SELECT a.id, u.full_name AS actor, u.role, a.action, a.target_type, a.target_id, a.created_at
      FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
      ORDER BY a.created_at DESC LIMIT 200
    `).all().map((entry) => ({
      id: entry.id,
      actor: entry.actor || 'Akun sistem',
      role: entry.role || 'SYSTEM',
      action: entry.action,
      target: `${entry.target_type}:${entry.target_id}`,
      timestamp: entry.created_at,
      outcome: 'Verified',
    }));
    return response.json({ entries });
  });
  router.patch('/admin/users/:id/active', requireRole('admin'), (request, response) => {
    if (typeof request.body?.active !== 'boolean') return response.status(400).json({ error: 'Status akun tidak valid.' });
    if (request.params.id === request.user.id && !request.body.active) {
      return response.status(400).json({ error: 'Akun administrator yang sedang digunakan tidak dapat dinonaktifkan.' });
    }
    const result = db.prepare('UPDATE users SET active = ? WHERE id = ?').run(request.body.active ? 1 : 0, request.params.id);
    if (!result.changes) return response.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    if (!request.body.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(request.params.id);
    audit(db, request.user.id, request.body.active ? 'user.enable' : 'user.disable', 'user', request.params.id);
    return response.status(204).end();
  });

  router.use((error, _request, response, _next) => {
    console.error('API request failed:', error);
    if (response.headersSent) return;
    response.status(500).json({ error: 'Terjadi gangguan pada layanan. Silakan coba kembali.' });
  });

  return router;
}

function issueSession(db, _request, response, userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenDigest(token), userId, expiresAt, now());
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  setSessionCookie(response, token, Math.floor(SESSION_TTL_MS / 1000));
  return response.status(200).json({ user: publicUser(user), portal: roleLanding(user.role) });
}

function getAdminMetrics(db) {
  const userCounts = db.prepare(`
    SELECT
      COUNT(*) AS totalUsers,
      SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) AS employees,
      SUM(CASE WHEN role = 'psychologist' THEN 1 ELSE 0 END) AS psychologists,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS activeUsers
    FROM users
  `).get();
  const complaintCounts = db.prepare(`
    SELECT status, COUNT(*) AS count FROM complaints GROUP BY status
  `).all();
  const articleCount = db.prepare('SELECT COUNT(*) AS count FROM articles WHERE published = 1').get().count;
  return {
    users: userCounts,
    articles: articleCount,
    complaints: Object.fromEntries(complaintCounts.map((item) => [item.status, item.count])),
  };
}

function validateArticle(input) {
  if (!input || typeof input !== 'object') return null;
  const { title, category, author, published, excerpt, body, readMinutes, image } = input;
  if (typeof title !== 'string' || title.trim().length < 5 || title.trim().length > 180
    || typeof category !== 'string' || !category.trim() || category.trim().length > 80
    || typeof author !== 'string' || !author.trim() || author.trim().length > 120
    || typeof excerpt !== 'string' || excerpt.trim().length < 10 || excerpt.trim().length > 600
    || !Array.isArray(body) || body.length < 1 || body.length > 30
    || body.some((paragraph) => typeof paragraph !== 'string' || paragraph.trim().length < 10 || paragraph.length > 5000)
    || !Number.isInteger(readMinutes) || readMinutes < 1 || readMinutes > 60
    || typeof published !== 'boolean') return null;
  const safeImage = typeof image === 'string' && /^\/src\/assets\/images\/[a-zA-Z0-9._-]+$/.test(image)
    ? image
    : '/src/assets/images/mindfulness_wellness_calm_1794817431229.jpg';
  return {
    title: title.trim(),
    category: category.trim(),
    author: author.trim(),
    publishedDate: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date()),
    excerpt: excerpt.trim(),
    body: body.map((paragraph) => paragraph.trim()),
    readMinutes,
    image: safeImage,
    published,
  };
}
