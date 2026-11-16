import { useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  BookOpen,
  Download,
  FileWarning,
  LogOut,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import type { AdminView, PsychologyArticle, Psychologist } from '../../types/sejiwa';
import {
  api,
  type AdminArticleItem,
  type AdminAuditItem,
  type AdminPsychologistItem,
  type AdminUserItem,
  type AppBootstrap,
} from '../../services/api';

interface AdminMetrics {
  users: {
    totalUsers: number;
    employees: number;
    psychologists: number;
    activeUsers: number;
  };
  articles: number;
  complaints: Record<string, number>;
}

interface AdminPortalProps {
  psychologists: Psychologist[];
  articles: PsychologyArticle[];
  metrics?: AdminMetrics;
  onLogout: () => void;
  onContentChanged: () => Promise<AppBootstrap>;
}

interface ArticleDraft {
  title: string;
  category: string;
  author: string;
  excerpt: string;
  body: string;
  readMinutes: string;
  published: boolean;
}

const emptyArticle: ArticleDraft = {
  title: '',
  category: '',
  author: 'Tim Edukasi SEJIWA',
  excerpt: '',
  body: '',
  readMinutes: '5',
  published: false,
};

const navigation: { id: AdminView; label: string; icon: typeof BarChart2 }[] = [
  { id: 'overview', label: 'Ringkasan', icon: BarChart2 },
  { id: 'users', label: 'Pengguna', icon: Users },
  { id: 'psychologists', label: 'Profil psikolog', icon: UserCheck },
  { id: 'articles', label: 'Artikel edukasi', icon: BookOpen },
  { id: 'complaints', label: 'Ringkasan aduan', icon: FileWarning },
  { id: 'audit', label: 'Audit log', icon: ShieldCheck },
];

const formatDate = (value: string) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const csvValue = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function AdminPortal({
  psychologists,
  articles,
  metrics,
  onLogout,
  onContentChanged,
}: AdminPortalProps) {
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditEntries, setAuditEntries] = useState<AdminAuditItem[]>([]);
  const [managedArticles, setManagedArticles] = useState<AdminArticleItem[]>(
    articles.map((item) => ({ ...item, published: true }))
  );
  const [managedPsychologists, setManagedPsychologists] = useState<AdminPsychologistItem[]>(
    psychologists.map((item) => ({ ...item, active: true, verified: false }))
  );
  const [articleDraft, setArticleDraft] = useState<ArticleDraft>(emptyArticle);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const query = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (!['users', 'audit', 'articles', 'psychologists'].includes(activeView)) return;
    let active = true;
    setLoading(true);
    setError('');
    const fetchData = activeView === 'users'
      ? api.adminUsers().then((data) => { if (active) setUsers(data.users); })
      : activeView === 'audit'
        ? api.adminAudit().then((data) => { if (active) setAuditEntries(data.entries); })
        : activeView === 'articles'
          ? api.adminArticles().then((data) => { if (active) setManagedArticles(data.articles); })
          : api.adminPsychologists().then((data) => { if (active) setManagedPsychologists(data.psychologists); });
    fetchData
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Data belum dapat dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeView]);

  const filteredUsers = useMemo(() => users.filter((item) =>
    `${item.name} ${item.email} ${item.role} ${item.department}`.toLowerCase().includes(query)
  ), [users, query]);
  const filteredAudit = useMemo(() => auditEntries.filter((item) =>
    `${item.id} ${item.actor} ${item.action} ${item.target}`.toLowerCase().includes(query)
  ), [auditEntries, query]);

  const updateUserStatus = async (item: AdminUserItem) => {
    const active = !item.active;
    setError('');
    try {
      await api.setUserActive(item.id, Boolean(active));
      setUsers((current) => current.map((user) => user.id === item.id ? { ...user, active: Number(active) } : user));
      await onContentChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Status akun belum dapat diperbarui.');
    }
  };

  const saveArticle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingArticle(true);
    setError('');
    try {
      const body = articleDraft.body.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
      const result = await api.saveArticle({
        ...(editingArticleId ? { id: editingArticleId } : {}),
        title: articleDraft.title,
        category: articleDraft.category,
        author: articleDraft.author,
        excerpt: articleDraft.excerpt,
        body,
        readMinutes: Number(articleDraft.readMinutes),
        image: '/src/assets/images/mindfulness_wellness_calm_1794817431229.jpg',
        published: articleDraft.published,
      });
      setManagedArticles((current) => [
        result.article,
        ...current.filter((item) => item.id !== result.article.id),
      ]);
      setEditingArticleId(null);
      setArticleDraft(emptyArticle);
      await onContentChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Artikel belum dapat disimpan.');
    } finally {
      setSavingArticle(false);
    }
  };

  const editArticle = (article: AdminArticleItem) => {
    setEditingArticleId(article.id);
    setArticleDraft({
      title: article.title,
      category: article.category,
      author: article.author,
      excerpt: article.excerpt,
      body: article.body.join('\n\n'),
      readMinutes: String(article.readMinutes),
      published: article.published,
    });
  };

  const deleteArticle = async (article: AdminArticleItem) => {
    if (!window.confirm(`Hapus artikel “${article.title}”?`)) return;
    setError('');
    try {
      await api.deleteArticle(article.id);
      setManagedArticles((current) => current.filter((item) => item.id !== article.id));
      if (editingArticleId === article.id) {
        setEditingArticleId(null);
        setArticleDraft(emptyArticle);
      }
      await onContentChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Artikel belum dapat dihapus.');
    }
  };

  const updatePsychologistStatus = async (
    profile: AdminPsychologistItem,
    status: { active: boolean; acceptingClients: boolean },
  ) => {
    setError('');
    try {
      const result = await api.updatePsychologist(profile.id, status);
      setManagedPsychologists((current) => current.map((item) =>
        item.id === profile.id ? result.psychologist : item
      ));
      await onContentChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profil psikolog belum dapat diperbarui.');
    }
  };

  const exportSummary = () => {
    if (!metrics) {
      setExportMessage('Ringkasan belum tersedia dari server.');
      return;
    }
    const rows = [
      ['Metrik', 'Jumlah'],
      ['Total pengguna', metrics.users.totalUsers],
      ['Pengguna aktif', metrics.users.activeUsers],
      ['Karyawan', metrics.users.employees],
      ['Psikolog (akun)', metrics.users.psychologists],
      ['Artikel terbit', metrics.articles],
      ...Object.entries(metrics.complaints).map(([status, count]) => [`Aduan: ${status}`, count]),
    ];
    const csv = rows.map((row) => row.map(csvValue).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sejiwa-ringkasan.csv';
    link.click();
    URL.revokeObjectURL(url);
    setExportMessage('Ringkasan data aktual berhasil diunduh.');
    window.setTimeout(() => setExportMessage(''), 3500);
  };

  const metricCards = [
    { label: 'Total pengguna', value: metrics?.users.totalUsers ?? 0 },
    { label: 'Pengguna aktif', value: metrics?.users.activeUsers ?? 0 },
    { label: 'Artikel terbit', value: metrics?.articles ?? 0 },
    { label: 'Aduan aktif', value: Object.entries(metrics?.complaints || {})
      .filter(([status]) => status !== 'Closed')
      .reduce((sum, [, count]) => sum + count, 0) },
  ];

  return (
    <div className="min-h-screen flex bg-[#F9FAFB] text-[#111827]">
      <aside className="w-64 shrink-0 bg-[#111827] text-[#D1D5DB] flex flex-col justify-between p-5">
        <div className="space-y-7">
          <div className="px-2">
            <span className="font-['Fraunces'] text-lg font-semibold text-white tracking-tight">SEJIWA Admin</span>
          </div>
          <nav aria-label="Navigasi portal admin" className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={activeView === item.id ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors ${
                    activeView === item.id ? 'bg-[#1F2937] text-white' : 'text-[#9CA3AF] hover:bg-[#1F2937]/60 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-md border-t border-[#1F2937] px-2 pt-5 text-xs text-[#D1D5DB] hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar dari akun
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="min-h-16 bg-white border-b border-[#E5E7EB] px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-[#111827]">{navigation.find((item) => item.id === activeView)?.label}</h1>
            <p className="text-xs text-[#6B7280]">Data aktual; detail aduan dan percakapan privat tidak tersedia bagi admin.</p>
          </div>
          <div className="flex items-center gap-3">
            {activeView !== 'overview' && activeView !== 'complaints' && (
              <div className="relative hidden sm:block">
                <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Cari data admin"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-[#F9FAFB] border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#0F766E]"
                />
              </div>
            )}
            <button type="button" onClick={exportSummary} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#111827] bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6] rounded-lg whitespace-nowrap">
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Ekspor ringkasan
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1200px] w-full mx-auto">
          {(error || exportMessage) && (
            <p role={error ? 'alert' : 'status'} className={`rounded-lg border p-3 text-xs ${error ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]' : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'}`}>
              {error || exportMessage}
            </p>
          )}

          {activeView === 'overview' && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {metricCards.map((card) => (
                  <article key={card.label} className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                    <p className="text-xs text-[#6B7280]">{card.label}</p>
                    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{card.value}</p>
                  </article>
                ))}
              </section>
              <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
                <h2 className="text-sm font-semibold">Batas akses administrator</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#4B5563]">
                  Administrator mengelola akun dan konten. Isi laporan hanya tersedia bagi karyawan pemilik tiket dan petugas yang ditugaskan. Pesan konseling hanya dapat dibuka karyawan dan psikolog yang terhubung.
                </p>
              </section>
            </>
          )}

          {activeView === 'users' && (
            <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <div className="border-b border-[#E5E7EB] px-5 py-4">
                <h2 className="text-sm font-semibold">Akun pengguna</h2>
                <p className="mt-1 text-xs text-[#6B7280]">Ubah status aktif akun. Peran istimewa tidak dapat dibuat melalui pendaftaran publik.</p>
              </div>
              {loading ? <p className="p-6 text-sm text-[#6B7280]">Memuat akun…</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F9FAFB] text-[#6B7280]">
                      <tr><th className="px-4 py-3">Nama / Email</th><th className="px-4 py-3">Peran</th><th className="px-4 py-3">Departemen</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Tindakan</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {filteredUsers.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3"><p className="font-medium">{item.name}</p><p className="mt-1 text-[#6B7280]">{item.email}</p></td>
                          <td className="px-4 py-3">{item.role}</td>
                          <td className="px-4 py-3">{item.department || '—'}</td>
                          <td className="px-4 py-3">{item.active ? 'Aktif' : 'Dinonaktifkan'}</td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={() => void updateUserStatus(item)} className="font-semibold text-[#0F766E] hover:underline">
                              {item.active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-[#6B7280]">{loading ? 'Memuat…' : 'Tidak ada akun yang cocok.'}</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeView === 'psychologists' && (
            <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <div className="border-b border-[#E5E7EB] px-5 py-4">
                <h2 className="text-sm font-semibold">Profil psikolog</h2>
                <p className="mt-1 text-xs text-[#6B7280]">Data profil demonstrasi. Kredensial dan status praktik belum diverifikasi untuk penggunaan nyata.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F9FAFB] text-[#6B7280]">
                    <tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Spesialisasi</th><th className="px-4 py-3">Lokasi</th><th className="px-4 py-3">Status profil</th><th className="px-4 py-3 text-right">Tindakan</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {managedPsychologists.map((profile) => (
                      <tr key={profile.id}>
                        <td className="px-4 py-3 font-medium">{profile.name}</td>
                        <td className="px-4 py-3 text-[#4B5563]">{profile.specialty}</td>
                        <td className="px-4 py-3 text-[#4B5563]">{profile.location}</td>
                        <td className="px-4 py-3">{profile.active ? profile.acceptingClients ? 'Aktif · menerima' : 'Aktif · tidak menerima' : 'Nonaktif'}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => void updatePsychologistStatus(profile, {
                            active: !profile.active,
                            acceptingClients: !profile.active,
                          })} className="font-semibold text-[#0F766E] hover:underline">
                            {profile.active ? 'Nonaktifkan profil' : 'Aktifkan profil'}
                          </button>
                          {profile.active && <button type="button" onClick={() => void updatePsychologistStatus(profile, {
                            active: true,
                            acceptingClients: !profile.acceptingClients,
                          })} className="ml-3 font-semibold text-[#0F766E] hover:underline">
                            {profile.acceptingClients ? 'Tutup percakapan baru' : 'Terima percakapan'}
                          </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeView === 'articles' && (
            <>
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <h2 className="text-sm font-semibold">{editingArticleId ? 'Edit artikel' : 'Buat artikel'}</h2>
              <form onSubmit={saveArticle} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-xs font-medium text-[#4B5563]">Judul
                  <input required minLength={5} maxLength={180} value={articleDraft.title} onChange={(event) => setArticleDraft({ ...articleDraft, title: event.target.value })} className="mt-1 block w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-[#4B5563]">Kategori
                  <input required maxLength={80} value={articleDraft.category} onChange={(event) => setArticleDraft({ ...articleDraft, category: event.target.value })} className="mt-1 block w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-[#4B5563]">Penulis
                  <input required maxLength={120} value={articleDraft.author} onChange={(event) => setArticleDraft({ ...articleDraft, author: event.target.value })} className="mt-1 block w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-[#4B5563]">Estimasi waktu baca (menit)
                  <input required type="number" min={1} max={60} value={articleDraft.readMinutes} onChange={(event) => setArticleDraft({ ...articleDraft, readMinutes: event.target.value })} className="mt-1 block w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-[#4B5563] md:col-span-2">Ringkasan
                  <textarea required minLength={10} maxLength={600} rows={2} value={articleDraft.excerpt} onChange={(event) => setArticleDraft({ ...articleDraft, excerpt: event.target.value })} className="mt-1 block w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-[#4B5563] md:col-span-2">Isi artikel (pisahkan paragraf dengan satu baris kosong)
                  <textarea required minLength={10} rows={6} value={articleDraft.body} onChange={(event) => setArticleDraft({ ...articleDraft, body: event.target.value })} className="mt-1 block w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm" />
                </label>
                <label className="flex items-center gap-2 text-xs text-[#4B5563]">
                  <input type="checkbox" checked={articleDraft.published} onChange={(event) => setArticleDraft({ ...articleDraft, published: event.target.checked })} />
                  Publikasikan artikel
                </label>
                <div className="flex justify-end gap-2 md:col-span-2">
                  {editingArticleId && <button type="button" onClick={() => { setEditingArticleId(null); setArticleDraft(emptyArticle); }} className="rounded-lg border border-[#D1D5DB] px-4 py-2 text-xs font-semibold">Batal edit</button>}
                  <button type="submit" disabled={savingArticle} className="rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                    {savingArticle ? 'Menyimpan…' : editingArticleId ? 'Simpan perubahan' : 'Simpan artikel'}
                  </button>
                </div>
              </form>
            </section>
            <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <div className="border-b border-[#E5E7EB] px-5 py-4">
                <h2 className="text-sm font-semibold">Artikel yang dipublikasikan</h2>
                <p className="mt-1 text-xs text-[#6B7280]">Daftar berasal dari SQLite. Konten edukatif bukan diagnosis.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F9FAFB] text-[#6B7280]">
                    <tr><th className="px-4 py-3">Judul artikel</th><th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Penulis</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Tindakan</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {managedArticles.filter((item) => `${item.title} ${item.category} ${item.author}`.toLowerCase().includes(query)).map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium">{item.title}</td>
                        <td className="px-4 py-3 text-[#4B5563]">{item.category}</td>
                        <td className="px-4 py-3 text-[#4B5563]">{item.author}</td>
                        <td className="px-4 py-3">{item.published ? 'Terbit' : 'Draf'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => editArticle(item)} className="font-semibold text-[#0F766E] hover:underline">Edit</button>
                            <button type="button" onClick={() => void deleteArticle(item)} className="font-semibold text-[#B91C1C] hover:underline">Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {managedArticles.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-[#6B7280]">Belum ada artikel.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            </>
          )}

          {activeView === 'complaints' && (
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
              <h2 className="text-sm font-semibold">Jumlah aduan berdasarkan status</h2>
              <p className="mt-1 text-xs text-[#6B7280]">Data agregat tanpa identitas atau isi laporan.</p>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {['Open', 'Under Review', 'Investigating', 'Escalated', 'Closed'].map((status) => (
                  <div key={status} className="rounded-lg bg-[#F9FAFB] p-4">
                    <p className="text-xs text-[#6B7280]">{status}</p>
                    <p className="mt-2 font-mono text-xl font-semibold">{metrics?.complaints[status] || 0}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeView === 'audit' && (
            <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              {loading ? <p className="p-6 text-sm text-[#6B7280]">Memuat catatan audit…</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F9FAFB] text-[#6B7280]">
                      <tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Aktor</th><th className="px-4 py-3">Aktivitas</th><th className="px-4 py-3">Target</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {filteredAudit.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.timestamp)}</td>
                          <td className="px-4 py-3">{entry.actor} · {entry.role}</td>
                          <td className="px-4 py-3">{entry.action}</td>
                          <td className="px-4 py-3 font-mono">{entry.target}</td>
                        </tr>
                      ))}
                      {!loading && filteredAudit.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-[#6B7280]">Belum ada aktivitas yang tercatat.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
