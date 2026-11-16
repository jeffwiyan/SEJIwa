import type {
  CasePriority,
  CaseStatus,
  ComplaintCase,
  Psychologist,
} from '../types/sejiwa';

export interface PsychologistFilterOptions {
  searchQuery: string;
  sessionType: 'All' | 'Online' | 'Offline';
  area: string;
  acceptingOnly: boolean;
}

export function filterPsychologists(
  list: Psychologist[],
  filters: PsychologistFilterOptions
): Psychologist[] {
  const q = filters.searchQuery.trim().toLowerCase();
  return list.filter((p) => {
    if (filters.acceptingOnly && !p.acceptingClients) {
      return false;
    }
    if (filters.sessionType !== 'All' && !p.sessionTypes.includes(filters.sessionType)) {
      return false;
    }
    if (filters.area !== 'All' && !p.areas.some((a) => a.toLowerCase() === filters.area.toLowerCase())) {
      return false;
    }
    if (q) {
      const haystack = `${p.name} ${p.credentials} ${p.specialty} ${p.areas.join(' ')} ${p.location}`.toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

export interface CaseFilterOptions {
  searchQuery: string;
  caseType: string;
  priorities: CasePriority[];
  statuses: CaseStatus[];
  sortBy: 'dueDate' | 'priority' | 'events';
}

const PRIORITY_RANK: Record<CasePriority, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export function filterAndSortCases(
  cases: ComplaintCase[],
  filters: CaseFilterOptions
): ComplaintCase[] {
  const q = filters.searchQuery.trim().toLowerCase();
  const filtered = cases.filter((item) => {
    if (filters.caseType !== 'All' && item.type !== filters.caseType) {
      return false;
    }
    if (filters.priorities.length > 0 && !filters.priorities.includes(item.priority)) {
      return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) {
      return false;
    }
    if (q) {
      const text = `${item.id} ${item.title} ${item.type} ${item.owner} ${item.department}`.toLowerCase();
      if (!text.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sortBy === 'priority') {
      return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    }
    if (filters.sortBy === 'events') {
      return b.eventsCount - a.eventsCount;
    }
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export interface ComplaintDraft {
  reporterName: string;
  reporterEmail: string;
  anonymous: boolean;
  category: ComplaintCase['type'];
  department: string;
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<'reporterName' | 'reporterEmail' | 'description', string>>;
}

export function validateComplaintDraft(draft: ComplaintDraft): ValidationResult {
  const errors: ValidationResult['errors'] = {};

  if (!draft.anonymous && draft.reporterName.trim().length < 2) {
    errors.reporterName = 'Masukkan nama lengkap atau pilih kirim secara anonim.';
  }

  const emailTrimmed = draft.reporterEmail.trim();
  if (!draft.anonymous) {
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.reporterEmail = 'Masukkan alamat email kantor atau pribadi yang valid.';
    }
  } else if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    errors.reporterEmail = 'Format email tidak valid.';
  }

  if (draft.description.trim().length < 20) {
    errors.description = 'Ceritakan kronologi atau keluhan minimal 20 karakter agar tim dapat menindaklanjuti dengan tepat.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function createCaseFromComplaint(
  draft: ComplaintDraft,
  existingCount: number
): ComplaintCase {
  const nextSeq = 143 + existingCount;
  const id = `CASE-2026-0${nextSeq}`;
  const priority: CasePriority =
    draft.category === 'Harassment' || draft.category === 'Burnout' ? 'High' : 'Medium';

  return {
    id,
    title: `${draft.category} — ${draft.department || 'Divisi Umum'}`,
    type: draft.category,
    department: draft.department || 'Divisi Umum',
    reporterName: draft.anonymous ? 'Pelapor Anonim' : draft.reporterName.trim(),
    reporterEmail: draft.anonymous ? 'terenkripsi@sejiwa.id' : draft.reporterEmail.trim(),
    owner: 'Nadia Kusuma',
    priority,
    status: 'Open',
    dueDate: '2026-11-23',
    createdDate: '2026-11-16',
    eventsCount: 2,
    summary: draft.description.trim(),
    nextAction: 'Tinjau laporan awal dan jadwalkan sesi klarifikasi empatik.',
    timeline: [
      { id: 't1', label: 'Aduan Diterima', date: '16 Nov 2026', state: 'done' },
      { id: 't2', label: 'Enkripsi & Verifikasi Awal', date: '16 Nov 2026', state: 'done' },
      { id: 't3', label: 'Penugasan Case Manager', date: 'Menunggu', state: 'pending' },
    ],
  };
}

export function summarizeCaseCounts(cases: ComplaintCase[]) {
  return {
    total: cases.length,
    highPriority: cases.filter((c) => c.priority === 'High').length,
    openOrReview: cases.filter((c) => c.status === 'Open' || c.status === 'Under Review').length,
    escalated: cases.filter((c) => c.status === 'Escalated').length,
    closed: cases.filter((c) => c.status === 'Closed').length,
  };
}
