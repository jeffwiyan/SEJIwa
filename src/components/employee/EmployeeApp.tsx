import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Lock,
  Mail,
  MessageSquare,
  Search,
  Send,
  Settings,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  ChatThread,
  ComplaintCase,
  EmployeeView,
  PortalMode,
  Psychologist,
  PsychologyArticle,
} from '../../types/sejiwa';
import { ASSETS } from '../../data/seedData';
import {
  filterPsychologists,
  validateComplaintDraft,
  type ComplaintDraft,
} from '../../utils/sejiwaLogic';
import { SafeImage } from '../common/SafeImage';
import type { AuthUser, ComplaintDraftPayload, NotificationItem } from '../../services/api';

interface EmployeeAppProps {
  activeView: EmployeeView;
  onChangeView: (view: EmployeeView) => void;
  initialTopicFilter?: string;
  psychologists: Psychologist[];
  articles: PsychologyArticle[];
  bookedPsychologistIds: string[];
  onBookPsychologist: (psychologist: Psychologist) => void;
  threads: ChatThread[];
  onSendMessage: (threadId: string, text: string) => Promise<void>;
  onMarkConversationRead: (threadId: string) => Promise<void>;
  cases: ComplaintCase[];
  onSubmitComplaint: (draft: ComplaintDraftPayload) => Promise<ComplaintCase>;
  onSwitchPortal: (portal: PortalMode) => void;
  user: AuthUser;
  onUpdateProfile: (profile: { name: string; department: string; position: string }) => Promise<void>;
  notifications: NotificationItem[];
  onReadNotification: (notification: NotificationItem) => Promise<void>;
}

export function EmployeeApp({
  activeView,
  onChangeView,
  initialTopicFilter,
  psychologists,
  articles,
  bookedPsychologistIds,
  onBookPsychologist,
  threads,
  onSendMessage,
  onMarkConversationRead,
  cases,
  onSubmitComplaint,
  onSwitchPortal,
  user,
  onUpdateProfile,
  notifications,
  onReadNotification,
}: EmployeeAppProps) {
  const [psySearch, setPsySearch] = useState('');
  const [psySessionType, setPsySessionType] = useState<'All' | 'Online' | 'Offline'>('All');
  const [psyArea, setPsyArea] = useState<string>(initialTopicFilter || 'All');
  const [acceptingOnly, setAcceptingOnly] = useState(false);

  const [selectedArticle, setSelectedArticle] = useState<PsychologyArticle | null>(null);
  const [articleCategory, setArticleCategory] = useState<string>('Semua');

  const [activeThreadId, setActiveThreadId] = useState<string>(threads[0]?.id || '');
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [complaintDraft, setComplaintDraft] = useState<ComplaintDraft>({
    reporterName: user.name,
    reporterEmail: user.email,
    anonymous: false,
    category: 'Burnout',
    department: user.department,
    description: '',
  });
  const [complaintErrors, setComplaintErrors] = useState<
    Partial<Record<'reporterName' | 'reporterEmail' | 'description', string>>
  >({});
  const [submittedCaseId, setSubmittedCaseId] = useState<string | null>(null);
  const [complaintSubmitError, setComplaintSubmitError] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintTermsAccepted, setComplaintTermsAccepted] = useState(false);

  const [settingsTab, setSettingsTab] = useState<'profile' | 'notifications' | 'security'>('profile');
  const [notificationError, setNotificationError] = useState('');
  const [profileName, setProfileName] = useState(user.name);
  const [profileDepartment, setProfileDepartment] = useState(user.department);
  const [profilePosition, setProfilePosition] = useState(user.position);
  const [profileMessage, setProfileMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setProfileName(user.name);
    setProfileDepartment(user.department);
    setProfilePosition(user.position);
  }, [user.name, user.department, user.position]);

  const filteredPsychologists = filterPsychologists(psychologists, {
    searchQuery: psySearch,
    sessionType: psySessionType,
    area: psyArea,
    acceptingOnly,
  });

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  useEffect(() => {
    if (activeView !== 'chat' || !activeThread || activeThread.unreadCount === 0) return;
    onMarkConversationRead(activeThread.id).catch((error: unknown) => {
      setChatError(error instanceof Error ? error.message : 'Status pesan belum dapat diperbarui.');
    });
  }, [activeView, activeThread?.id, activeThread?.unreadCount, onMarkConversationRead]);

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !activeThread || sendingMessage) return;
    setSendingMessage(true);
    setChatError('');
    try {
      await onSendMessage(activeThread.id, trimmed);
      setChatInput('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Pesan belum dapat dikirim.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleComplaintSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!complaintTermsAccepted) {
      setComplaintSubmitError('Setujui pemrosesan data sebelum mengirim aduan.');
      return;
    }
    const validation = validateComplaintDraft(complaintDraft);
    if (!validation.valid) {
      setComplaintErrors(validation.errors);
      setSubmittedCaseId(null);
      return;
    }
    setComplaintErrors({});
    setComplaintSubmitError('');
    setSubmittingComplaint(true);
    try {
      const created = await onSubmitComplaint({
        anonymous: complaintDraft.anonymous,
        category: complaintDraft.category,
        department: complaintDraft.department,
        description: complaintDraft.description,
        termsAccepted: complaintTermsAccepted,
      });
      setSubmittedCaseId(created.id);
      setComplaintDraft((prev) => ({ ...prev, description: '' }));
    } catch (error) {
      setComplaintSubmitError(error instanceof Error ? error.message : 'Aduan belum dapat dikirim.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    try {
      await onUpdateProfile({
        name: profileName,
        department: profileDepartment,
        position: profilePosition,
      });
      setProfileMessage('Profil berhasil disimpan.');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Profil belum dapat disimpan.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleReadNotification = async (notification: NotificationItem) => {
    try {
      await onReadNotification(notification);
      setNotificationError('');
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Notifikasi belum dapat diperbarui.');
    }
  };

  const filteredArticles =
    articleCategory === 'Semua'
      ? articles
      : articles.filter((a) => a.category === articleCategory);

  const navItems: { id: EmployeeView; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'education', label: 'Edukasi Psikologi', icon: BookOpen },
    { id: 'psychologists', label: 'Daftar Psikolog', icon: Users },
    { id: 'chat', label: 'Chat Konseling', icon: MessageSquare },
    { id: 'complaints', label: 'Layanan Aduan', icon: ShieldAlert },
    { id: 'settings', label: 'Profil & Pengaturan', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-[#F8FAF8] text-[#17221B]">
      {/* Deep Forest Sidebar (Wellnest reference) */}
      <aside className="w-64 shrink-0 bg-[#1E2B20] text-[#E6ECE7] flex flex-col justify-between p-5 border-r border-[#2C3D2E]">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <span className="font-['Fraunces'] text-xl font-semibold tracking-tight text-white">
              SEJIWA
            </span>
            <button
              type="button"
              onClick={() => onSwitchPortal('public')}
              aria-label="Kembali ke Website Publik"
              className="text-xs text-[#A3B8A6] hover:text-white transition-colors cursor-pointer"
            >
              Publik
            </button>
          </div>

          <nav aria-label="Navigasi aplikasi karyawan" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeView(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#B7E4C7] text-[#142318]'
                      : 'text-[#C2D0C4] hover:bg-[#29392B] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-[#2E4031]">
          <button
            type="button"
            onClick={() => onSwitchPortal('public')}
            className="w-full rounded-md px-3 py-2 text-left text-xs text-[#D5E2D7] transition-colors hover:bg-[#29392B]"
          >
            Keluar dari akun
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Context Bar */}
        <header className="h-16 bg-white border-b border-[#E3E8E3] px-6 lg:px-10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm text-[#52635A]">
            <span>Aplikasi Karyawan</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-[#17221B]">
              {navItems.find((i) => i.id === activeView)?.label}
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-[#52635A] hidden sm:inline">
              {user.name}{user.department ? ` · ${user.department}` : ''}
            </span>
            <button
              type="button"
              onClick={() => onChangeView('psychologists')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A2F] hover:bg-[#152921] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Booking Sesi
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10 max-w-[1200px] w-full mx-auto">
          {/* 1. EMPLOYEE DASHBOARD */}
          {activeView === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-medium text-[#17221B]">
                    Apa kabar, {user.name.split(' ')[0]}?
                  </h1>
                  <p className="mt-1 text-sm text-[#52635A]">
                    Berikut ringkasan aktivitas SEJIWA pada akun Anda.
                  </p>
                </div>
              </div>

              {/* Ringkasan dihitung dari data akun yang tersimpan di server. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white border border-[#E2E8E2] rounded-xl p-5">
                  <p className="text-xs text-[#52635A]">Artikel tersedia</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-[#17221B] tabular-nums">
                    {articles.length}
                  </p>
                  <p className="mt-1 text-xs text-[#52635A]">Materi edukasi</p>
                </div>
                <div className="bg-white border border-[#E2E8E2] rounded-xl p-5">
                  <p className="text-xs text-[#52635A]">Percakapan konseling</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-[#17221B] tabular-nums">
                    {threads.length}
                  </p>
                  <p className="mt-1 text-xs text-[#52635A]">Milik akun Anda</p>
                </div>
                <div className="bg-white border border-[#E2E8E2] rounded-xl p-5">
                  <p className="text-xs text-[#52635A]">Aduan aktif</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-[#17221B] tabular-nums">
                    {cases.filter((item) => item.status !== 'Closed').length}
                  </p>
                  <p className="mt-1 text-xs text-[#52635A]">Riwayat pribadi</p>
                </div>
                <div className="bg-white border border-[#E2E8E2] rounded-xl p-5">
                  <p className="text-xs text-[#52635A]">Aduan selesai</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-[#17221B] tabular-nums">
                    {cases.filter((item) => item.status === 'Closed').length}
                  </p>
                  <p className="mt-1 text-xs text-[#52635A]">Status terkini</p>
                </div>
                <div className="bg-white border border-[#E2E8E2] rounded-xl p-5">
                  <p className="text-xs text-[#52635A]">Psikolog terdaftar</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-[#17221B] tabular-nums">
                    {psychologists.length}
                  </p>
                  <p className="mt-1 text-xs text-[#52635A]">Profil demonstrasi</p>
                </div>
              </div>

              {/* Quick Insights & Actions (2x2 Grid matching Wellnest screenshot) */}
              <div>
                <h2 className="text-base font-semibold text-[#17221B] mb-4">
                  Wawasan &amp; Langkah Cepat
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-[#E2E8E2] rounded-xl p-6 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#17221B]">
                        Mulai percakapan konseling
                      </h3>
                      <p className="mt-1.5 text-sm text-[#52635A] leading-relaxed">
                        {psychologists.length
                          ? 'Lihat profil demonstrasi dan mulai percakapan. Profil profesional pada versi ini belum diverifikasi.'
                          : 'Profil psikolog belum tersedia.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeView('psychologists')}
                      className="self-start text-xs font-semibold text-[#1E3A2F] hover:underline cursor-pointer"
                    >
                      Pilih Psikolog &amp; Jadwal →
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2E8E2] rounded-xl p-6 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#17221B]">
                        Percakapan Anda
                      </h3>
                      <p className="mt-1.5 text-sm text-[#52635A] leading-relaxed">
                        {threads[0]?.lastMessagePreview || 'Belum ada percakapan. Anda dapat memulai dari daftar profil.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeView('chat')}
                      className="self-start text-xs font-semibold text-[#1E3A2F] hover:underline cursor-pointer"
                    >
                      Buka Percakapan →
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2E8E2] rounded-xl p-6 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#17221B]">
                        {articles[0]?.title || 'Materi edukasi SEJIWA'}
                      </h3>
                      <p className="mt-1.5 text-sm text-[#52635A] leading-relaxed">
                        {articles[0]?.excerpt || 'Materi edukasi belum tersedia.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeView('education')}
                      className="self-start text-xs font-semibold text-[#1E3A2F] hover:underline cursor-pointer"
                    >
                      Baca Edukasi Psikologi →
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2E8E2] rounded-xl p-6 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#17221B]">
                        Riwayat dan status aduan
                      </h3>
                      <p className="mt-1.5 text-sm text-[#52635A] leading-relaxed">
                        {cases.length
                          ? `Anda memiliki ${cases.length} tiket. Informasi detail hanya terlihat pada akun Anda dan petugas yang ditugaskan.`
                          : 'Belum ada laporan pada akun Anda. Aduan yang dikirim akan mendapat nomor tiket.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeView('complaints')}
                      className="self-start text-xs font-semibold text-[#1E3A2F] hover:underline cursor-pointer"
                    >
                      Buka Form Aduan →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. EDUKASI PSIKOLOGI */}
          {activeView === 'education' && (
            <div className="space-y-8">
              {selectedArticle ? (
                <article className="bg-white border border-[#E2E8E2] rounded-2xl overflow-hidden max-w-3xl">
                  <div className="aspect-[16/9] bg-[#EFF3EF]">
                    <SafeImage
                      src={selectedArticle.image}
                      alt={selectedArticle.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-8 space-y-5">
                    <button
                      type="button"
                      onClick={() => setSelectedArticle(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A2F] hover:underline cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      Kembali ke Daftar Artikel
                    </button>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#52635A]">
                      <span>{selectedArticle.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedArticle.author}</span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedArticle.publishedDate}</span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedArticle.readMinutes} menit baca</span>
                    </div>
                    <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-medium text-[#17221B] leading-snug">
                      {selectedArticle.title}
                    </h1>
                    <div className="space-y-4 pt-2">
                      {selectedArticle.body.map((para, i) => (
                        <p key={i} className="text-base text-[#36453C] leading-relaxed">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>
                </article>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-medium text-[#17221B]">
                        Edukasi Psikologi &amp; Panduan Mandiri
                      </h1>
                      <p className="mt-1 text-sm text-[#52635A]">
                        Materi psikoedukasi berbasis riset yang disusun oleh psikolog klinis SEJIWA.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-1 bg-[#EAEFEA] rounded-lg">
                      {['Semua', ...new Set(articles.map((article) => article.category))].map(
                        (cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setArticleCategory(cat)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              articleCategory === cat
                                ? 'bg-white text-[#17221B] shadow-sm'
                                : 'text-[#52635A] hover:text-[#17221B]'
                            }`}
                          >
                            {cat}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Editorial Hero Card */}
                  {articles[0] && <div className="bg-[#EFECE6] border border-[#DFDBD2] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                    <div className="lg:col-span-7 p-8 flex flex-col justify-center space-y-4">
                      <p className="text-xs text-[#52635A]">
                        Pilihan · {articles[0].readMinutes} menit baca
                      </p>
                      <h2 className="font-['Fraunces'] text-2xl sm:text-3xl font-medium text-[#17221B] leading-snug">
                        {articles[0].title}
                      </h2>
                      <p className="text-sm text-[#4A5A50] leading-relaxed">
                        {articles[0].excerpt}
                      </p>
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedArticle(articles[0])}
                          className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A2F] hover:bg-[#152921] rounded-lg transition-colors cursor-pointer"
                        >
                          Baca Artikel Lengkap
                        </button>
                      </div>
                    </div>
                    <div className="lg:col-span-5 min-h-[240px]">
                      <SafeImage
                        src={articles[0].image}
                        alt={articles[0].title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>}

                  {/* Article List */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredArticles.map((art) => (
                      <article
                        key={art.id}
                        className="bg-white border border-[#E2E8E2] rounded-xl overflow-hidden flex flex-col"
                      >
                        <div className="aspect-[4/3] bg-[#EFF3EF]">
                          <SafeImage
                            src={art.image}
                            alt={art.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                          <div>
                            <p className="text-xs text-[#52635A]">
                              {art.category} · {art.readMinutes} menit
                            </p>
                            <h3 className="mt-2 font-['Fraunces'] text-lg font-medium text-[#17221B] leading-snug">
                              {art.title}
                            </h3>
                            <p className="mt-2 text-xs text-[#52635A] leading-relaxed">
                              {art.excerpt}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedArticle(art)}
                            className="self-start text-xs font-semibold text-[#1E3A2F] hover:underline cursor-pointer"
                          >
                            Baca Selengkapnya →
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {filteredArticles.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[#D4DDD6] p-8 text-center text-sm text-[#52635A]">
                      Belum ada artikel pada kategori ini.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* 3. DAFTAR PSIKOLOG (matching McDowall directory screenshot) */}
          {activeView === 'psychologists' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-medium text-[#17221B]">
                  Temukan Psikolog yang Tepat
                </h1>
                <p className="mt-1 text-sm text-[#52635A]">
                  Pilih praktisi klinis atau organisasi berlisensi untuk sesi daring maupun tatap muka.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Filter Panel */}
                <aside className="lg:col-span-3 bg-white border border-[#E2E8E2] rounded-xl p-5 space-y-5">
                  <div>
                    <label htmlFor="psy-search" className="block text-xs font-semibold text-[#17221B] mb-1.5">
                      Cari Nama atau Kota
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#64746B] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                      <input
                        id="psy-search"
                        type="text"
                        value={psySearch}
                        onChange={(e) => setPsySearch(e.target.value)}
                        placeholder="Dr. Rania, Jakarta..."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-[#F8FAF8] border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#17221B] mb-2">Mode Sesi</p>
                    <div className="flex flex-col gap-1.5">
                      {(['All', 'Online', 'Offline'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPsySessionType(mode)}
                          className={`text-left px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                            psySessionType === mode
                              ? 'bg-[#1E3A2F] text-white font-medium'
                              : 'text-[#4A5A50] hover:bg-[#EFF3EF]'
                          }`}
                        >
                          {mode === 'All' ? 'Semua Mode' : `Konseling ${mode}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="psy-area" className="block text-xs font-semibold text-[#17221B] mb-1.5">
                      Area Penanganan
                    </label>
                    <select
                      id="psy-area"
                      value={psyArea}
                      onChange={(e) => setPsyArea(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#F8FAF8] border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                    >
                      <option value="All">Semua Topik</option>
                      <option value="Stres">Stres</option>
                      <option value="Depresi">Depresi</option>
                      <option value="Keluarga & Hubungan">Keluarga &amp; Hubungan</option>
                      <option value="Trauma">Trauma</option>
                      <option value="Gangguan Mood">Gangguan Mood</option>
                      <option value="Pekerjaan & Karir">Pekerjaan &amp; Karir</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#3B4A41] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptingOnly}
                      onChange={(e) => setAcceptingOnly(e.target.checked)}
                      className="rounded border-[#C6D3C9] text-[#1E3A2F]"
                    />
                    <span>Hanya yang menerima klien baru</span>
                  </label>
                </aside>

                {/* Practitioner Grid */}
                <div className="lg:col-span-9">
                  {filteredPsychologists.length === 0 ? (
                    <div className="bg-white border border-[#E2E8E2] rounded-xl p-10 text-center space-y-3">
                      <p className="text-sm font-medium text-[#17221B]">
                        Tidak ada psikolog yang cocok dengan filter tersebut.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPsySearch('');
                          setPsySessionType('All');
                          setPsyArea('All');
                          setAcceptingOnly(false);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A2F] rounded-lg cursor-pointer"
                      >
                        Reset Semua Filter
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {filteredPsychologists.map((psy) => {
                        const isBooked = bookedPsychologistIds.includes(psy.id);
                        return (
                          <article
                            key={psy.id}
                            className="bg-white border border-[#E2E8E2] rounded-xl p-5 flex flex-col justify-between gap-4"
                          >
                            <div className="flex gap-4">
                              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#EFF3EF]">
                                <SafeImage
                                  src={psy.image}
                                  alt={psy.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-[#52635A]">
                                  {psy.acceptingClients ? 'Menerima Klien' : 'Jadwal Penuh'} · Rating {psy.rating}
                                </p>
                                <h2 className="mt-1 text-base font-semibold text-[#17221B] truncate">
                                  {psy.name}
                                </h2>
                                <p className="text-xs text-[#52635A]">{psy.credentials}</p>
                                <p className="mt-1.5 text-xs font-medium text-[#1E3A2F]">
                                  {psy.specialty}
                                </p>
                              </div>
                            </div>

                            <p className="text-xs text-[#52635A] leading-relaxed">{psy.bio}</p>

                            <div className="pt-3 border-t border-[#EDF1ED] flex items-center justify-between gap-3">
                              <div className="text-xs text-[#52635A]">
                                <span>{psy.sessionTypes.join(' / ')}</span>
                                <span aria-hidden="true"> · </span>
                                <span className="font-medium text-[#17221B]">{psy.nextAvailable}</span>
                              </div>
                              <button
                                type="button"
                                disabled={!psy.acceptingClients && !isBooked}
                                onClick={() => onBookPsychologist(psy)}
                                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                                  isBooked
                                    ? 'bg-[#E6F4EA] text-[#14532D] border border-[#BBF7D0]'
                                    : psy.acceptingClients
                                    ? 'bg-[#1E3A2F] text-white hover:bg-[#152921] cursor-pointer'
                                    : 'bg-[#EFF3EF] text-[#8B9B91] cursor-not-allowed'
                                }`}
                              >
                                {isBooked ? 'Jadwal Dipesan' : 'Pilih Jadwal'}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. CHAT KONSELING (3-Pane Messaging matching Untitled UI chat screenshot) */}
          {activeView === 'chat' && (
            <div className="bg-white border border-[#E2E8E2] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
              {/* Left Thread List */}
              <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-[#E6EBE6] flex flex-col">
                <div className="p-4 border-b border-[#E6EBE6]">
                  <h1 className="text-sm font-semibold text-[#17221B]">Pesan Konseling</h1>
                  <p className="text-xs text-[#52635A] mt-0.5">Percakapan privat antara Anda dan psikolog terkait</p>
                </div>
                <div className="divide-y divide-[#F0F3F0]">
                  {threads.length === 0 && (
                    <p className="p-5 text-xs leading-relaxed text-[#52635A]">
                      Belum ada percakapan. Pilih profil untuk memulai komunikasi.
                    </p>
                  )}
                  {threads.map((thread) => {
                    const isSelected = thread.id === activeThread?.id;
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setActiveThreadId(thread.id)}
                        className={`w-full text-left p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#F2F6F2]' : 'hover:bg-[#F9FAF8]'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-[#EFF3EF]">
                          <SafeImage
                            src={thread.peerAvatar}
                            alt={thread.peerName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[#17221B] truncate">
                              {thread.peerName}
                            </p>
                            <span className="flex shrink-0 items-center gap-1.5">
                              <span className="text-[11px] text-[#64746B]">{thread.lastTime}</span>
                              {thread.unreadCount > 0 && <span className="rounded-full bg-[#1E3A2F] px-1.5 text-[10px] text-white">{thread.unreadCount}</span>}
                            </span>
                          </div>
                          <p className="text-xs text-[#52635A] truncate mt-1">
                            {thread.lastMessagePreview}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Center Conversation */}
              <div className="lg:col-span-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#E6EBE6]">
                {activeThread && (
                  <>
                    <div className="p-4 border-b border-[#E6EBE6] flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#17221B]">
                          {activeThread.peerName}
                        </p>
                        <p className="text-xs text-[#52635A]">{activeThread.status}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onChangeView('psychologists')}
                        className="px-3 py-1.5 text-xs font-medium text-[#1E3A2F] border border-[#D4DDD6] hover:bg-[#EFF3EF] rounded-lg cursor-pointer"
                      >
                        Lihat Profil
                      </button>
                    </div>

                    <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[420px] bg-[#FAFBF9]">
                      {activeThread.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            msg.sender === 'user' ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 text-[11px] text-[#64746B]">
                            <span>{msg.senderName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{msg.timestamp}</span>
                          </div>
                          <div
                            className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                              msg.sender === 'user'
                                ? 'bg-[#1E3A2F] text-white'
                                : 'bg-white border border-[#E2E8E2] text-[#17221B]'
                            }`}
                          >
                            <p>{msg.text}</p>
                            {msg.sender === 'user' && <p className="mt-1 text-right text-[10px] opacity-70">{msg.readAt ? 'Dibaca' : 'Terkirim'}</p>}
                            {msg.attachment && (
                              <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-2 text-xs opacity-90">
                                <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span>{msg.attachment.name}</span>
                                <span className="opacity-75">({msg.attachment.size})</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={handleChatSubmit}
                      className="p-4 border-t border-[#E6EBE6] bg-white flex items-center gap-3"
                    >
                      <label htmlFor="employee-chat-input" className="sr-only">
                        Tulis pesan konseling
                      </label>
                      <input
                        id="employee-chat-input"
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Tulis pesan tindak lanjut untuk psikolog..."
                        className="flex-1 px-3.5 py-2 text-sm bg-[#F8FAF8] border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || !chatInput.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A2F] hover:bg-[#152921] rounded-lg transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" aria-hidden="true" />
                        {sendingMessage ? 'Mengirim…' : 'Kirim'}
                      </button>
                    </form>
                  </>
                )}
                {!activeThread && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                    <MessageSquare className="h-8 w-8 text-[#64746B]" aria-hidden="true" />
                    <p className="text-sm font-semibold text-[#17221B]">Belum ada percakapan</p>
                    <p className="max-w-sm text-xs leading-relaxed text-[#52635A]">
                      Percakapan baru dapat dimulai dari daftar profil. Pesan bukan layanan darurat dan tidak menjamin balasan instan.
                    </p>
                    <button
                      type="button"
                      onClick={() => onChangeView('psychologists')}
                      className="rounded-lg bg-[#1E3A2F] px-4 py-2 text-xs font-semibold text-white"
                    >
                      Lihat profil
                    </button>
                  </div>
                )}
                {chatError && <p role="alert" className="px-4 pb-3 text-xs text-[#B91C1C]">{chatError}</p>}
              </div>

              {/* Right Context Profile */}
              <div className="lg:col-span-3 p-5 bg-[#FAFBF9] space-y-5">
                {activeThread && (
                  <>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-[#EFF3EF]">
                        <SafeImage
                          src={activeThread.peerAvatar}
                          alt={activeThread.peerName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h2 className="mt-3 text-sm font-semibold text-[#17221B]">
                        {activeThread.peerName}
                      </h2>
                      <p className="text-xs text-[#52635A]">{activeThread.peerRole}</p>
                      <p className="text-xs text-[#64746B] mt-0.5">{activeThread.peerHandle}</p>
                    </div>

                    <div className="pt-4 border-t border-[#E6EBE6] space-y-3 text-xs text-[#4A5A50]">
                      <div>
                        <p className="font-semibold text-[#17221B]">Profil</p>
                        <p className="mt-1">{activeThread.peerHandle}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#17221B]">Informasi layanan</p>
                        <p className="mt-1">Jadwal konseling belum dikonfigurasi untuk demonstrasi ini.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 5. FORM LAYANAN ADUAN ("Complaints handled with empathy.") */}
          {activeView === 'complaints' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start py-4">
              <div className="lg:col-span-5 space-y-6">
                <p className="text-xs font-semibold text-[#284B3C]">Portal Aduan Karyawan</p>
                <h1 className="font-['Fraunces'] text-3xl sm:text-4xl font-medium text-[#17221B] leading-tight">
                  Setiap aduan ditangani dengan empati.
                </h1>
                <p className="text-sm text-[#52635A] leading-relaxed">
                  Sampaikan kendala yang Anda alami di tempat kerja. Laporan hanya dapat dilihat oleh Anda dan petugas yang ditugaskan untuk menanganinya.
                </p>

                <div className="pt-4 space-y-4 border-t border-[#E2E8E2]">
                  <div className="flex items-start gap-3">
                    <Lock className="w-4 h-4 text-[#1E3A2F] mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-semibold text-[#17221B]">Privasi Terjaga &amp; Opsi Anonim</p>
                      <p className="text-xs text-[#52635A]">Identitas dapat disamarkan penuh jika Anda mengaktifkan mode anonim.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <UserCheck className="w-4 h-4 text-[#1E3A2F] mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-semibold text-[#17221B]">Penanganan Case Manager Independen</p>
                      <p className="text-xs text-[#52635A]">Setiap laporan mendapat nomor tiket dan riwayat status.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-[#1E3A2F] mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-semibold text-[#17221B]">Pembaruan Transparan</p>
                      <p className="text-xs text-[#52635A]">Pantau perkembangan investigasi maupun mediasi langsung dari aplikasi.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white border border-[#E2E8E2] rounded-2xl p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-[#17221B]">Sampaikan Aduan</h2>
                <p className="mt-1 text-xs text-[#52635A]">
                  Semua kolom yang dikirim akan tercatat secara resmi pada sistem Case Management SEJIWA.
                </p>

                {submittedCaseId && (
                  <div
                    role="status"
                    className="mt-5 p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#047857] mt-0.5 shrink-0" aria-hidden="true" />
                      <div className="text-xs text-[#065F46]">
                        <p className="font-semibold">
                          Terima kasih sudah menggunakan layanan aduan SEJIWA. Tiket Anda{' '}
                          <span className="font-mono">{submittedCaseId}</span>.
                        </p>
                        <p className="mt-1">
                          Aduan akan ditangani sesuai prosedur dan kewenangan yang berlaku. Perkembangan dapat dipantau melalui riwayat aduan di bawah.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleComplaintSubmit} className="mt-6 space-y-4">
                  <label className="flex items-center gap-2.5 text-xs font-medium text-[#17221B] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={complaintDraft.anonymous}
                      onChange={(e) =>
                        setComplaintDraft((prev) => ({ ...prev, anonymous: e.target.checked }))
                      }
                      className="rounded border-[#C6D3C9] text-[#1E3A2F]"
                    />
                    <span>Kirim laporan secara anonim (sembunyikan nama dan email saya)</span>
                  </label>

                  {!complaintDraft.anonymous && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="cmp-name" className="block text-xs font-semibold text-[#2E3D34] mb-1.5">
                          Nama Lengkap
                        </label>
                        <input
                          id="cmp-name"
                          type="text"
                          readOnly
                          value={complaintDraft.reporterName}
                          className="w-full px-3.5 py-2 text-sm bg-[#F1F4F1] border border-[#D4DDD6] rounded-lg"
                        />
                        {complaintErrors.reporterName && (
                          <p className="mt-1 text-xs text-[#B91C1C]">{complaintErrors.reporterName}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="cmp-email" className="block text-xs font-semibold text-[#2E3D34] mb-1.5">
                          Alamat Email
                        </label>
                        <input
                          id="cmp-email"
                          type="email"
                          readOnly
                          value={complaintDraft.reporterEmail}
                          className="w-full px-3.5 py-2 text-sm bg-[#F1F4F1] border border-[#D4DDD6] rounded-lg"
                        />
                        {complaintErrors.reporterEmail && (
                          <p className="mt-1 text-xs text-[#B91C1C]">{complaintErrors.reporterEmail}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cmp-cat" className="block text-xs font-semibold text-[#2E3D34] mb-1.5">
                        Kategori Aduan
                      </label>
                      <select
                        id="cmp-cat"
                        value={complaintDraft.category}
                        onChange={(e) =>
                          setComplaintDraft((prev) => ({
                            ...prev,
                            category: e.target.value as ComplaintCase['type'],
                          }))
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F8FAF8] border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                      >
                        <option value="Burnout">Burnout &amp; Beban Kerja</option>
                        <option value="Workplace Stress">Stres Lingkungan Kerja</option>
                        <option value="Harassment">Perilaku Tidak Pantas / Harassment</option>
                        <option value="Policy Conflict">Konflik Kebijakan</option>
                        <option value="Interpersonal">Konflik Interpersonal</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="cmp-dept" className="block text-xs font-semibold text-[#2E3D34] mb-1.5">
                        Divisi Terkait
                      </label>
                      <input
                        id="cmp-dept"
                        type="text"
                        required
                        minLength={2}
                        maxLength={100}
                        value={complaintDraft.department}
                        onChange={(e) =>
                          setComplaintDraft((prev) => ({ ...prev, department: e.target.value }))
                        }
                        className="w-full px-3.5 py-2 text-sm bg-[#F8FAF8] border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cmp-desc" className="block text-xs font-semibold text-[#2E3D34] mb-1.5">
                      Kronologi &amp; Detail Kejadian
                    </label>
                    <textarea
                      id="cmp-desc"
                      rows={4}
                      required
                      minLength={20}
                      value={complaintDraft.description}
                      maxLength={5000}
                      onChange={(e) =>
                        setComplaintDraft((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Ceritakan situasi yang Anda alami secara jelas agar Case Manager dapat menindaklanjuti dengan tepat..."
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAF8] border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                    />
                    {complaintErrors.description && (
                      <p role="alert" className="mt-1 text-xs text-[#B91C1C]">
                        {complaintErrors.description}
                      </p>
                    )}
                    <p className="mt-1 text-right text-[11px] text-[#64746B]">
                      {complaintDraft.description.trim().length}/5.000 · minimal 20 karakter
                    </p>
                  </div>

                  <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[#52635A]">
                    <input
                      type="checkbox"
                      checked={complaintTermsAccepted}
                      onChange={(event) => setComplaintTermsAccepted(event.target.checked)}
                      className="mt-0.5 accent-[#1E3A2F]"
                    />
                    <span>
                      Saya menyetujui pemrosesan informasi ini untuk penanganan laporan. Data hanya dapat diakses pihak yang berwenang.
                    </span>
                  </label>

                  {complaintSubmitError && (
                    <p role="alert" className="text-xs text-[#B91C1C]">{complaintSubmitError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingComplaint}
                    className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#17221B] hover:bg-[#1E3A2F] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  >
                    {submittingComplaint ? 'Mengirim…' : 'Kirim Aduan'}
                  </button>
                </form>
              </div>

              <section className="lg:col-span-12 rounded-2xl border border-[#E2E8E2] bg-white p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-[#17221B]">Riwayat Aduan Saya</h2>
                <p className="mt-1 text-xs text-[#52635A]">Hanya tiket yang terkait dengan akun Anda yang ditampilkan.</p>
                {cases.length === 0 ? (
                  <p className="mt-5 rounded-xl bg-[#F8FAF8] p-5 text-sm text-[#52635A]">
                    Belum ada laporan. Jika Anda mengirim aduan, nomor tiket dan perkembangannya akan muncul di sini.
                  </p>
                ) : (
                  <div className="mt-5 divide-y divide-[#E6EBE6]">
                    {cases.map((item) => (
                      <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs font-semibold text-[#1E3A2F]">{item.id}</p>
                            <h3 className="mt-1 text-sm font-semibold text-[#17221B]">{item.type}</h3>
                            <p className="mt-1 text-xs text-[#52635A]">{item.createdDate} · {item.department}</p>
                          </div>
                          <span className="rounded-full bg-[#EFF3EF] px-3 py-1 text-xs font-medium text-[#1E3A2F]">{item.status}</span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-[#46574D]">{item.summary}</p>
                        <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                          {item.timeline.map((event) => (
                            <li key={event.id} className="text-[11px] text-[#64746B]">{event.label} · {event.date}</li>
                          ))}
                        </ol>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 6. PROFIL DAN PENGATURAN (matching soft sage Settings screenshot) */}
          {activeView === 'settings' && (
            <div className="bg-[#EEF3ED] border border-[#DCE4DB] rounded-2xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-3 space-y-1">
                <p className="px-3 text-xs font-semibold text-[#52635A] mb-2">Pengaturan Pribadi</p>
                {(
                  [
                    { id: 'profile', label: 'Profil Saya' },
                    { id: 'notifications', label: 'Notifikasi' },
                    { id: 'security', label: 'Privasi & Keamanan' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSettingsTab(tab.id)}
                    className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      settingsTab === tab.id
                        ? 'bg-white text-[#17221B] shadow-sm'
                        : 'text-[#4A5A50] hover:bg-white/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="md:col-span-9 space-y-6">
                <h1 className="font-['Fraunces'] text-2xl font-medium text-[#17221B]">
                  Pengaturan Akun
                </h1>

                {settingsTab === 'profile' && (
                  <div className="bg-[#E5ECE4] rounded-xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-[#17221B]">Informasi Profil</h2>
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="text-xs font-medium text-[#52635A]">
                          Nama lengkap
                          <input
                            required
                            minLength={2}
                            maxLength={120}
                            value={profileName}
                            onChange={(event) => setProfileName(event.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 py-2 text-sm text-[#17221B]"
                          />
                        </label>
                        <label className="text-xs font-medium text-[#52635A]">
                          Email
                          <input readOnly value={user.email} className="mt-1.5 w-full rounded-lg border border-[#D4DDD6] bg-[#F8FAF8] px-3 py-2 text-sm text-[#52635A]" />
                        </label>
                        <label className="text-xs font-medium text-[#52635A]">
                          Departemen
                          <input
                            maxLength={100}
                            value={profileDepartment}
                            onChange={(event) => setProfileDepartment(event.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 py-2 text-sm text-[#17221B]"
                          />
                        </label>
                        <label className="text-xs font-medium text-[#52635A]">
                          Posisi
                          <input
                            maxLength={100}
                            value={profilePosition}
                            onChange={(event) => setProfilePosition(event.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-[#D4DDD6] bg-white px-3 py-2 text-sm text-[#17221B]"
                          />
                        </label>
                      </div>
                      {profileMessage && <p role="status" className="text-xs text-[#1E3A2F]">{profileMessage}</p>}
                      <button type="submit" disabled={savingProfile} className="rounded-lg bg-[#1E3A2F] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                        {savingProfile ? 'Menyimpan…' : 'Simpan profil'}
                      </button>
                    </form>
                  </div>
                )}

                {settingsTab === 'notifications' && (
                  <div className="bg-[#E5ECE4] rounded-xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-[#17221B]">Notifikasi aplikasi</h2>
                    <p className="text-xs leading-relaxed text-[#52635A]">
                      Notifikasi dibuat saat pesan atau status aduan berubah. Pengiriman email, SMS, dan WhatsApp belum dikonfigurasi.
                    </p>
                    {notificationError && <p role="alert" className="text-xs text-[#B91C1C]">{notificationError}</p>}
                    {notifications.length === 0 ? (
                      <p className="rounded-lg bg-[#EEF3ED] p-4 text-xs text-[#52635A]">Belum ada notifikasi.</p>
                    ) : (
                      <ul className="divide-y divide-[#DCE4DB]">
                        {notifications.map((notification) => (
                          <li key={notification.id} className="flex items-start justify-between gap-4 py-4">
                            <div>
                              <p className={`text-xs ${notification.readAt ? 'font-medium' : 'font-semibold'} text-[#17221B}`}>
                                {notification.title}
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-[#52635A]">{notification.body}</p>
                              <p className="mt-1 text-[11px] text-[#64746B]">{new Date(notification.createdAt).toLocaleString('id-ID')}</p>
                            </div>
                            {!notification.readAt && (
                              <button type="button" onClick={() => void handleReadNotification(notification)} className="shrink-0 text-xs font-semibold text-[#1E3A2F] hover:underline">
                                Tandai dibaca
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {settingsTab === 'security' && (
                  <div className="bg-[#E5ECE4] rounded-xl p-6 space-y-3 text-xs text-[#36453C]">
                    <h2 className="text-sm font-semibold text-[#17221B]">Batas akses data</h2>
                    <p className="leading-relaxed">
                      Riwayat aduan pada akun ini hanya dapat dibuka oleh Anda dan petugas yang ditugaskan. Percakapan konseling hanya dapat dibuka oleh Anda dan psikolog terkait. SEJIWA demonstrasi ini tidak menyediakan diagnosis atau layanan darurat.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
