import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Lock,
  MapPin,
  ShieldCheck,
  Video,
} from 'lucide-react';
import type { PublicSection } from '../../types/sejiwa';
import { ASSETS, COUNSELING_TOPICS } from '../../data/seedData';
import { SafeImage } from '../common/SafeImage';

interface PublicWebsiteProps {
  onAuthenticate: (input: {
    mode: 'login' | 'register';
    accountType: 'user' | 'admin';
    name: string;
    email: string;
    password: string;
    termsAccepted: boolean;
  }) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<{ message: string; resetUrl?: string }>;
  onResetPassword: (token: string, password: string) => Promise<void>;
}

export function PublicWebsite({ onAuthenticate, onRequestPasswordReset, onResetPassword }: PublicWebsiteProps) {
  const [activeSection, setActiveSection] = useState<PublicSection>(
    () => new URLSearchParams(window.location.search).has('resetToken') ? 'auth' : 'landing'
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string>('stres');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(
    () => new URLSearchParams(window.location.search).has('resetToken') ? 'reset' : 'login'
  );
  const [authAudience, setAuthAudience] = useState<'user' | 'admin'>('user');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('resetToken') || '');
  const [resetUrl, setResetUrl] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeTopic =
    COUNSELING_TOPICS.find((t) => t.id === selectedTopicId) ?? COUNSELING_TOPICS[0];

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    try {
      if (authMode === 'forgot') {
        if (!email.includes('@')) throw new Error('Masukkan alamat email yang valid.');
        const result = await onRequestPasswordReset(email.trim());
        setResetUrl(result.resetUrl || '');
        setResetMessage(result.message);
      } else if (authMode === 'reset') {
        if (!resetToken) throw new Error('Tautan pemulihan tidak ditemukan. Minta tautan baru.');
        if (password.length < 12) throw new Error('Kata sandi harus memiliki minimal 12 karakter.');
        if (password !== confirmPassword) throw new Error('Konfirmasi kata sandi belum sama.');
        await onResetPassword(resetToken, password);
        window.history.replaceState({}, '', `${window.location.pathname}#auth`);
        setResetToken('');
        setAuthMode('login');
        setPassword('');
        setConfirmPassword('');
        setResetMessage('Kata sandi berhasil diatur ulang. Silakan masuk dengan kata sandi baru.');
      } else {
        if (!email.includes('@') || (authMode === 'register' && password.length < 12)) {
          throw new Error('Masukkan email valid dan kata sandi minimal 12 karakter.');
        }
        if (authMode === 'register' && !termsAccepted) {
          throw new Error('Setujui syarat dan ketentuan sebelum mendaftar.');
        }
        if (authMode === 'register' && fullName.trim().length < 2) {
          throw new Error('Masukkan nama lengkap Anda untuk mendaftar.');
        }
        if (authMode === 'register' && password !== confirmPassword) {
          throw new Error('Konfirmasi kata sandi belum sama.');
        }
        await onAuthenticate({
          mode: authMode,
          accountType: authAudience,
          name: fullName.trim(),
          email: email.trim(),
          password,
          termsAccepted,
        });
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Proses belum berhasil. Silakan coba kembali.');
    } finally {
      setSubmitting(false);
    }
  };

  const setAudience = (audience: 'user' | 'admin') => {
    setAuthAudience(audience);
    setAuthMode('login');
    setAuthError('');
    setResetMessage('');
  };

  const onEnterPortal = (
    _portal: 'employee' | 'psychologist' | 'casemanager' | 'admin',
    options?: { topicArea?: string; employeeView?: 'psychologists' | 'dashboard' },
  ) => {
    if (options?.topicArea) setSelectedTopicId(
      COUNSELING_TOPICS.find((topic) => topic.label === options.topicArea)?.id || 'stres'
    );
    setActiveSection('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (activeSection === 'auth') {
    return (
      <div className="min-h-screen bg-[#F9FAF8] flex flex-col">
        {/* Strict 3-Zone Top Bar */}
        <header className="w-full border-b border-[#E3E8E3] bg-white/95 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
            <button
              type="button"
              onClick={() => setActiveSection('landing')}
              className="font-['Fraunces'] text-xl font-semibold tracking-tight text-[#1E3A2F] whitespace-nowrap shrink-0 cursor-pointer"
            >
              SEJIWA
            </button>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4A5A50]">
              <button
                type="button"
                onClick={() => setActiveSection('landing')}
                className="hover:text-[#1E3A2F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Beranda
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('about')}
                className="hover:text-[#1E3A2F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Tentang Kami
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('services')}
                className="hover:text-[#1E3A2F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Layanan
              </button>
            </nav>
            <button
              type="button"
              onClick={() => setActiveSection('landing')}
              className="px-4 py-2 text-xs font-semibold text-[#1E3A2F] border border-[#CBD5CD] rounded-lg hover:bg-[#EEF2EE] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Kembali ke Beranda
            </button>
          </div>
        </header>

        {/* Split Login / Register Layout (inspired by reference Login & Register) */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-64px)]">
          <div className="flex items-center justify-center px-6 py-12 bg-white">
            <div className="w-full max-w-md space-y-6">
              <div>
                <h1 className="font-['Fraunces'] text-3xl font-semibold text-[#17221B] tracking-tight">
                  {authMode === 'reset'
                    ? 'Atur ulang kata sandi'
                    : authMode === 'forgot'
                      ? 'Pulihkan akun SEJIWA'
                      : authMode === 'register'
                        ? 'Buat akun SEJIWA'
                        : authAudience === 'admin' ? 'Masuk administrator' : 'Selamat datang kembali'}
                </h1>
                <p className="mt-2 text-sm text-[#52635A] leading-relaxed">
                  {authMode === 'reset'
                    ? 'Buat kata sandi baru. Gunakan minimal 12 karakter.'
                    : authMode === 'forgot'
                      ? 'Masukkan email akun Anda. Jika terdaftar, kami akan mengirim tautan pemulihan.'
                      : authMode === 'register'
                        ? 'Buat akun pengguna untuk mencari dukungan dan mengakses layanan SEJIWA.'
                        : authAudience === 'admin'
                          ? 'Akses khusus administrator. Akun administrator hanya dibuat oleh pengelola.'
                          : 'Masuk untuk mencari dukungan psikologis dan mengakses layanan SEJIWA.'}
                </p>
              </div>

              {!['forgot', 'reset'].includes(authMode) && <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#EFF3EF] p-1">
                <button
                  type="button"
                  onClick={() => setAudience('user')}
                  className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
                    authAudience === 'user' ? 'bg-white text-[#17221B] shadow-sm' : 'text-[#52635A]'
                  }`}
                >
                  Pengguna layanan
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('admin')}
                  className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
                    authAudience === 'admin' ? 'bg-white text-[#17221B] shadow-sm' : 'text-[#52635A]'
                  }`}
                >
                  Administrator
                </button>
              </div>}

              {authAudience === 'user' && !['forgot', 'reset'].includes(authMode) && (
              <div className="inline-flex p-1 bg-[#EFF3EF] rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError('');
                    setResetMessage('');
                  }}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-white text-[#17221B] shadow-sm'
                      : 'text-[#52635A] hover:text-[#17221B]'
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError('');
                    setResetMessage('');
                  }}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-white text-[#17221B] shadow-sm'
                      : 'text-[#52635A] hover:text-[#17221B]'
                  }`}
                >
                  Daftar Akun
                </button>
              </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'register' && (
                  <div>
                    <label htmlFor="auth-fullname" className="block text-xs font-semibold text-[#2E3D34] mb-1.5">
                      Nama Lengkap
                    </label>
                    <input
                      id="auth-fullname"
                      type="text"
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Nadhira Alyssa"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                    />
                  </div>
                )}

                {authMode !== 'reset' && <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold text-[#2E3D34] mb-1.5">
                    Alamat Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="nama@perusahaan.id"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                  />
                </div>}

                {authMode !== 'forgot' && <div>
                  <label htmlFor="auth-password" className="block text-xs font-semibold text-[#2E3D34] mb-1.5">
                    {authMode === 'reset' ? 'Kata Sandi Baru' : 'Kata Sandi'}
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Minimal 12 karakter"
                    minLength={12}
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                  />
                </div>}

                {(authMode === 'register' || authMode === 'reset') && (
                  <div>
                    <label htmlFor="auth-confirm-password" className="block text-xs font-semibold text-[#2E3D34] mb-1.5">
                      {authMode === 'reset' ? 'Konfirmasi Kata Sandi Baru' : 'Konfirmasi Kata Sandi'}
                    </label>
                    <input
                      id="auth-confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4DDD6] rounded-lg focus:outline-none focus:border-[#1E3A2F]"
                    />
                  </div>
                )}

                {authMode === 'register' && <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[#52635A]">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-0.5 accent-[#1E3A2F]"
                  />
                  <span>Saya telah membaca dan menyetujui syarat penggunaan serta pemrosesan data SEJIWA.</span>
                </label>}

                {resetMessage && <p role="status" className="text-xs font-medium text-[#166534]">{resetMessage}</p>}
                {resetUrl && (
                  <p className="rounded-lg bg-[#EFF3EF] p-3 text-xs leading-relaxed text-[#2E3D34]">
                    Tautan pemulihan untuk pengujian lokal:{' '}
                    <a href={resetUrl} className="font-semibold underline">Buka formulir reset</a>
                  </p>
                )}
                {authError && (
                  <p role="alert" className="text-xs font-medium text-[#B91C1C]">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1E3A2F] hover:bg-[#162C23] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {submitting
                    ? 'Memproses…'
                    : authMode === 'register'
                      ? 'Daftar & Mulai'
                      : authMode === 'forgot'
                        ? 'Kirim tautan pemulihan'
                        : authMode === 'reset'
                          ? 'Simpan kata sandi baru'
                          : authAudience === 'admin' ? 'Masuk sebagai administrator' : 'Masuk ke SEJIWA'}
                </button>
              </form>

              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('forgot');
                    setAuthError('');
                    setResetMessage('');
                    setResetUrl('');
                  }}
                  className="text-xs font-semibold text-[#1E3A2F] hover:underline"
                >
                  Lupa kata sandi?
                </button>
              )}
              {(authMode === 'forgot' || authMode === 'reset') && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError('');
                    setResetMessage('');
                    setResetUrl('');
                  }}
                  className="text-xs font-semibold text-[#1E3A2F] hover:underline"
                >
                  Kembali ke masuk
                </button>
              )}

              <p className="pt-4 border-t border-[#E6EBE7] text-xs leading-relaxed text-[#52635A]">
                {authAudience === 'admin'
                  ? 'Portal administrator terpisah dari pendaftaran pengguna. Jika belum memiliki akun, hubungi pengelola SEJIWA.'
                  : 'Pendaftaran membuat akun pengguna layanan. Akun administrator dan petugas dibuat oleh pengelola.'}
              </p>
            </div>
          </div>

          <div className="hidden lg:flex relative bg-[#DDE6DF] items-center justify-center p-12 overflow-hidden">
            <div className="relative w-full max-w-lg aspect-[4/3] rounded-2xl overflow-hidden border border-[#C6D3C9]">
              <SafeImage
                src={ASSETS.mindfulnessCalm}
                alt="Suasana tenang di ruang pemulihan SEJIWA"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#16271F]/80 via-[#16271F]/20 to-transparent flex flex-col justify-end p-8 text-white">
                <p className="font-['Fraunces'] text-2xl font-medium leading-snug">
                  “Percakapan dan aduan hanya dapat diakses sesuai peran dan kewenangan.”
                </p>
                <p className="mt-2 text-xs text-white/80">SEJIWA · Ruang aman untuk bertumbuh bersama</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAF8] text-[#17221B]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="w-full border-b border-[#E3E8E3] bg-white/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#beranda"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-['Fraunces'] text-xl font-semibold tracking-tight text-[#1E3A2F] whitespace-nowrap shrink-0"
          >
            SEJIWA
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4A5A50]">
            <a
              href="#beranda"
              onClick={() => setActiveSection('landing')}
              className="hover:text-[#1E3A2F] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Beranda
            </a>
            <a
              href="#topik-konseling"
              className="hover:text-[#1E3A2F] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Topik Konseling
            </a>
            <a
              href="#tentang-sejiwa"
              className="hover:text-[#1E3A2F] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Tentang Kami
            </a>
            <a
              href="#layanan"
              className="hover:text-[#1E3A2F] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Layanan
            </a>
            <button
              type="button"
              onClick={() => setActiveSection('auth')}
              className="hover:text-[#1E3A2F] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Masuk
            </button>
          </nav>

          <button
            type="button"
            onClick={() => setActiveSection('auth')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A2F] hover:bg-[#152921] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Masuk / Daftar
          </button>
        </div>
      </header>

      <main>
        {/* Hero Section (Aurora Wellness calm nature aesthetic + Indonesian copy) */}
        <section id="beranda" className="max-w-[1200px] mx-auto px-6 pt-8 pb-12">
          <div className="relative rounded-2xl overflow-hidden border border-[#DCE3DD] min-h-[500px] lg:min-h-[540px] flex items-center justify-center text-center">
            <SafeImage
              src={ASSETS.heroNature}
              alt="Danau pegunungan berkabut yang tenang sebagai simbol ketenangan pikiran"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#13221B]/55 via-[#13221B]/45 to-[#13221B]/70" />

            <div className="relative z-10 max-w-2xl px-6 py-16 text-white">
              <p className="text-xs font-medium tracking-wide text-white/85 mb-4">
                SEJIWA · Platform pendukung kesejahteraan psikologis pekerja
              </p>
              <h1 className="font-['Fraunces'] text-[clamp(2.25rem,4vw,3.65rem)] font-medium leading-[1.12] tracking-tight">
                Temukan keseimbangan. Pulih dengan tenang.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-white/90 leading-relaxed max-w-xl mx-auto">
                Memahami diri adalah proses yang tidak harus dijalani sendirian. SEJIWA menyediakan ruang untuk belajar, mencari dukungan, dan menyampaikan kendala di tempat kerja.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => onEnterPortal('employee', { employeeView: 'psychologists' })}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#17221B] bg-white hover:bg-[#EEF2EE] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cari Psikolog Sekarang
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <a
                  href="#topik-konseling"
                  className="px-5 py-3 text-sm font-medium text-white border border-white/40 hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap"
                >
                  Jelajahi Topik
                </a>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#E2E8E2] bg-white px-5 py-3.5 text-xs leading-relaxed text-[#52635A]">
            <strong className="text-[#17221B]">Mode demonstrasi.</strong> Profil psikolog, konten, dan data contoh bukan layanan atau kredensial profesional yang telah diverifikasi.
          </div>
        </section>

        {/* Interactive Counseling Topics Explorer (Halodoc-inspired clarity, zero pill clutter) */}
        <section id="topik-konseling" className="max-w-[1200px] mx-auto px-6 py-14 border-t border-[#E6EBE6]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#284B3C]">
              Jangan abaikan kesehatan mentalmu
            </p>
            <h2 className="mt-2 font-['Fraunces'] text-3xl sm:text-4xl font-medium text-[#17221B] tracking-tight">
              Jelajahi Topik Konseling Umum
            </h2>
            <p className="mt-2 text-sm text-[#52635A]">
              Pilih kondisi yang sedang Anda hadapi untuk memahami pendekatan klinis yang sesuai.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Topik konseling psikologi"
            className="mt-7 flex flex-wrap gap-2"
          >
            {COUNSELING_TOPICS.map((topic) => {
              const isSelected = topic.id === selectedTopicId;
              return (
                <button
                  key={topic.id}
                  role="tab"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-[#1E3A2F] text-white border-[#1E3A2F]'
                      : 'bg-white text-[#3B4A41] border-[#DCE3DD] hover:border-[#9EB3A4]'
                  }`}
                >
                  {topic.label}
                </button>
              );
            })}
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch bg-white border border-[#E2E8E2] rounded-2xl p-6 sm:p-10">
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="font-['Fraunces'] text-2xl font-medium text-[#17221B]">
                  {activeTopic.headline}
                </h3>
                {activeTopic.paragraphs.map((paragraph, index) => (
                  <p key={index} className="text-base text-[#46574D] leading-relaxed">
                    {paragraph}
                  </p>
                ))}
                <div className="pt-2 text-xs text-[#52635A]">
                  Pendekatan yang disarankan:{' '}
                  <span className="font-semibold text-[#1E3A2F]">
                    {activeTopic.recommendedApproach}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onEnterPortal('employee', {
                      topicArea: activeTopic.label,
                      employeeView: 'psychologists',
                    })
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1E3A2F] hover:bg-[#152921] rounded-lg transition-colors cursor-pointer"
                >
                  Carikan Ahli untuk {activeTopic.label}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full min-h-[280px] rounded-xl overflow-hidden bg-[#EFF3EF]">
                <SafeImage
                  src={ASSETS.psychologistFemale}
                  alt="Psikolog klinis SEJIWA siap mendampingi sesi konseling"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Online & Offline Counseling Mode Choice (Bicarakan.id & Ibunda inspired) */}
        <section className="max-w-[1200px] mx-auto px-6 py-14 border-t border-[#E6EBE6]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div>
                <p className="text-xs font-semibold text-[#284B3C]">
                  Pilihan dukungan yang dapat disesuaikan
                </p>
                <h2 className="mt-2 font-['Fraunces'] text-3xl sm:text-4xl font-medium text-[#17221B] leading-tight">
                  Disinilah Tempatmu Sembuh dan Bertumbuh Secara Psikologis
                </h2>
                <p className="mt-3 text-base text-[#52635A]">
                  Dukungan seperti apa yang paling nyaman untuk Anda minggu ini?
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => onEnterPortal('employee', { employeeView: 'psychologists' })}
                  className="group text-left bg-white border border-[#DCE3DD] hover:border-[#1E3A2F] rounded-xl p-5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[#1E3A2F]">
                    <Video className="w-5 h-5" aria-hidden="true" />
                    <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-xs text-[#52635A]">Konseling untuk saya</p>
                  <p className="mt-1 text-base font-semibold text-[#17221B]">Konseling Online</p>
                  <p className="mt-1.5 text-xs text-[#52635A] leading-relaxed">
                    Ruang percakapan daring untuk menghubungi profil yang tersedia setelah layanan dikonfigurasi.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onEnterPortal('employee', { employeeView: 'psychologists' })}
                  className="group text-left bg-white border border-[#DCE3DD] hover:border-[#1E3A2F] rounded-xl p-5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[#1E3A2F]">
                    <MapPin className="w-5 h-5" aria-hidden="true" />
                    <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-xs text-[#52635A]">Tatap muka langsung</p>
                  <p className="mt-1 text-base font-semibold text-[#17221B]">Konseling Offline</p>
                  <p className="mt-1.5 text-xs text-[#52635A] leading-relaxed">
                    Ruang konsultasi tenang dan privat di Jakarta Selatan, Jakarta Pusat, dan Bandung.
                  </p>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full min-h-[300px] rounded-2xl overflow-hidden border border-[#DCE3DD]">
                <SafeImage
                  src={ASSETS.counselingSession}
                  alt="Sesi konseling tatap muka yang hangat di ruang klinik SEJIWA"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* About SEJIWA Section (Staggered 5-card visual rhythm from reference) */}
        <section id="tentang-sejiwa" className="bg-white border-y border-[#E6EBE6] py-16">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-xs font-semibold text-[#284B3C]">Kisah Kami · Tentang SEJIWA</p>
              <h2 className="mt-3 font-['Fraunces'] text-3xl sm:text-4xl font-medium text-[#17221B] leading-tight">
                Mendampingi Pikiran dengan Empati, Ilmu Psikologi, dan Ruang Aman Tanpa Stigma
              </h2>
              <p className="mt-4 text-sm sm:text-base text-[#52635A] leading-relaxed">
                SEJIWA dirancang sebagai ruang digital untuk edukasi kesejahteraan psikologis, percakapan konseling, dan laporan lingkungan kerja. Situs ini masih berupa demonstrasi produk; layanan profesional belum aktif.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-center">
              <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-[#E2E8E2]">
                <SafeImage src={ASSETS.heroNature} alt="Ruang alam tenang" className="w-full h-full object-cover" />
              </div>
              <div className="aspect-square rounded-2xl overflow-hidden border border-[#E2E8E2] lg:translate-y-4">
                <SafeImage src={ASSETS.psychologistFemale} alt="Psikolog klinis SEJIWA" className="w-full h-full object-cover" />
              </div>
              <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-[#E2E8E2] lg:translate-y-8">
                <SafeImage src={ASSETS.mindfulnessCalm} alt="Latihan pernapasan sadar" className="w-full h-full object-cover" />
              </div>
              <div className="aspect-square rounded-2xl overflow-hidden border border-[#E2E8E2] lg:translate-y-4">
                <SafeImage src={ASSETS.psychologistMale} alt="Psikolog organisasi SEJIWA" className="w-full h-full object-cover" />
              </div>
              <div className="col-span-2 sm:col-span-1 aspect-[3/4] rounded-2xl overflow-hidden border border-[#E2E8E2]">
                <SafeImage src={ASSETS.counselingSession} alt="Pendampingan konseling" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </section>

        {/* Services Section (Targeted Solutions for Mind & Workplace from reference) */}
        <section id="layanan" className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#284B3C]">Layanan Terarah</p>
              <h2 className="mt-2 font-['Fraunces'] text-3xl font-medium text-[#17221B]">
                Solusi Tepat untuk Pikiran dan Lingkungan Kerja
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onEnterPortal('employee', { employeeView: 'psychologists' })}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A2F] hover:bg-[#152921] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Lihat Semua Layanan
            </button>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <article className="bg-white border border-[#E2E8E2] rounded-xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] overflow-hidden bg-[#EFF3EF]">
                <SafeImage
                  src={ASSETS.counselingSession}
                  alt="Konseling Klinis dan Terapi"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-['Fraunces'] text-xl font-medium text-[#17221B]">
                    01. Konseling Klinis 1-on-1
                  </h3>
                  <p className="mt-2 text-sm text-[#52635A] leading-relaxed">
                    Alur demonstrasi untuk memulai komunikasi dengan profil psikolog setelah verifikasi dan konfigurasi layanan.
                  </p>
                </div>
                <div className="text-xs text-[#52635A] flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#1E3A2F]" aria-hidden="true" />
                  <span>Jadwal layanan belum dikonfigurasi</span>
                </div>
              </div>
            </article>

            <article className="bg-white border border-[#E2E8E2] rounded-xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] overflow-hidden bg-[#EFF3EF]">
                <SafeImage
                  src={ASSETS.mindfulnessCalm}
                  alt="Program Kesejahteraan Karyawan"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-['Fraunces'] text-xl font-medium text-[#17221B]">
                    02. Manajemen Stres &amp; Burnout
                  </h3>
                  <p className="mt-2 text-sm text-[#52635A] leading-relaxed">
                    Pemantauan indeks stres berkala, materi psikoedukasi terkurasi, serta sesi coaching batas kerja sehat.
                  </p>
                </div>
                <div className="text-xs text-[#52635A] flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1E3A2F]" aria-hidden="true" />
                  <span>Materi edukasi tersedia di portal</span>
                </div>
              </div>
            </article>

            <article className="bg-white border border-[#E2E8E2] rounded-xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] overflow-hidden bg-[#EFF3EF]">
                <SafeImage
                  src={ASSETS.heroNature}
                  alt="Layanan Aduan & Perlindungan Karyawan"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-['Fraunces'] text-xl font-medium text-[#17221B]">
                    03. Layanan Aduan Empatik
                  </h3>
                  <p className="mt-2 text-sm text-[#52635A] leading-relaxed">
                    Saluran laporan dengan akses terbatas untuk petugas yang ditugaskan sesuai kebijakan platform.
                  </p>
                </div>
                <div className="text-xs text-[#52635A] flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#1E3A2F]" aria-hidden="true" />
                  <span>Akses laporan dibatasi berdasarkan peran</span>
                </div>
              </div>
            </article>
          </div>

          <div className="mt-10 bg-[#EFF3EF] rounded-xl p-6 sm:p-8">
            <p className="text-sm font-semibold text-[#17221B]">Informasi penting</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#4A5A50]">
              Situs ini merupakan demonstrasi produk. Profil tenaga profesional dan ketersediaan layanan belum diverifikasi. SEJIWA bukan layanan darurat, diagnosis, atau pengganti pendampingan profesional.
            </p>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E3E8E3] bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-['Fraunces'] text-lg font-semibold text-[#1E3A2F]">SEJIWA</p>
            <p className="mt-1 text-xs text-[#52635A] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1E3A2F]" aria-hidden="true" />
              Sejahtera Jiwa, Wadah Aman · Demonstrasi produk
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-[#52635A]">
            <button
              type="button"
              onClick={() => setActiveSection('auth')}
              className="hover:text-[#17221B] cursor-pointer"
            >
              Masuk / Daftar
            </button>
            <span>© 2026 SEJIWA Wellness</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
