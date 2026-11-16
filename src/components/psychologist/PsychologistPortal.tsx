import { useEffect, useState, type FormEvent } from 'react';
import { Home, LogOut, MessageSquare, Send } from 'lucide-react';
import type { ChatThread, PortalMode } from '../../types/sejiwa';
import type { AuthUser } from '../../services/api';

interface PsychologistPortalProps {
  user: AuthUser;
  threads: ChatThread[];
  onSendMessage: (threadId: string, text: string) => Promise<void>;
  onMarkConversationRead: (threadId: string) => Promise<void>;
  onSwitchPortal: (portal: PortalMode) => void;
}

export function PsychologistPortal({
  user,
  threads,
  onSendMessage,
  onMarkConversationRead,
  onSwitchPortal,
}: PsychologistPortalProps) {
  const [activeThreadId, setActiveThreadId] = useState(threads[0]?.id || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];

  useEffect(() => {
    if (!activeThread || activeThread.unreadCount === 0) return;
    onMarkConversationRead(activeThread.id).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Status pesan belum dapat diperbarui.');
    });
  }, [activeThread?.id, activeThread?.unreadCount, onMarkConversationRead]);

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeThread || !message.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await onSendMessage(activeThread.id, message.trim());
      setMessage('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pesan belum dapat dikirim.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0F172A]">
      <aside className="w-60 shrink-0 bg-white border-r border-[#E2E8F0] flex flex-col justify-between p-4">
        <div className="space-y-6">
          <div className="px-2">
            <p className="font-['Fraunces'] text-lg font-semibold text-[#0F172A]">SEJIWA Praktik</p>
            <p className="mt-1 text-xs text-[#64748B]">Portal psikolog</p>
          </div>
          <nav aria-label="Navigasi portal psikolog" className="space-y-1">
            <button type="button" className="w-full flex items-center gap-2.5 rounded-lg bg-[#E6F4F1] px-3 py-2 text-xs font-medium text-[#0F766E]">
              <Home className="h-4 w-4" aria-hidden="true" />
              Ringkasan
            </button>
            <button type="button" className="w-full flex items-center gap-2.5 rounded-lg bg-[#0F766E] px-3 py-2 text-xs font-medium text-white">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Pesan Klien
              {threads.length > 0 && <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5">{threads.length}</span>}
            </button>
          </nav>
          <div className="rounded-lg bg-[#F8FAFC] p-3">
            <p className="text-xs font-semibold text-[#0F172A]">{user.name}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
              Akses percakapan dibatasi pada klien yang ditugaskan kepada akun ini.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSwitchPortal('public')}
          className="flex items-center gap-2 rounded-md border-t border-[#E2E8F0] px-2 pt-4 text-xs text-[#475569] hover:text-[#0F172A]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar dari akun
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-5 sm:p-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0F766E]">Ruang komunikasi</p>
          <h1 className="mt-2 font-['Fraunces'] text-2xl font-medium text-[#0F172A]">Pesan klien</h1>
          <p className="mt-1 text-sm text-[#64748B]">Percakapan tersimpan dan hanya dapat diakses pihak yang terhubung.</p>
        </header>

        <section className="grid min-h-[min(70vh,680px)] grid-cols-1 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white lg:grid-cols-12">
          <div className="border-b border-[#E2E8F0] lg:col-span-4 lg:border-b-0 lg:border-r">
            <h2 className="border-b border-[#E2E8F0] px-4 py-4 text-sm font-semibold">Percakapan</h2>
            {threads.length === 0 ? (
              <p className="p-5 text-xs leading-relaxed text-[#64748B]">Belum ada percakapan yang ditugaskan untuk akun ini.</p>
            ) : (
              <ul className="divide-y divide-[#F1F5F9]">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => setActiveThreadId(thread.id)}
                      className={`w-full px-4 py-3 text-left ${activeThread?.id === thread.id ? 'bg-[#F0F9F7]' : 'hover:bg-[#F8FAFC]'}`}
                    >
                      <span className="block text-xs font-semibold text-[#0F172A]">{thread.peerName}</span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-[#64748B]">
                        <span className="truncate">{thread.lastMessagePreview}</span>
                        {thread.unreadCount > 0 && <span className="rounded-full bg-[#0F766E] px-1.5 text-[10px] text-white">{thread.unreadCount}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-[420px] min-w-0 flex-col lg:col-span-8">
            {activeThread ? (
              <>
                <header className="border-b border-[#E2E8F0] px-5 py-4">
                  <h2 className="text-sm font-semibold">{activeThread.peerName}</h2>
                  <p className="mt-1 text-xs text-[#64748B]">Percakapan privat · {activeThread.status}</p>
                </header>
                <div className="flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] p-5">
                  {activeThread.messages.length === 0 && <p className="text-center text-xs text-[#64748B]">Belum ada pesan di percakapan ini.</p>}
                  {activeThread.messages.map((item) => (
                    <div key={item.id} className={`flex flex-col ${item.sender === 'peer' ? 'items-end' : 'items-start'}`}>
                      <span className="mb-1 text-[11px] text-[#64748B]">{item.senderName} · {item.timestamp}</span>
                      <p className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed ${item.sender === 'peer' ? 'bg-[#0F766E] text-white' : 'border border-[#E2E8F0] bg-white text-[#0F172A]'}`}>
                        {item.text}
                        {item.sender === 'peer' && <span className="mt-1 block text-right text-[10px] opacity-70">{item.readAt ? 'Dibaca' : 'Terkirim'}</span>}
                      </p>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendReply} className="flex gap-3 border-t border-[#E2E8F0] p-4">
                  <label htmlFor="psychologist-message" className="sr-only">Tulis balasan</label>
                  <input
                    id="psychologist-message"
                    value={message}
                    maxLength={4000}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Tulis balasan..."
                    className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm focus:border-[#0F766E] focus:outline-none"
                  />
                  <button type="submit" disabled={sending || !message.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {sending ? 'Mengirim…' : 'Kirim'}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <MessageSquare className="h-8 w-8 text-[#64748B]" aria-hidden="true" />
                <h2 className="mt-3 text-sm font-semibold">Belum ada pesan</h2>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#64748B]">Percakapan karyawan yang ditugaskan kepada Anda akan muncul di sini.</p>
              </div>
            )}
            {error && <p role="alert" className="border-t border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs text-[#991B1B]">{error}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
