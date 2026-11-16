import { useCallback, useEffect, useState } from 'react';
import type {
  CaseStatus,
  ChatThread,
  ComplaintCase,
  EmployeeView,
  PortalMode,
  Psychologist,
} from './types/sejiwa';
import { AdminPortal } from './components/admin/AdminPortal';
import { CaseManagerPortal } from './components/casemanager/CaseManagerPortal';
import { EmployeeApp } from './components/employee/EmployeeApp';
import { PsychologistPortal } from './components/psychologist/PsychologistPortal';
import { PublicWebsite } from './components/public/PublicWebsite';
import { api, type AppBootstrap, type AuthUser, type ComplaintDraftPayload, type NotificationItem } from './services/api';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [portalMode, setPortalMode] = useState<PortalMode>('public');
  const [employeeView, setEmployeeView] = useState<EmployeeView>('dashboard');
  const [topicFilter, setTopicFilter] = useState<string | undefined>();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [portalError, setPortalError] = useState('');

  const applyBootstrap = useCallback((data: AppBootstrap) => {
    setBootstrap(data);
    setUser(data.user);
    setPortalMode(data.portal);
  }, []);

  const refresh = useCallback(async () => {
    const data = await api.bootstrap();
    applyBootstrap(data);
    return data;
  }, [applyBootstrap]);

  useEffect(() => {
    let active = true;
    api.me()
      .then((session) => session.user ? api.bootstrap() : null)
      .then((data) => {
        if (active && data) applyBootstrap(data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Layanan belum dapat dijangkau.';
        setPortalError(message);
      })
      .finally(() => {
        if (active) setBootstrapping(false);
      });
    return () => {
      active = false;
    };
  }, [applyBootstrap]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      refresh().catch((error: unknown) => {
        setPortalError(error instanceof Error ? error.message : 'Data belum dapat diperbarui.');
      });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh, user]);

  const handleAuthenticate = async (input: {
    mode: 'login' | 'register';
    accountType: 'user' | 'admin';
    name: string;
    email: string;
    password: string;
    termsAccepted: boolean;
  }) => {
    setPortalError('');
    const result = input.mode === 'register'
      ? await api.register(input.name, input.email, input.password, input.termsAccepted)
      : await api.login(input.email, input.password, input.accountType);
    setUser(result.user);
    setPortalMode(result.portal);
    setEmployeeView('dashboard');
    await refresh();
  };

  const handleRequestPasswordReset = (email: string) => api.requestPasswordReset(email);
  const handleResetPassword = async (token: string, password: string) => {
    await api.resetPassword(token, password);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setBootstrap(null);
      setUser(null);
      setPortalMode('public');
      setPortalError('');
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : 'Keluar belum berhasil.');
    }
  };

  const handleSwitchPortal = (portal: PortalMode) => {
    if (portal === 'public') {
      void handleLogout();
      return;
    }
    if (portal === user?.role) setPortalMode(portal);
  };

  const handleBookPsychologist = async (psychologist: Psychologist) => {
    try {
      const result = await api.createConversation(psychologist.id);
      setBootstrap((current) => current ? { ...current, threads: result.threads } : current);
      setEmployeeView('chat');
      return result.conversationId;
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : 'Percakapan belum dapat dibuat.');
      return undefined;
    }
  };

  const handleSendMessage = async (threadId: string, text: string) => {
    try {
      const result = await api.sendMessage(threadId, text);
      setBootstrap((current) => current ? { ...current, threads: result.threads } : current);
      setPortalError('');
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : 'Pesan belum dapat dikirim.');
      throw error;
    }
  };

  const handleSendAssistantMessage = async (text: string) => {
    try {
      const result = await api.sendAssistantMessage(text);
      setBootstrap((current) => current
        ? { ...current, assistantMessages: result.messages }
        : current);
      setPortalError('');
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : 'Pesan belum dapat dijawab.');
      throw error;
    }
  };

  const handleMarkConversationRead = useCallback(async (threadId: string) => {
    const { readAt } = await api.markConversationRead(threadId);
    const ownSender = user?.role === 'employee' ? 'user' : 'peer';
    setBootstrap((current) => current
      ? {
          ...current,
          threads: current.threads.map((thread) => thread.id === threadId
            ? {
                ...thread,
                unreadCount: 0,
                messages: thread.messages.map((message) =>
                  message.sender !== ownSender && !message.readAt ? { ...message, readAt } : message
                ),
              }
            : thread
          ),
        }
      : current);
  }, [user?.role]);

  const handleSubmitComplaint = async (draft: ComplaintDraftPayload): Promise<ComplaintCase> => {
    const result = await api.submitComplaint(draft);
    setBootstrap((current) => current
      ? { ...current, cases: [result.complaint, ...current.cases] }
      : current);
    return result.complaint;
  };

  const handleUpdateCaseStatus = async (caseId: string, status: CaseStatus) => {
    try {
      const result = await api.updateComplaint(caseId, status);
      setBootstrap((current) => current
        ? { ...current, cases: current.cases.map((item) => item.id === caseId ? result.complaint : item) }
        : current);
      setPortalError('');
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : 'Perubahan status belum tersimpan.');
    }
  };

  const handleClaimComplaint = async (caseId: string) => {
    try {
      const result = await api.claimComplaint(caseId);
      setBootstrap((current) => current
        ? { ...current, cases: current.cases.map((item) => item.id === caseId ? result.complaint : item) }
        : current);
      setPortalError('');
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : 'Aduan belum dapat ditugaskan.');
    }
  };

  const handleUpdateProfile = async (profile: { name: string; department: string; position: string }) => {
    const result = await api.updateProfile(profile);
    setUser(result.user);
    setBootstrap((current) => current ? { ...current, user: result.user } : current);
  };

  const handleReadNotification = async (notification: NotificationItem) => {
    if (notification.readAt || !bootstrap) return;
    await api.markNotificationRead(notification.id);
    setBootstrap((current) => current
      ? {
          ...current,
          notifications: current.notifications.map((item) =>
            item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
          ),
        }
      : current);
  };

  if (bootstrapping) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F9FAF8] text-sm text-[#52635A]">
        Memuat ruang SEJIWA…
      </main>
    );
  }

  if (!user || !bootstrap) {
    return (
      <>
        {portalError && (
          <div role="alert" className="fixed top-3 left-1/2 z-50 -translate-x-1/2 max-w-[90vw] rounded-lg border border-[#FECACA] bg-white px-4 py-3 text-sm text-[#991B1B] shadow-lg">
            {portalError}
          </div>
        )}
        <PublicWebsite
          onAuthenticate={handleAuthenticate}
          onRequestPasswordReset={handleRequestPasswordReset}
          onResetPassword={handleResetPassword}
        />
      </>
    );
  }

  const content = {
    psychologists: bootstrap.psychologists,
    articles: bootstrap.articles,
    cases: bootstrap.cases,
    threads: bootstrap.threads,
  };
  const bookedPsychologistIds = bootstrap.threads.map((thread) => thread.peerId).filter((id): id is string => Boolean(id));

  return (
    <>
      {portalError && (
        <div role="alert" className="fixed top-3 left-1/2 z-50 -translate-x-1/2 max-w-[90vw] rounded-lg border border-[#FECACA] bg-white px-4 py-3 text-sm text-[#991B1B] shadow-lg">
          {portalError}
        </div>
      )}
      {portalMode === 'employee' && user.role === 'employee' && (
        <EmployeeApp
          activeView={employeeView}
          onChangeView={setEmployeeView}
          initialTopicFilter={topicFilter}
          psychologists={content.psychologists}
          articles={content.articles}
          bookedPsychologistIds={bookedPsychologistIds}
          onBookPsychologist={handleBookPsychologist}
          threads={content.threads}
          onSendMessage={handleSendMessage}
          assistantMessages={bootstrap.assistantMessages}
          onSendAssistantMessage={handleSendAssistantMessage}
          onMarkConversationRead={handleMarkConversationRead}
          cases={content.cases}
          onSubmitComplaint={handleSubmitComplaint}
          onSwitchPortal={handleSwitchPortal}
          user={user}
          onUpdateProfile={handleUpdateProfile}
          notifications={bootstrap.notifications}
          onReadNotification={handleReadNotification}
        />
      )}
      {portalMode === 'psychologist' && user.role === 'psychologist' && (
        <PsychologistPortal
          user={user}
          threads={content.threads}
          onSendMessage={handleSendMessage}
          onMarkConversationRead={handleMarkConversationRead}
          onSwitchPortal={handleSwitchPortal}
        />
      )}
      {portalMode === 'casemanager' && user.role === 'casemanager' && (
        <CaseManagerPortal
          cases={content.cases}
          user={user}
          onClaimCase={(caseId) => void handleClaimComplaint(caseId)}
          onUpdateCaseStatus={(caseId, status) => void handleUpdateCaseStatus(caseId, status)}
          onSwitchPortal={handleSwitchPortal}
        />
      )}
      {portalMode === 'admin' && user.role === 'admin' && (
        <AdminPortal
          psychologists={content.psychologists}
          articles={content.articles}
          metrics={bootstrap.metrics}
          onLogout={() => void handleLogout()}
          onContentChanged={refresh}
        />
      )}
      {portalMode !== user.role && (
        <main className="min-h-screen flex items-center justify-center bg-[#F9FAF8] p-6 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="text-xl font-semibold text-[#17221B]">Portal tidak tersedia untuk akun ini</h1>
            <p className="text-sm text-[#52635A]">Akses portal ditentukan oleh peran akun dan divalidasi kembali oleh server.</p>
            <button type="button" onClick={() => setPortalMode(user.role)} className="rounded-lg bg-[#1E3A2F] px-4 py-2 text-sm font-semibold text-white">
              Kembali ke portal saya
            </button>
          </div>
        </main>
      )}
    </>
  );
}
