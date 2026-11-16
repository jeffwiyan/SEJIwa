import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const demoPsychologists = [
  {
    id: 'psy-1',
    name: 'Rania Putri (Demo)',
    credentials: 'Profil ilustrasi · bukan tenaga profesional nyata',
    specialty: 'Kecemasan, burnout kerja & regulasi emosi',
    areas: ['Stres', 'Pekerjaan & Karir', 'Gangguan Mood'],
    sessionTypes: ['Online', 'Offline'],
    languages: ['Indonesia', 'English'],
    location: 'Jakarta Selatan',
    experienceYears: 0,
    nextAvailable: 'Jadwal belum dikonfigurasi',
    acceptingClients: true,
    rating: '-',
    bio: 'Profil demonstrasi untuk menguji tampilan. Kredensial dan layanan profesional belum diverifikasi.',
    image: '/src/assets/images/psychologist_avatar_1_1794817430188.jpg',
  },
  {
    id: 'psy-2',
    name: 'Bima Prakoso (Demo)',
    credentials: 'Profil ilustrasi · bukan tenaga profesional nyata',
    specialty: 'Stres organisasi & komunikasi tim',
    areas: ['Pekerjaan & Karir', 'Keluarga & Hubungan', 'Stres'],
    sessionTypes: ['Online', 'Offline'],
    languages: ['Indonesia'],
    location: 'Jakarta Pusat',
    experienceYears: 0,
    nextAvailable: 'Jadwal belum dikonfigurasi',
    acceptingClients: true,
    rating: '-',
    bio: 'Profil demonstrasi untuk menguji tampilan. Kredensial dan layanan profesional belum diverifikasi.',
    image: '/src/assets/images/psychologist_avatar_2_1794817431580.jpg',
  },
  {
    id: 'psy-3',
    name: 'Nadine Larasati (Demo)',
    credentials: 'Profil ilustrasi · bukan tenaga profesional nyata',
    specialty: 'Dukungan emosional & relasi',
    areas: ['Trauma', 'Depresi', 'Keluarga & Hubungan'],
    sessionTypes: ['Online'],
    languages: ['Indonesia'],
    location: 'Daring',
    experienceYears: 0,
    nextAvailable: 'Jadwal belum dikonfigurasi',
    acceptingClients: true,
    rating: '-',
    bio: 'Profil demonstrasi untuk menguji tampilan. Kredensial dan layanan profesional belum diverifikasi.',
    image: '/src/assets/images/counseling_session_portrait_1794817429897.jpg',
  },
  {
    id: 'psy-4',
    name: 'Arga Wijaya (Demo)',
    credentials: 'Profil ilustrasi · bukan tenaga profesional nyata',
    specialty: 'Keseimbangan hidup & kebiasaan sehat',
    areas: ['Stres', 'Gangguan Mood', 'Pekerjaan & Karir'],
    sessionTypes: ['Offline'],
    languages: ['Indonesia'],
    location: 'Bandung',
    experienceYears: 0,
    nextAvailable: 'Jadwal belum dikonfigurasi',
    acceptingClients: false,
    rating: '-',
    bio: 'Profil demonstrasi untuk menguji tampilan. Kredensial dan layanan profesional belum diverifikasi.',
    image: '/src/assets/images/mindfulness_wellness_calm_1794817431229.jpg',
  },
  {
    id: 'psy-5',
    name: 'Dara Maheswari (Demo)',
    credentials: 'Profil ilustrasi · bukan tenaga profesional nyata',
    specialty: 'Pengelolaan emosi & tekanan kerja',
    areas: ['Stres', 'Pekerjaan & Karir'],
    sessionTypes: ['Online'],
    languages: ['Indonesia'],
    location: 'Daring',
    experienceYears: 0,
    nextAvailable: 'Jadwal belum dikonfigurasi',
    acceptingClients: true,
    rating: '-',
    bio: 'Profil demonstrasi untuk menguji tampilan. Kredensial dan layanan profesional belum diverifikasi.',
    image: '/src/assets/images/psychologist_avatar_1_1794817430188.jpg',
  },
];

const demoArticles = [
  {
    id: 'art-burnout',
    title: 'Mengenali Kelelahan Kerja dan Kapan Perlu Beristirahat',
    category: 'Burnout',
    author: 'Tim Edukasi SEJIWA (Demo)',
    publishedDate: '16 Nov 2026',
    readMinutes: 5,
    excerpt: 'Memahami perbedaan lelah sehari-hari dan tekanan berkepanjangan, tanpa mendiagnosis diri sendiri.',
    body: [
      'Kelelahan setelah bekerja dapat membaik setelah istirahat. Bila tekanan terasa menetap, mengganggu rutinitas, atau sulit pulih, itu dapat menjadi tanda untuk meninjau kembali beban dan dukungan yang tersedia.',
      'Cobalah mencatat sumber tekanan, mendiskusikan kapasitas kerja dengan orang yang dipercaya, dan memberi ruang untuk jeda yang teratur. Tidak ada satu cara yang cocok untuk semua orang.',
      'Artikel ini bersifat edukatif dan bukan diagnosis atau pengganti konsultasi dengan tenaga profesional.',
    ],
    image: '/src/assets/images/mindfulness_wellness_calm_1794817431229.jpg',
  },
  {
    id: 'art-grounding',
    title: 'Latihan Grounding Singkat Saat Tekanan Meningkat',
    category: 'Stres Kerja',
    author: 'Tim Edukasi SEJIWA (Demo)',
    publishedDate: '16 Nov 2026',
    readMinutes: 4,
    excerpt: 'Latihan sederhana untuk mengembalikan perhatian pada keadaan saat ini ketika Anda merasa kewalahan.',
    body: [
      'Berhenti sejenak dan rasakan kedua kaki menyentuh lantai. Tarik napas dengan nyaman, lalu perhatikan beberapa benda yang terlihat dan suara yang terdengar di sekitar.',
      'Latihan ini bukan solusi untuk semua situasi. Anda dapat berhenti kapan saja dan memilih cara lain yang terasa aman.',
      'Jika tekanan mengganggu keseharian, pertimbangkan berbicara dengan tenaga profesional yang kredensialnya sudah diverifikasi.',
    ],
    image: '/src/assets/images/hero_sejiwa_nature_1794817428941.jpg',
  },
  {
    id: 'art-boundaries',
    title: 'Menjaga Batas Kerja dan Waktu Pribadi',
    category: 'Work-Life Balance',
    author: 'Tim Edukasi SEJIWA (Demo)',
    publishedDate: '16 Nov 2026',
    readMinutes: 6,
    excerpt: 'Beberapa langkah komunikasi yang dapat membantu membuat ekspektasi kerja lebih jelas.',
    body: [
      'Batas kerja membantu memperjelas waktu dan kapasitas yang tersedia. Mulailah dengan menyepakati prioritas, waktu respons, serta jalur eskalasi dengan tim.',
      'Jika memungkinkan, sampaikan kebutuhan secara spesifik dan tawarkan pilihan yang realistis. Budaya kerja yang sehat juga memerlukan dukungan organisasi, bukan hanya upaya individu.',
      'Materi ini merupakan edukasi umum, bukan nasihat klinis atau hukum.',
    ],
    image: '/src/assets/images/counseling_session_portrait_1794817429897.jpg',
  },
];

function isoNow() {
  return new Date().toISOString();
}

export function createDatabase(databasePath = process.env.DATABASE_PATH || './data/sejiwa.sqlite') {
  const resolvedPath = databasePath === ':memory:' ? databasePath : path.resolve(databasePath);
  if (resolvedPath !== ':memory:') fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const db = new DatabaseSync(resolvedPath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  runMigrations(db);

  seedContent(db);
  seedDemoUsers(db);
  return db;
}

function runMigrations(db) {
  const migrationDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
  const applied = db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name);
  const record = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');

  for (const name of fs.readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')).sort()) {
    if (applied.includes(name)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(fs.readFileSync(path.join(migrationDirectory, name), 'utf8'));
      record.run(name, isoNow());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

function seedContent(db) {
  const marker = 'demo-content-v1';
  if (db.prepare('SELECT name FROM seed_markers WHERE name = ?').get(marker)) return;
  const addPsychologist = db.prepare(`
    INSERT OR IGNORE INTO psychologists (id, data_json, active, verified, created_at)
    VALUES (?, ?, 1, 0, ?)
  `);
  for (const profile of demoPsychologists) {
    addPsychologist.run(profile.id, JSON.stringify(profile), isoNow());
  }
  const addArticle = db.prepare(`
    INSERT OR IGNORE INTO articles (id, data_json, published, created_at) VALUES (?, ?, 1, ?)
  `);
  for (const article of demoArticles) {
    addArticle.run(article.id, JSON.stringify(article), isoNow());
  }
  db.prepare('INSERT INTO seed_markers (name, applied_at) VALUES (?, ?)')
    .run(marker, isoNow());
}

function seedDemoUsers(db) {
  const configurations = [
    ['DEMO_EMPLOYEE', 'Karyawan SEJIWA (Demo)', 'employee'],
    ['DEMO_PSYCHOLOGIST', 'Psikolog SEJIWA (Demo)', 'psychologist'],
    ['DEMO_CASE_MANAGER', 'Petugas Aduan SEJIWA (Demo)', 'casemanager'],
    ['DEMO_ADMIN', 'Administrator SEJIWA (Demo)', 'admin'],
  ];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO users (id, full_name, email, role, password_hash, password_salt, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateDemoUser = db.prepare(`
    UPDATE users SET full_name = ?, email = ?, password_hash = ?, password_salt = ?, active = 1
    WHERE id = ? AND role = ?
  `);
  const firstPsychologist = db.prepare('SELECT id FROM psychologists WHERE id = ?');
  for (const [prefix, defaultName, role] of configurations) {
    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];
    if (!email || !password || password.length < 12) continue;

    const id = `demo-${role}`;
    const salt = randomBytes(16).toString('hex');
    const passwordHash = scryptSync(password, salt, 64).toString('hex');
    const name = process.env[`${prefix}_NAME`] || defaultName;
    const normalizedEmail = email.trim().toLowerCase();
    const emailOwner = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (emailOwner && emailOwner.id !== id) {
      throw new Error(`Configured ${role} email is already assigned to another account.`);
    }
    const existing = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(id, role);
    if (existing) {
      updateDemoUser.run(name, normalizedEmail, passwordHash, salt, id, role);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    } else {
      insert.run(id, name, normalizedEmail, role, passwordHash, salt, isoNow());
    }
    if (role === 'psychologist') {
      const profile = firstPsychologist.get('psy-1');
      if (profile) {
        db.prepare('UPDATE psychologists SET user_id = ? WHERE id = ? AND user_id IS NULL').run(id, profile.id);
      }
    }
  }
}

export function getPublicContent(db) {
  const psychologists = db.prepare('SELECT data_json FROM psychologists WHERE active = 1 ORDER BY id').all()
    .map((row) => JSON.parse(row.data_json));
  const articles = db.prepare('SELECT data_json FROM articles WHERE published = 1 ORDER BY created_at DESC').all()
    .map((row) => JSON.parse(row.data_json));
  return { psychologists, articles };
}

export function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}
