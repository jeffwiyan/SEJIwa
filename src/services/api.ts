import type {
  CaseStatus,
  ChatThread,
  ComplaintCase,
  PortalMode,
  Psychologist,
  PsychologyArticle,
} from '../types/sejiwa';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'psychologist' | 'casemanager' | 'admin';
  department: string;
  position: string;
}

export interface AuthResponse {
  user: AuthUser | null;
  portal: PortalMode;
}

export interface AuthenticatedResponse extends AuthResponse {
  user: AuthUser;
}

export interface AppBootstrap extends AuthResponse {
  psychologists: Psychologist[];
  articles: PsychologyArticle[];
  cases: ComplaintCase[];
  threads: ChatThread[];
  notifications: NotificationItem[];
  metrics?: {
    users: {
      totalUsers: number;
      employees: number;
      psychologists: number;
      activeUsers: number;
    };
    articles: number;
    complaints: Record<string, number>;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: AuthUser['role'];
  department: string;
  position: string;
  active: number;
  createdAt: string;
}

export interface AdminAuditItem {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  timestamp: string;
  outcome: 'Verified' | 'Updated' | 'Flagged';
}

export interface AdminArticleItem extends PsychologyArticle {
  published: boolean;
}

export interface AdminPsychologistItem extends Psychologist {
  active: boolean;
  verified: boolean;
}

export interface ComplaintDraftPayload {
  anonymous: boolean;
  category: ComplaintCase['type'];
  department: string;
  description: string;
  termsAccepted: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('Layanan belum dapat dijangkau. Pastikan server SEJIWA sedang berjalan.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || 'Permintaan belum berhasil. Silakan coba kembali.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<AuthResponse>('/auth/me'),

  login: (email: string, password: string, termsAccepted: boolean) =>
    request<AuthenticatedResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, termsAccepted }),
    }),

  register: (name: string, email: string, password: string, termsAccepted: boolean) =>
    request<AuthenticatedResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, termsAccepted }),
    }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  bootstrap: () => request<AppBootstrap>('/bootstrap'),

  createConversation: (psychologistId: string) =>
    request<{ conversationId: string; threads: ChatThread[] }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ psychologistId }),
    }),

  sendMessage: (conversationId: string, text: string) =>
    request<{ threads: ChatThread[] }>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  markConversationRead: (conversationId: string) =>
    request<{ readAt: string }>(`/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
    }),

  submitComplaint: (draft: ComplaintDraftPayload) =>
    request<{ complaint: ComplaintCase }>('/complaints', {
      method: 'POST',
      body: JSON.stringify(draft),
    }),

  updateComplaint: (caseId: string, status: CaseStatus) =>
    request<{ complaint: ComplaintCase }>(`/complaints/${encodeURIComponent(caseId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  claimComplaint: (caseId: string) =>
    request<{ complaint: ComplaintCase }>(`/complaints/${encodeURIComponent(caseId)}/claim`, {
      method: 'POST',
    }),

  markNotificationRead: (id: string) =>
    request<void>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),

  updateProfile: (profile: { name: string; department: string; position: string }) =>
    request<{ user: AuthUser }>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(profile),
    }),

  adminUsers: () => request<{ users: AdminUserItem[] }>('/admin/users'),

  adminAudit: () => request<{ entries: AdminAuditItem[] }>('/admin/audit'),

  setUserActive: (id: string, active: boolean) =>
    request<void>(`/admin/users/${encodeURIComponent(id)}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  adminArticles: () => request<{ articles: AdminArticleItem[] }>('/admin/articles'),

  saveArticle: (article: Omit<AdminArticleItem, 'id' | 'publishedDate'> & { id?: string }) =>
    request<{ article: AdminArticleItem }>(
      article.id ? `/admin/articles/${encodeURIComponent(article.id)}` : '/admin/articles',
      {
        method: article.id ? 'PUT' : 'POST',
        body: JSON.stringify(article),
      },
    ),

  deleteArticle: (id: string) =>
    request<void>(`/admin/articles/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  adminPsychologists: () =>
    request<{ psychologists: AdminPsychologistItem[] }>('/admin/psychologists'),

  updatePsychologist: (id: string, status: { active: boolean; acceptingClients: boolean }) =>
    request<{ psychologist: AdminPsychologistItem }>(`/admin/psychologists/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(status),
    }),
};
