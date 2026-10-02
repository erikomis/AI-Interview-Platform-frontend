import type { WordTiming } from "@/utils/lipsync";
export type InterviewStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type InterviewerPersona = "male" | "female";

export interface VisionMetrics {
  eye_contact: number;
  stress_level: number;
  confidence: number;
  /** Set by the vision service; frames without a visible face carry no signal. */
  face_visible?: boolean;
}

export interface InterviewMessage {
  role: "interviewer" | "candidate";
  content: string;
  timestamp: Date;
  audioUrl?: string;
  /** Client-side id for optimistic (not yet acknowledged) candidate messages */
  id?: string;
  /** True until the server acknowledges the answer; rolled back on error */
  pending?: boolean;
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
  /** Word timings (ms) of the audio, for avatar lip-sync */
  words?: WordTiming[] | null;
}

export interface AiResponseEvent {
  interviewId: string;
  response: string;
  /** Neural TTS of `response`; null when the server's TTS is unavailable */
  audioBase64?: string | null;
  /** Word timings (ms) of the audio, for avatar lip-sync */
  words?: WordTiming[] | null;
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

/** Sent right after connect: `exp` of the handshake access token (unix seconds). */
export interface SessionInfoEvent {
  exp: number;
}

export type ServerErrorCode =
  | "RATE_LIMITED"
  | "BUSY"
  | "NOT_IN_PROGRESS"
  | "ALL_ANSWERED"
  | "INVALID_PAYLOAD"
  | "EMPTY_TRANSCRIPT"
  | "TRANSCRIPTION_FAILED"
  | "AI_UNAVAILABLE"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INTERNAL";

export interface ServerErrorEvent {
  message: string;
  code?: ServerErrorCode;
}

/** GET /interviews/:id */
export interface InterviewDetails {
  id: string;
  role: string;
  language: string;
  experienceLevel: string;
  status: InterviewStatus;
  maxQuestions?: number;
  interviewer?: InterviewerPersona | null;
  messages: { role: "interviewer" | "candidate"; content: string; timestamp: string }[];
  feedback: InterviewFeedback | null;
}

export interface HistoryInterview {
  id: string;
  role: string;
  language: string;
  experienceLevel: string;
  interviewer?: InterviewerPersona | null;
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
