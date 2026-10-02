export type InterviewStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface VisionMetrics {
  eye_contact: number;
  stress_level: number;
  confidence: number;
}

export interface InterviewMessage {
  role: "interviewer" | "candidate";
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

export interface InterviewFeedback {
  technical: number;
  communication: number;
  confidence: number;
  clarity: number;
  overall: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

export interface StartInterviewResponse {
  interviewId: string;
  firstQuestion: string;
  audioBase64: string | null;
}

export interface AnswerResponse {
  aiResponse: string;
  nextQuestion: string | null;
  audioBase64: string | null;
  isComplete: boolean;
  transcript?: string;
}

// Socket.IO event payloads
export interface AiQuestionEvent {
  interviewId: string;
  question: string;
  audioBase64: string | null;
}

export interface AiResponseEvent {
  interviewId: string;
  response: string;
}

export interface TranscriptEvent {
  interviewId: string;
  text: string;
}

export interface VisionResultEvent {
  interviewId: string;
  metrics: VisionMetrics;
}

export interface FinalFeedbackEvent {
  interviewId: string;
  feedback: InterviewFeedback;
}

export type AIStatus = "idle" | "thinking" | "speaking" | "listening";

export interface HistoryInterview {
  id: string;
  role: string;
  language: string;
  experienceLevel: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  overall: number | null;
  technical: number | null;
  communication: number | null;
  confidence: number | null;
  clarity: number | null;
  summary: string | null;
  strengths: string[] | null;
  improvements: string[] | null;
}

export interface UserHistory {
  user: { id: string; name: string; createdAt: string } | null;
  interviews: HistoryInterview[];
}

export interface VisionSnapshot {
  metrics: VisionMetrics;
  timestamp: Date;
}

export interface AnalyticsSession {
  index: number;
  role: string;
  experienceLevel: string;
  date: string;
  overall: number | null;
  technical: number | null;
  communication: number | null;
  confidence: number | null;
  clarity: number | null;
}

export interface AnalyticsData {
  hasData: boolean;
  sessions: AnalyticsSession[];
  averages: {
    overall: number;
    technical: number;
    communication: number;
    confidence: number;
    clarity: number;
  } | null;
  totalSessions: number;
}

export interface FeedbackFailedEvent {
  interviewId: string;
  message: string;
}
