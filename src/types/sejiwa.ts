export type PortalMode = 'public' | 'employee' | 'psychologist' | 'casemanager' | 'admin';

export type PublicSection = 'landing' | 'about' | 'services' | 'auth';

export type EmployeeView =
  | 'dashboard'
  | 'education'
  | 'psychologists'
  | 'chat'
  | 'complaints'
  | 'settings';

export type PsychologistView = 'home' | 'calendar' | 'clients' | 'messages' | 'billing' | 'tasks';

export type CaseManagerView = 'dashboard' | 'intakes' | 'investigations' | 'evidence' | 'reports';

export type AdminView = 'overview' | 'users' | 'psychologists' | 'articles' | 'complaints' | 'audit';

export interface CounselingTopic {
  id: string;
  label: string;
  headline: string;
  paragraphs: string[];
  recommendedApproach: string;
}

export interface Psychologist {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  areas: string[];
  sessionTypes: ('Online' | 'Offline')[];
  languages: string[];
  location: string;
  experienceYears: number;
  nextAvailable: string;
  acceptingClients: boolean;
  rating: string;
  bio: string;
  image: string;
}

export interface PsychologyArticle {
  id: string;
  title: string;
  category: string;
  author: string;
  publishedDate: string;
  readMinutes: number;
  excerpt: string;
  body: string[];
  image: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'peer';
  senderName: string;
  text: string;
  timestamp: string;
  readAt?: string | null;
  attachment?: {
    name: string;
    size: string;
  };
}

export interface ChatThread {
  id: string;
  peerId?: string;
  peerName: string;
  peerRole: string;
  peerHandle: string;
  peerAvatar: string;
  status: string;
  lastMessagePreview: string;
  lastTime: string;
  unreadCount: number;
  messages: ChatMessage[];
}

export type CasePriority = 'High' | 'Medium' | 'Low';
export type CaseStatus = 'Open' | 'Under Review' | 'Investigating' | 'Escalated' | 'Closed';

export interface CaseTimelineItem {
  id: string;
  label: string;
  date: string;
  state: 'done' | 'warning' | 'pending';
}

export interface ComplaintCase {
  id: string;
  title: string;
  type: 'Workplace Stress' | 'Harassment' | 'Burnout' | 'Policy Conflict' | 'Interpersonal';
  department: string;
  reporterName: string;
  reporterEmail: string;
  owner: string;
  priority: CasePriority;
  status: CaseStatus;
  dueDate: string;
  createdDate: string;
  eventsCount: number;
  summary: string;
  nextAction: string;
  timeline: CaseTimelineItem[];
}

export interface CalendarSession {
  id: string;
  dayIndex: number; // 0 (Sun) - 6 (Sat)
  dayLabel: string;
  startHour: number; // e.g., 11 = 11:00
  durationMinutes: number;
  clientName: string;
  sessionTitle: string;
  mode: 'Online' | 'Offline' | 'Availability';
  notes: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  timestamp: string;
  outcome: 'Verified' | 'Updated' | 'Flagged';
}
