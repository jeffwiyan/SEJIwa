import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCaseFromComplaint,
  filterAndSortCases,
  filterPsychologists,
  summarizeCaseCounts,
  validateComplaintDraft,
} from './sejiwaLogic';
import type { ComplaintCase, Psychologist } from '../types/sejiwa';

const SAMPLE_PSYCHOLOGISTS: Psychologist[] = [
  {
    id: 'p1',
    name: 'Dr. Rania Putri, M.Psi.',
    credentials: 'Psikolog Klinis Dewasa · SIPP 1104',
    specialty: 'Kecemasan & Burnout Kerja',
    areas: ['Stres', 'Pekerjaan & Karir'],
    sessionTypes: ['Online', 'Offline'],
    languages: ['Indonesia', 'English'],
    location: 'Jakarta Selatan',
    experienceYears: 8,
    nextAvailable: 'Besok, 10:00 WIB',
    acceptingClients: true,
    rating: '4.9',
    bio: 'Pendekatan CBT dan mindfulness.',
    image: '/img1.jpg',
  },
  {
    id: 'p2',
    name: 'Bima Prakoso, M.Psi.',
    credentials: 'Psikolog Organisasi · SIPP 2089',
    specialty: 'Konflik Tim & Relasi',
    areas: ['Keluarga & Hubungan'],
    sessionTypes: ['Offline'],
    languages: ['Indonesia'],
    location: 'Bandung',
    experienceYears: 6,
    nextAvailable: 'Kamis, 14:00 WIB',
    acceptingClients: false,
    rating: '4.8',
    bio: 'Fokus dinamika hubungan.',
    image: '/img2.jpg',
  },
];

const SAMPLE_CASES: ComplaintCase[] = [
  {
    id: 'CASE-2026-0142',
    title: 'Beban Lembur Berkelanjutan',
    type: 'Burnout',
    department: 'Customer Support',
    reporterName: 'Pelapor Anonim',
    reporterEmail: 'terenkripsi@sejiwa.id',
    owner: 'Nadia Kusuma',
    priority: 'High',
    status: 'Under Review',
    dueDate: '2026-11-20',
    createdDate: '2026-11-12',
    eventsCount: 12,
    summary: 'Laporan kelelahan kerja.',
    nextAction: 'Audit shift kerja.',
    timeline: [],
  },
  {
    id: 'CASE-2026-0141',
    title: 'Mediasi Konflik Lintas Tim',
    type: 'Interpersonal',
    department: 'Product Design',
    reporterName: 'Arif Wijaya',
    reporterEmail: 'arif@company.id',
    owner: 'Raka Pratama',
    priority: 'Low',
    status: 'Closed',
    dueDate: '2026-11-18',
    createdDate: '2026-11-01',
    eventsCount: 8,
    summary: 'Konflik komunikasi selesai dimediasi.',
    nextAction: 'Arsip selesai.',
    timeline: [],
  },
];

test('filterPsychologists filters by sessionType, area, and searchQuery', () => {
  const onlineOnly = filterPsychologists(SAMPLE_PSYCHOLOGISTS, {
    searchQuery: '',
    sessionType: 'Online',
    area: 'All',
    acceptingOnly: false,
  });
  assert.equal(onlineOnly.length, 1);
  assert.equal(onlineOnly[0].id, 'p1');

  const searchBima = filterPsychologists(SAMPLE_PSYCHOLOGISTS, {
    searchQuery: 'Bandung',
    sessionType: 'All',
    area: 'All',
    acceptingOnly: false,
  });
  assert.equal(searchBima.length, 1);
  assert.equal(searchBima[0].id, 'p2');
});

test('validateComplaintDraft rejects short description and invalid email unless anonymous', () => {
  const invalid = validateComplaintDraft({
    reporterName: '',
    reporterEmail: 'bukan-email',
    anonymous: false,
    category: 'Burnout',
    department: 'Engineering',
    description: 'Terlalu singkat',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.reporterName);
  assert.ok(invalid.errors.reporterEmail);
  assert.ok(invalid.errors.description);

  const validAnon = validateComplaintDraft({
    reporterName: '',
    reporterEmail: '',
    anonymous: true,
    category: 'Burnout',
    department: 'Engineering',
    description: 'Beban kerja tiga minggu terakhir melebihi kapasitas tim kami secara konsisten.',
  });
  assert.equal(validAnon.valid, true);
});

test('createCaseFromComplaint generates sequential case ID and High priority for Harassment/Burnout', () => {
  const created = createCaseFromComplaint(
    {
      reporterName: 'Sinta Dewi',
      reporterEmail: 'sinta@perusahaan.id',
      anonymous: false,
      category: 'Harassment',
      department: 'Operasional',
      description: 'Terdapat perilaku verbal yang tidak pantas berulang kali di ruang rapat mingguan.',
    },
    2
  );
  assert.equal(created.id, 'CASE-2026-0145');
  assert.equal(created.priority, 'High');
  assert.equal(created.status, 'Open');
});

test('filterAndSortCases and summarizeCaseCounts compute accurate totals', () => {
  const highOnly = filterAndSortCases(SAMPLE_CASES, {
    searchQuery: '',
    caseType: 'All',
    priorities: ['High'],
    statuses: [],
    sortBy: 'priority',
  });
  assert.equal(highOnly.length, 1);
  assert.equal(highOnly[0].id, 'CASE-2026-0142');

  const summary = summarizeCaseCounts(SAMPLE_CASES);
  assert.equal(summary.total, 2);
  assert.equal(summary.highPriority, 1);
  assert.equal(summary.closed, 1);
});
