import { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileSearch,
  FolderOpen,
  Inbox,
  LayoutGrid,
  Search,
  X,
} from 'lucide-react';
import type {
  CaseManagerView,
  CasePriority,
  CaseStatus,
  ComplaintCase,
  PortalMode,
} from '../../types/sejiwa';
import { filterAndSortCases, summarizeCaseCounts } from '../../utils/sejiwaLogic';
import type { AuthUser } from '../../services/api';

interface CaseManagerPortalProps {
  cases: ComplaintCase[];
  user: AuthUser;
  onClaimCase: (caseId: string) => void;
  onUpdateCaseStatus: (caseId: string, newStatus: CaseStatus) => void;
  onSwitchPortal: (portal: PortalMode) => void;
}

export function CaseManagerPortal({
  cases,
  user,
  onClaimCase,
  onUpdateCaseStatus,
  onSwitchPortal,
}: CaseManagerPortalProps) {
  const [activeView, setActiveView] = useState<CaseManagerView>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [caseType, setCaseType] = useState<string>('All');
  const [selectedPriorities, setSelectedPriorities] = useState<CasePriority[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<CaseStatus[]>([]);
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'events'>('priority');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');

  const summary = summarizeCaseCounts(cases);

  const visibleCases = filterAndSortCases(cases, {
    searchQuery,
    caseType,
    priorities: selectedPriorities,
    statuses: selectedStatuses,
    sortBy,
  });

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || visibleCases[0] || null;

  const togglePriority = (priority: CasePriority) => {
    setSelectedPriorities((prev) =>
      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
    );
  };

  const toggleStatus = (status: CaseStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const resetFilters = () => {
    setSearchQuery('');
    setCaseType('All');
    setSelectedPriorities([]);
    setSelectedStatuses([]);
  };

  const navItems: { id: CaseManagerView; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'dashboard', label: 'Case Dashboard', icon: LayoutGrid },
    { id: 'intakes', label: 'Aduan Masuk', icon: Inbox },
    { id: 'investigations', label: 'Investigasi Aktif', icon: FileSearch },
    { id: 'evidence', label: 'Arsip Bukti', icon: FolderOpen },
    { id: 'reports', label: 'Laporan SLA', icon: BarChart3 },
  ];

  const priorityTextColor: Record<CasePriority, string> = {
    High: 'text-[#B91C1C] font-semibold',
    Medium: 'text-[#B45309] font-medium',
    Low: 'text-[#15803D] font-medium',
  };

  const statusTextColor: Record<CaseStatus, string> = {
    Open: 'text-[#1D4ED8]',
    'Under Review': 'text-[#B45309]',
    Investigating: 'text-[#0F766E]',
    Escalated: 'text-[#B91C1C] font-semibold',
    Closed: 'text-[#475569]',
  };

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] text-[#111827]">
      {/* Case Manager Sidebar (FormKiQ reference) */}
      <aside className="w-60 shrink-0 bg-white border-r border-[#E5E7EB] flex flex-col justify-between p-4">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <span className="font-['Fraunces'] text-lg font-semibold text-[#EA580C]">
              SEJIWA Cases
            </span>
            <button
              type="button"
              onClick={() => onSwitchPortal('public')}
              className="text-xs text-[#6B7280] hover:text-[#111827] cursor-pointer"
            >
              Publik
            </button>
          </div>

          <div>
            <p className="px-2 text-[11px] font-semibold tracking-wider text-[#6B7280] uppercase mb-2">
              Penanganan Aduan
            </p>
            <nav aria-label="Navigasi portal case manager" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#FFF7ED] text-[#C2410C]'
                        : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="pt-4 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => onSwitchPortal('public')}
            className="w-full rounded px-2.5 py-2 text-left text-xs text-[#4B5563] hover:bg-[#F3F4F6]"
          >
            Keluar dari akun
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-[#E5E7EB] px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-[#111827]">
              {navItems.find((n) => n.id === activeView)?.label}
            </h1>
            <span className="text-xs text-[#6B7280]">·</span>
            <span className="text-xs text-[#6B7280]">Petugas: {user.name}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#4B5563] tabular-nums">
            <span>Total Kasus: {summary.total}</span>
            <span>Prioritas Tinggi: {summary.highPriority}</span>
            <span>Eskalasi: {summary.escalated}</span>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-5">
          {/* Top Search + Sort Bar */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Cari kasus aduan"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor tiket, judul, divisi, atau penanggung jawab..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F9FAFB] border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#EA580C]"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="case-sort" className="text-xs text-[#6B7280]">
                Urutkan:
              </label>
              <select
                id="case-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'events')}
                className="px-3 py-2 text-xs bg-white border border-[#D1D5DB] rounded-lg"
              >
                <option value="priority">Prioritas Tertinggi</option>
                <option value="dueDate">Tenggat Terdekat</option>
                <option value="events">Aktivitas Terbanyak</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-5 items-start">
            {/* Left Filters Panel (FormKiQ reference) */}
            <aside className="w-full xl:w-56 shrink-0 bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-[#111827]">Filter Aduan</h2>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs text-[#EA580C] hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>

              <div>
                <label htmlFor="case-type-filter" className="block text-xs font-medium text-[#374151] mb-1.5">
                  Kategori Kasus
                </label>
                <select
                  id="case-type-filter"
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#D1D5DB] rounded-lg"
                >
                  <option value="All">Semua Kategori</option>
                  <option value="Burnout">Burnout</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Workplace Stress">Workplace Stress</option>
                  <option value="Policy Conflict">Policy Conflict</option>
                  <option value="Interpersonal">Interpersonal</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-medium text-[#374151] mb-2">Prioritas</p>
                <div className="space-y-1.5">
                  {(['High', 'Medium', 'Low'] as CasePriority[]).map((p) => (
                    <label
                      key={p}
                      className="flex items-center justify-between text-xs text-[#4B5563] cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedPriorities.includes(p)}
                          onChange={() => togglePriority(p)}
                          className="accent-[#EA580C]"
                        />
                        <span>{p}</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#6B7280] tabular-nums">
                        {cases.filter((c) => c.priority === p).length}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-[#374151] mb-2">Status Penanganan</p>
                <div className="space-y-1.5">
                  {(
                    ['Open', 'Under Review', 'Investigating', 'Escalated', 'Closed'] as CaseStatus[]
                  ).map((st) => (
                    <label
                      key={st}
                      className="flex items-center justify-between text-xs text-[#4B5563] cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(st)}
                          onChange={() => toggleStatus(st)}
                          className="accent-[#EA580C]"
                        />
                        <span>{st}</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#6B7280] tabular-nums">
                        {cases.filter((c) => c.status === st).length}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </aside>

            {/* Right Table + Case Detail / Timeline */}
            <div className="flex-1 min-w-0 w-full space-y-5">
              <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280]">
                    <tr>
                      <th className="py-3 px-3 font-semibold">Case ID</th>
                      <th className="py-3 px-3 font-semibold">Judul Aduan</th>
                      <th className="py-3 px-3 font-semibold">Kategori</th>
                      <th className="py-3 px-3 font-semibold">Petugas</th>
                      <th className="py-3 px-3 font-semibold">Prioritas</th>
                      <th className="py-3 px-3 font-semibold">Status</th>
                      <th className="py-3 px-3 font-semibold text-right">Tenggat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {visibleCases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 px-4 text-center text-[#6B7280]">
                          Tidak ada kasus sesuai kriteria filter.{' '}
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="text-[#EA580C] font-medium hover:underline cursor-pointer"
                          >
                            Reset filter
                          </button>
                        </td>
                      </tr>
                    ) : (
                      visibleCases.map((c) => {
                        const isSelected = selectedCase?.id === c.id;
                        return (
                          <tr
                            key={c.id}
                            className={`transition-colors ${
                              isSelected ? 'bg-[#FFF7ED]' : 'hover:bg-[#F9FAFB]'
                            }`}
                          >
                            <td className="py-3 px-3 font-mono font-medium tabular-nums whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedCaseId(c.id)}
                                className="text-[#C2410C] hover:underline cursor-pointer"
                              >
                                {c.id}
                              </button>
                            </td>
                            <td className="py-3 px-3 font-medium text-[#111827] max-w-[180px] truncate">
                              <button
                                type="button"
                                onClick={() => setSelectedCaseId(c.id)}
                                className="text-left hover:underline cursor-pointer truncate w-full"
                              >
                                {c.title}
                              </button>
                            </td>
                            <td className="py-3 px-3 text-[#4B5563] whitespace-nowrap">{c.type}</td>
                            <td className="py-3 px-3 text-[#4B5563] whitespace-nowrap">{c.owner}</td>
                            <td className={`py-3 px-3 whitespace-nowrap ${priorityTextColor[c.priority]}`}>
                              {c.priority}
                            </td>
                            <td className={`py-3 px-3 whitespace-nowrap ${statusTextColor[c.status]}`}>
                              {c.status}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-[#4B5563] tabular-nums whitespace-nowrap">
                              {c.dueDate}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Case Detail & Timeline Actions Panel (FormKiQ reference) */}
              {selectedCase && (
                <section className="bg-white border border-[#E5E7EB] rounded-xl p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-7 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#C2410C] tabular-nums">
                          {selectedCase.id} · {selectedCase.department}
                        </p>
                        <h2 className="mt-1 text-base font-semibold text-[#111827]">
                          {selectedCase.title}
                        </h2>
                      </div>
                      <button
                        type="button"
                        aria-label="Tutup detail kasus"
                        onClick={() => setSelectedCaseId('')}
                        className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="text-xs text-[#4B5563] space-y-2">
                      <p>
                        <span className="font-semibold text-[#111827]">Pelapor:</span>{' '}
                        {selectedCase.reporterName} ({selectedCase.reporterEmail})
                      </p>
                      <p className="leading-relaxed">
                        <span className="font-semibold text-[#111827]">Ringkasan:</span>{' '}
                        {selectedCase.summary}
                      </p>
                      <p>
                        <span className="font-semibold text-[#111827]">Tindakan Berikutnya:</span>{' '}
                        {selectedCase.nextAction}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#F3F4F6]">
                      <p className="text-xs font-semibold text-[#111827] mb-2">
                        Perbarui Status Penanganan
                      </p>
                      {selectedCase.owner === 'Belum ditugaskan' ? (
                        <button
                          type="button"
                          onClick={() => onClaimCase(selectedCase.id)}
                          className="rounded-lg bg-[#C2410C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9A3412]"
                        >
                          Ambil tanggung jawab aduan
                        </button>
                      ) : (
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            'Under Review',
                            'Investigating',
                            'Escalated',
                            'Closed',
                          ] as CaseStatus[]
                        ).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => onUpdateCaseStatus(selectedCase.id, st)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                              selectedCase.status === st
                                ? 'bg-[#EA580C] text-white border-[#EA580C]'
                                : 'bg-white text-[#374151] border-[#D1D5DB] hover:bg-[#F9FAFB]'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-5 md:border-l md:border-[#E5E7EB] md:pl-6 space-y-3">
                    <h3 className="text-xs font-semibold text-[#111827]">
                      Linimasa &amp; Audit Penanganan
                    </h3>
                    <div className="space-y-3">
                      {selectedCase.timeline.map((step) => (
                        <div key={step.id} className="flex items-start justify-between gap-3 text-xs">
                          <div className="flex items-start gap-2">
                            {step.state === 'done' && (
                              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
                            )}
                            {step.state === 'warning' && (
                              <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" aria-hidden="true" />
                            )}
                            {step.state === 'pending' && (
                              <Clock className="w-4 h-4 text-[#6B7280] shrink-0 mt-0.5" aria-hidden="true" />
                            )}
                            <span className="text-[#1F2937]">{step.label}</span>
                          </div>
                          <span className="font-mono text-[11px] text-[#6B7280] whitespace-nowrap tabular-nums">
                            {step.date}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
