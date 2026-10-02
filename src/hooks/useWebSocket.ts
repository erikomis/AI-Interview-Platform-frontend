"use client";

import { useEffect, useReducer, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "@/services/socket";
import { refreshSession, redirectToLogin } from "@/services/auth";
import { interviewApi } from "@/services/api";
import type {
  InterviewMessage,
  InterviewFeedback,
  InterviewDetails,
  InterviewerPersona,
  VisionMetrics,
  VisionSnapshot,
  AIStatus,
  AiQuestionEvent,
  AiResponseEvent,
  TranscriptEvent,
  VisionResultEvent,
  FinalFeedbackEvent,
  FeedbackFailedEvent,
  ServerErrorEvent,
  SessionInfoEvent,
} from "@/types/interview";
import { playAudio, speakText } from "@/utils/audio";

/** Client-side errors; the UI translates them. */
export type ClientErrorKey = "offline" | "timeout" | "feedbackRetryFailed";

/** Server error (`code` from the server, or "CONNECTION" for socket failures); the UI translates it. */
export type SocketError = { code: string | null; message: string };

/** An answer the server rejected — handed back to the UI so it can be resent. */
export type FailedAnswer = { kind: "text"; text: string } | { kind: "audio"; blob: Blob };

export type StartInterviewParams = {
  candidateId: string;
  role: string;
  language?: string;
  experienceLevel?: string;
  sessionMode?: string;
  cvSummary?: string;
  interviewer?: InterviewerPersona;
};

type State = {
  /** False until sessionStorage was read on the client (never during SSR). */
  hydrated: boolean;
  isConnected: boolean;
  interviewId: string | null;
  interviewer: InterviewerPersona | null;
  messages: InterviewMessage[];
  feedback: InterviewFeedback | null;
  visionMetrics: VisionMetrics | null;
  visionHistory: VisionSnapshot[];
  aiStatus: AIStatus;
  isComplete: boolean;
  socketError: SocketError | null;
  clientError: ClientErrorKey | null;
  feedbackFailed: { interviewId: string; message: string } | null;
  feedbackRetrying: boolean;
  failedAnswer: FailedAnswer | null;
  transcript: string;
};

type PersistedState = Pick<
  State,
  "interviewId" | "interviewer" | "messages" | "feedback" | "isComplete" | "visionHistory" | "feedbackFailed"
>;

type ResyncOutcome = "complete" | "feedbackFailed" | "listening" | "waiting";

type Action =
  | { type: "HYDRATE"; payload: Partial<PersistedState> }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "CONNECTION_ERROR"; payload: string }
  | { type: "SET_INTERVIEW_ID"; payload: string }
  | { type: "SET_INTERVIEWER"; payload: InterviewerPersona }
  | { type: "ADD_MESSAGE"; payload: InterviewMessage }
  | { type: "CONFIRM_PENDING" }
  | { type: "REMOVE_MESSAGE"; payload: string }
  | { type: "SET_AI_STATUS"; payload: AIStatus }
  | { type: "SET_TRANSCRIPT"; payload: string }
  | { type: "VISION_RESULT"; payload: VisionMetrics }
  | { type: "FINAL_FEEDBACK"; payload: InterviewFeedback }
  | { type: "SERVER_ERROR"; payload: SocketError & { affectsTurn: boolean; failedAnswer: FailedAnswer | null } }
  | { type: "CLIENT_ERROR"; payload: ClientErrorKey }
  | { type: "FEEDBACK_FAILED"; payload: { interviewId: string; message: string } }
  | { type: "FEEDBACK_RETRY_START" }
  | { type: "FEEDBACK_RETRY_FAILED" }
  | { type: "REQUEST_SENT" }
  | { type: "SERVER_RESPONDED" }
  | { type: "SET_FAILED_ANSWER"; payload: FailedAnswer | null }
  | {
      type: "RESYNC";
      payload: {
        messages: InterviewMessage[];
        feedback: InterviewFeedback | null;
        interviewer: InterviewerPersona | null;
        outcome: ResyncOutcome;
        keepPending: boolean;
      };
    };

/** Locally tracked action, kept until the server responds so it can be resent. */
type PendingAction = {
  kind: "start" | "text" | "audio";
  event: "start_interview" | "user_answer" | "audio_answer";
  payload: Record<string, unknown>;
  sentAt: number;
  /** Server refused it with auth_expired — resend after reauth + reconnect */
  refused: boolean;
  /** Optimistic candidate message (text answers; audio once transcribed) */
  messageId?: string;
  /** Candidate answers the server will have stored once this one is processed */
  expectedAnswers?: number;
  text?: string;
  blob?: Blob;
};

const initialState: State = {
  hydrated: false,
  isConnected: false,
  interviewId: null,
  interviewer: null,
  messages: [],
  feedback: null,
  visionMetrics: null,
  visionHistory: [],
  aiStatus: "idle",
  isComplete: false,
  socketError: null,
  clientError: null,
  feedbackFailed: null,
  feedbackRetrying: false,
  failedAnswer: null,
  transcript: "",
};

const STORAGE_KEY = "interview_session";

/** Max time to wait for the server to answer (local LLMs can be slow). */
const RESPONSE_TIMEOUT_MS = 6 * 60 * 1000;
/** Refresh the access token this long before the socket's handshake token expires. */
const REFRESH_LEAD_MS = 60 * 1000;
/** auth_expired arriving this soon after an action means that action was refused. */
const AUTH_REFUSAL_WINDOW_MS = 5000;
/** Poll GET /interviews/:id while a reconnected socket waits for a result it may miss. */
const RESYNC_POLL_MS = 5000;

let localMessageSeq = 0;
const newMessageId = () => `local-${Date.now()}-${++localMessageSeq}`;

function reviveDate(value: unknown): Date {
  const d = new Date(value as string | number | Date);
  return isNaN(d.getTime()) ? new Date() : d;
}

function loadPersistedState(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    // JSON turns Dates into strings — revive them so consumers can call getTime() etc.
    return {
      ...parsed,
      messages: (parsed.messages ?? [])
        .filter((m) => !m.pending)
        .map((m) => ({ ...m, timestamp: reviveDate(m.timestamp) })),
      visionHistory: (parsed.visionHistory ?? []).map((v) => ({ ...v, timestamp: reviveDate(v.timestamp) })),
    };
  } catch {
    return {};
  }
}

function persistState(state: State) {
  if (typeof window === "undefined") return;
  const { interviewId, interviewer, messages, feedback, isComplete, visionHistory, feedbackFailed } = state;
  const data: PersistedState = {
    interviewId,
    interviewer,
    // Unacknowledged answers are not part of the interview yet
    messages: messages.filter((m) => !m.pending),
    feedback,
    isComplete,
    visionHistory,
    feedbackFailed,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full / unavailable — persistence is best-effort
  }
}

export function clearInterviewSession() {
  if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
}

/** Same message delivered twice (room broadcast after a resync already fetched it). */
function isDuplicate(messages: InterviewMessage[], msg: InterviewMessage): boolean {
  return messages.slice(-3).some((m) => m.role === msg.role && m.content === msg.content);
}

type ResyncPayload = Extract<Action, { type: "RESYNC" }>["payload"];

/** Server state wins; optimistic answers still in flight are kept at the end. */
function applyResync(state: State, { messages, feedback, interviewer, outcome, keepPending }: ResyncPayload): State {
  const pending = keepPending ? state.messages.filter((m) => m.pending) : [];
  const base: State = {
    ...state,
    messages: [...messages, ...pending],
    interviewer: interviewer ?? state.interviewer,
  };
  switch (outcome) {
    case "complete":
      return {
        ...base, feedback, isComplete: true, aiStatus: "idle",
        feedbackFailed: null, feedbackRetrying: false, socketError: null, clientError: null,
      };
    case "feedbackFailed":
      return {
        ...base, aiStatus: "idle", feedbackRetrying: false,
        feedbackFailed: state.feedbackFailed ?? { interviewId: state.interviewId ?? "", message: "" },
      };
    case "waiting":
      return { ...base, aiStatus: state.aiStatus === "speaking" ? "speaking" : "thinking", feedbackFailed: null };
    case "listening":
      // Let ongoing playback finish; its callback moves to "listening"
      return {
        ...base, feedbackFailed: null,
        aiStatus: state.aiStatus === "speaking" ? "speaking" : "listening",
        clientError: state.clientError === "timeout" ? null : state.clientError,
      };
  }
}

/** Candidate answers already acknowledged by the server, plus the one being sent. */
function expectedAnswers(messages: InterviewMessage[]): number {
  return messages.filter((m) => m.role === "candidate" && !m.pending).length + 1;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE": return { ...state, ...action.payload, hydrated: true };
    case "CONNECTED":    return { ...state, isConnected: true, socketError: state.socketError?.code === "CONNECTION" ? null : state.socketError, clientError: state.clientError === "offline" ? null : state.clientError };
    case "DISCONNECTED": return { ...state, isConnected: false };
    case "CONNECTION_ERROR": return { ...state, isConnected: false, socketError: { code: "CONNECTION", message: action.payload } };
    case "SET_INTERVIEW_ID": return { ...state, interviewId: action.payload };
    case "SET_INTERVIEWER": return { ...state, interviewer: action.payload };
    case "ADD_MESSAGE":
      // A pending message with the same id is being resent — don't add it twice
      if (action.payload.id && state.messages.some((m) => m.id === action.payload.id)) return state;
      if (!action.payload.pending && isDuplicate(state.messages, action.payload)) return state;
      return { ...state, messages: [...state.messages, action.payload] };
    case "CONFIRM_PENDING":
      return state.messages.some((m) => m.pending)
        ? { ...state, messages: state.messages.map((m) => (m.pending ? { ...m, pending: false } : m)) }
        : state;
    case "REMOVE_MESSAGE": return { ...state, messages: state.messages.filter((m) => m.id !== action.payload) };
    // Once the interview is complete (or feedback failed), late playback callbacks must not leave the status stuck
    case "SET_AI_STATUS": return state.isComplete || state.feedbackFailed ? state : { ...state, aiStatus: action.payload };
    case "SET_TRANSCRIPT": return { ...state, transcript: action.payload };
    case "VISION_RESULT":
      // Frames without a visible face carry no behavioural signal
      if (action.payload.face_visible === false) return state;
      return {
        ...state,
        visionMetrics: action.payload,
        visionHistory: [...state.visionHistory, { metrics: action.payload, timestamp: new Date() }],
      };
    case "FINAL_FEEDBACK": return {
      ...state, feedback: action.payload, isComplete: true, aiStatus: "idle",
      feedbackFailed: null, feedbackRetrying: false, socketError: null, clientError: null, failedAnswer: null,
    };
    case "SERVER_ERROR": {
      const { affectsTurn, failedAnswer, code, message } = action.payload;
      return {
        ...state,
        socketError: { code, message },
        failedAnswer: failedAnswer ?? state.failedAnswer,
        // The turn is back with the candidate (or nothing started yet)
        aiStatus: affectsTurn ? (state.interviewId ? "listening" : "idle") : state.aiStatus,
      };
    }
    case "CLIENT_ERROR": return {
      ...state,
      clientError: action.payload,
      aiStatus: action.payload === "timeout" ? (state.interviewId ? "listening" : "idle") : state.aiStatus,
    };
    case "FEEDBACK_FAILED": return { ...state, feedbackFailed: action.payload, feedbackRetrying: false, aiStatus: "idle" };
    case "FEEDBACK_RETRY_START": return { ...state, feedbackRetrying: true, clientError: null };
    case "REQUEST_SENT": return { ...state, aiStatus: "thinking", socketError: null, clientError: null, failedAnswer: null };
    case "SERVER_RESPONDED": return { ...state, clientError: state.clientError === "timeout" ? null : state.clientError };
    case "FEEDBACK_RETRY_FAILED": return { ...state, feedbackRetrying: false, clientError: "feedbackRetryFailed" };
    case "SET_FAILED_ANSWER": return { ...state, failedAnswer: action.payload };
    case "RESYNC": return applyResync(state, action.payload);
    default: return state;
  }
}

export const useWebSocket = (isAuthenticated: boolean, language = "pt") => {
  // Always start from initialState so the server render and the first client render match;
  // sessionStorage is read in an effect (HYDRATE).
  const [state, dispatch] = useReducer(reducer, initialState);

  const socketRef = useRef<Socket | null>(null);
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Latest state for socket callbacks and async flows
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Serialized audio playback: ai_response speech, then ai_question audio, never overlapping
  const playbackRef = useRef<Promise<void>>(Promise.resolve());
  const playbackGenRef = useRef(0);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Last action sent and not yet answered by the server. */
  const pendingRef = useRef<PendingAction | null>(null);
  /** True from sending an action until the server's turn is over (next question / feedback / error). */
  const awaitingRef = useRef(false);
  /** Reconnect (to hand the new cookie to the handshake) once the current turn is over. */
  const reconnectAfterTurnRef = useRef(false);
  const resyncSeqRef = useRef(0);
  const resyncPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hydrate from sessionStorage (client only, after the first render) ───────
  useEffect(() => {
    dispatch({ type: "HYDRATE", payload: loadPersistedState() });
  }, []);

  useEffect(() => {
    if (state.hydrated) persistState(state);
  }, [state.hydrated, state.interviewId, state.interviewer, state.messages, state.feedback, state.isComplete, state.visionHistory, state.feedbackFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearResponseTimeout = useCallback(() => {
    if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    responseTimerRef.current = null;
  }, []);

  const clearResyncPoll = useCallback(() => {
    if (resyncPollRef.current) clearTimeout(resyncPollRef.current);
    resyncPollRef.current = null;
  }, []);

  /** Disconnect + connect so the handshake carries the freshly refreshed cookie. */
  const reconnectSocket = useCallback(() => {
    reconnectAfterTurnRef.current = false;
    const socket = socketRef.current;
    if (!socket) return;
    socket.disconnect().connect();
  }, []);

  /** The server's turn is over (next question, feedback or error). */
  const endTurn = useCallback(() => {
    awaitingRef.current = false;
    clearResyncPoll();
    if (reconnectAfterTurnRef.current) {
      // Let the current event finish processing first
      setTimeout(reconnectSocket, 0);
    }
  }, [clearResyncPoll, reconnectSocket]);

  // ── Resync with the server (page load, reconnect, timeout) ─────────────────
  const resync = useCallback(async () => {
    const { hydrated, interviewId, isComplete } = stateRef.current;
    if (!hydrated || !interviewId || isComplete) return;
    clearResyncPoll();
    const seq = ++resyncSeqRef.current;

    let data: InterviewDetails;
    try {
      data = await interviewApi.get(interviewId);
    } catch (err) {
      console.error("[RESYNC] failed:", err);
      return;
    }
    // A newer resync started, or the interview changed meanwhile
    if (seq !== resyncSeqRef.current || stateRef.current.interviewId !== interviewId) return;

    const messages: InterviewMessage[] = (data.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: reviveDate(m.timestamp),
    }));
    const answered = messages.filter((m) => m.role === "candidate").length;

    // The pending answer is already stored server-side → it was processed
    const pending = pendingRef.current;
    if (pending?.expectedAnswers !== undefined && answered >= pending.expectedAnswers) {
      pendingRef.current = null;
    }
    const stillPending = !!pendingRef.current && pendingRef.current.kind !== "start";
    const allAnswered = data.maxQuestions !== undefined && answered >= data.maxQuestions;

    let outcome: ResyncOutcome;
    if (data.feedback) {
      outcome = "complete";
    } else if (stillPending || (allAnswered && awaitingRef.current)) {
      // Still being processed (answer or the feedback that follows it)
      outcome = "waiting";
    } else if (allAnswered || data.status === "COMPLETED") {
      outcome = "feedbackFailed";
    } else {
      outcome = "listening";
    }

    dispatch({
      type: "RESYNC",
      payload: {
        messages,
        feedback: data.feedback ?? null,
        interviewer: data.interviewer ?? null,
        outcome,
        keepPending: stillPending,
      },
    });

    if (outcome === "waiting") {
      // A reconnected socket only rejoins the interview room on its next owned
      // event, so results may never reach it — keep checking over HTTP.
      resyncPollRef.current = setTimeout(() => void resyncRef.current(), RESYNC_POLL_MS);
    } else {
      pendingRef.current = null;
      clearResponseTimeout();
      if (awaitingRef.current) endTurn();
    }
  }, [clearResyncPoll, clearResponseTimeout, endTurn]);

  const resyncRef = useRef(resync);
  useEffect(() => {
    resyncRef.current = resync;
  }, [resync]);

  // Page load: reconcile the restored session with the server
  useEffect(() => {
    if (state.hydrated && isAuthenticated) void resyncRef.current();
  }, [state.hydrated, isAuthenticated]);

  const armResponseTimeout = useCallback(() => {
    clearResponseTimeout();
    responseTimerRef.current = setTimeout(() => {
      responseTimerRef.current = null;
      // Roll back the unanswered message; the resync below restores it if the server did store it
      const pending = pendingRef.current;
      if (pending?.messageId) dispatch({ type: "REMOVE_MESSAGE", payload: pending.messageId });
      if (pending?.kind === "text" && pending.text) dispatch({ type: "SET_FAILED_ANSWER", payload: { kind: "text", text: pending.text } });
      if (pending?.kind === "audio" && pending.blob) dispatch({ type: "SET_FAILED_ANSWER", payload: { kind: "audio", blob: pending.blob } });
      pendingRef.current = null;
      awaitingRef.current = false;
      clearResyncPoll();
      dispatch({ type: "CLIENT_ERROR", payload: "timeout" });
      void resyncRef.current();
    }, RESPONSE_TIMEOUT_MS);
  }, [clearResponseTimeout, clearResyncPoll]);

  const enqueuePlayback = useCallback((task: () => Promise<void>) => {
    const gen = playbackGenRef.current;
    playbackRef.current = playbackRef.current
      .then(() => (gen === playbackGenRef.current ? task() : undefined))
      .catch((err) => console.error("[AUDIO] playback failed:", err));
  }, []);

  /** Emits an action and keeps it until the server responds. */
  const emitAction = useCallback(
    (socket: Socket, action: Omit<PendingAction, "sentAt" | "refused">) => {
      pendingRef.current = { ...action, sentAt: Date.now(), refused: false };
      awaitingRef.current = true;
      socket.emit(action.event, action.payload);
      armResponseTimeout();
    },
    [armResponseTimeout],
  );

  useEffect(() => {
    if (!isAuthenticated) return; // Don't connect until authenticated

    const socket = getSocket();
    socketRef.current = socket;
    let disposed = false;
    let reauthAttempts = 0;
    let reauthInFlight = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRefreshTimer = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = null;
    };

    /** Refresh the session, then reconnect so the handshake carries the new cookie. */
    const reauthAndReconnect = async () => {
      if (reauthInFlight) return;
      // Avoid an endless loop if the server keeps rejecting freshly refreshed tokens
      if (reauthAttempts >= 2) { redirectToLogin(); return; }
      reauthAttempts += 1;
      reauthInFlight = true;
      const ok = await refreshSession();
      reauthInFlight = false;
      if (disposed) return;
      if (!ok) { redirectToLogin(); return; }
      if (socket.connected) socket.disconnect();
      socket.connect();
    };

    socket.on("connect", () => {
      reauthAttempts = 0;
      dispatch({ type: "CONNECTED" });

      // Resend an action the server refused because the token had expired
      const pending = pendingRef.current;
      if (pending?.refused && pending.kind === "start") {
        // The page re-emits start_interview on reconnect while no interview exists
        pendingRef.current = null;
      } else if (pending?.refused) {
        pending.refused = false;
        pending.sentAt = Date.now();
        socket.emit(pending.event, pending.payload);
        armResponseTimeout();
      }
      void resyncRef.current();
    });

    socket.on("connect_error", (err: Error) => {
      if (err.message === "unauthorized") {
        void reauthAndReconnect();
        return;
      }
      dispatch({ type: "CONNECTION_ERROR", payload: err.message });
    });

    // Expiry of the handshake token: refresh proactively ~60s before it
    socket.on("session_info", (data: SessionInfoEvent) => {
      clearRefreshTimer();
      if (!data?.exp) return;
      const delay = Math.max(0, data.exp * 1000 - Date.now() - REFRESH_LEAD_MS);
      refreshTimer = setTimeout(async () => {
        refreshTimer = null;
        const ok = await refreshSession();
        if (disposed || !ok) return; // auth_expired / AuthContext handle the failure
        // Mid-turn, a reconnect would drop the socket from the interview room → wait
        if (awaitingRef.current) reconnectAfterTurnRef.current = true;
        else reconnectSocket();
      }, delay);
    });

    // The server refused the last event because the access token expired (socket stays connected)
    socket.on("auth_expired", () => {
      const pending = pendingRef.current;
      if (pending && Date.now() - pending.sentAt < AUTH_REFUSAL_WINDOW_MS) {
        pending.refused = true;
      }
      void reauthAndReconnect();
    });

    socket.on("disconnect", () => {
      dispatch({ type: "DISCONNECTED" });
    });

    socket.on("ai_question", (data: AiQuestionEvent) => {
      clearResponseTimeout();
      pendingRef.current = null;
      endTurn();
      dispatch({ type: "SERVER_RESPONDED" });
      dispatch({ type: "CONFIRM_PENDING" });
      dispatch({ type: "SET_INTERVIEW_ID", payload: data.interviewId });
      dispatch({ type: "ADD_MESSAGE", payload: { role: "interviewer", content: data.question, timestamp: new Date() } });
      enqueuePlayback(async () => {
        dispatch({ type: "SET_AI_STATUS", payload: "speaking" });
        if (data.audioBase64) {
          await playAudio(data.audioBase64, { words: data.words, language: languageRef.current });
        } else {
          await speakText(data.question, languageRef.current);
        }
        dispatch({ type: "SET_AI_STATUS", payload: "listening" });
      });
    });

    socket.on("ai_response", (data: AiResponseEvent) => {
      clearResponseTimeout();
      // The answer was processed; the next question / feedback is still on its way
      pendingRef.current = null;
      dispatch({ type: "SERVER_RESPONDED" });
      dispatch({ type: "CONFIRM_PENDING" });
      dispatch({ type: "ADD_MESSAGE", payload: { role: "interviewer", content: data.response, timestamp: new Date() } });
      enqueuePlayback(async () => {
        dispatch({ type: "SET_AI_STATUS", payload: "speaking" });
        if (data.audioBase64) {
          await playAudio(data.audioBase64, { words: data.words, language: languageRef.current });
        } else {
          await speakText(data.response, languageRef.current);
        }
        // Still waiting for the next question (or feedback) — a queued ai_question will take over
        if (awaitingRef.current) dispatch({ type: "SET_AI_STATUS", payload: "thinking" });
      });
      // The next question / feedback may still take a while
      if (awaitingRef.current) armResponseTimeout();
    });

    socket.on("transcript", (data: TranscriptEvent) => {
      dispatch({ type: "SET_TRANSCRIPT", payload: data.text });
      // Optimistic until ai_response confirms the answer was processed
      const pending = pendingRef.current;
      if (pending?.kind === "audio") {
        pending.messageId ??= newMessageId();
        pending.text = data.text;
        dispatch({
          type: "ADD_MESSAGE",
          payload: { id: pending.messageId, role: "candidate", content: data.text, timestamp: new Date(), pending: true },
        });
      } else {
        dispatch({ type: "ADD_MESSAGE", payload: { role: "candidate", content: data.text, timestamp: new Date() } });
      }
    });

    socket.on("vision_result", (data: VisionResultEvent) => {
      dispatch({ type: "VISION_RESULT", payload: data.metrics });
    });

    socket.on("final_feedback", (data: FinalFeedbackEvent) => {
      clearResponseTimeout();
      pendingRef.current = null;
      endTurn();
      dispatch({ type: "CONFIRM_PENDING" });
      dispatch({ type: "FINAL_FEEDBACK", payload: data.feedback });
    });

    socket.on("feedback_failed", (data: FeedbackFailedEvent) => {
      clearResponseTimeout();
      pendingRef.current = null;
      endTurn();
      dispatch({ type: "CONFIRM_PENDING" });
      dispatch({ type: "FEEDBACK_FAILED", payload: { interviewId: data.interviewId, message: data.message } });
    });

    socket.on("error", (data: ServerErrorEvent) => {
      const pending = pendingRef.current;
      const code = data?.code ?? null;
      const message = data?.message ?? "";
      // Errors with no action in flight (e.g. a rejected vision frame) don't touch the turn
      const affectsTurn = !!pending || awaitingRef.current;

      // Our view of the interview is stale — let the server's state win
      if (code === "NOT_IN_PROGRESS" || code === "ALL_ANSWERED") void resyncRef.current();

      if (!affectsTurn && code !== "FORBIDDEN" && code !== "NOT_FOUND") {
        // Best-effort traffic (vision frames) — nothing for the candidate to act on
        console.warn("[WS] error outside a turn:", code, message);
        return;
      }

      let failedAnswer: FailedAnswer | null = null;
      if (pending) {
        // Roll back the optimistic message and hand the answer back for a retry
        if (pending.messageId) dispatch({ type: "REMOVE_MESSAGE", payload: pending.messageId });
        if (pending.kind === "text" && pending.text) failedAnswer = { kind: "text", text: pending.text };
        if (pending.kind === "audio" && pending.blob && code !== "EMPTY_TRANSCRIPT") {
          failedAnswer = { kind: "audio", blob: pending.blob };
        }
        pendingRef.current = null;
      }
      if (affectsTurn) {
        clearResponseTimeout();
        endTurn();
      }
      dispatch({ type: "SERVER_ERROR", payload: { code, message, affectsTurn, failedAnswer } });
    });

    socket.connect();

    return () => {
      disposed = true;
      clearRefreshTimer();
      socket.off("connect");
      socket.off("connect_error");
      socket.off("session_info");
      socket.off("auth_expired");
      socket.off("disconnect");
      socket.off("ai_question");
      socket.off("ai_response");
      socket.off("transcript");
      socket.off("vision_result");
      socket.off("final_feedback");
      socket.off("feedback_failed");
      socket.off("error");
      disconnectSocket();
      socketRef.current = null;
      clearResponseTimeout();
      clearResyncPoll();
      // Drop queued playback and stop any ongoing speech
      playbackGenRef.current += 1;
      playbackRef.current = Promise.resolve();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [isAuthenticated, enqueuePlayback, armResponseTimeout, clearResponseTimeout, clearResyncPoll, endTurn, reconnectSocket]);

  /** Returns the socket if connected; otherwise flags the offline state. */
  const connectedSocket = useCallback((): Socket | null => {
    const socket = socketRef.current;
    if (socket?.connected) return socket;
    dispatch({ type: "CLIENT_ERROR", payload: "offline" });
    return null;
  }, []);

  const startInterview = useCallback(
    ({
      candidateId, role, language = "pt", experienceLevel = "mid", sessionMode = "full", cvSummary = "", interviewer = "male",
    }: StartInterviewParams): boolean => {
      const socket = connectedSocket();
      if (!socket) return false;
      dispatch({ type: "REQUEST_SENT" });
      dispatch({ type: "SET_INTERVIEWER", payload: interviewer });
      emitAction(socket, {
        kind: "start",
        event: "start_interview",
        payload: { candidateId, role, language, experienceLevel, sessionMode, cvSummary, interviewer },
      });
      return true;
    },
    [connectedSocket, emitAction],
  );

  const sendAnswer = useCallback(
    (answer: string, metrics?: VisionMetrics): boolean => {
      if (!state.interviewId) return false;
      if (pendingRef.current) return false; // one answer at a time
      const socket = connectedSocket();
      if (!socket) return false;
      const payload: Record<string, unknown> = {
        interviewId: state.interviewId,
        answer,
      };
      if (metrics) payload.visionMetrics = metrics;
      const messageId = newMessageId();
      dispatch({
        type: "ADD_MESSAGE",
        payload: { id: messageId, role: "candidate", content: answer, timestamp: new Date(), pending: true },
      });
      dispatch({ type: "REQUEST_SENT" });
      emitAction(socket, {
        kind: "text",
        event: "user_answer",
        payload,
        messageId,
        expectedAnswers: expectedAnswers(stateRef.current.messages),
        text: answer,
      });
      return true;
    },
    [state.interviewId, connectedSocket, emitAction],
  );

  const sendAudioAnswer = useCallback(
    (audioBlob: Blob, metrics?: VisionMetrics, language?: string): boolean => {
      if (!state.interviewId) return false;
      if (pendingRef.current) return false; // one answer at a time
      if (!connectedSocket()) return false;
      const interviewId = state.interviewId;
      const answers = expectedAnswers(stateRef.current.messages);
      dispatch({ type: "REQUEST_SENT" });
      const fail = () => {
        dispatch({ type: "SET_AI_STATUS", payload: "listening" });
        dispatch({ type: "SET_FAILED_ANSWER", payload: { kind: "audio", blob: audioBlob } });
      };
      const reader = new FileReader();
      reader.onloadend = () => {
        // Re-check: the connection may have dropped while encoding
        const socket = connectedSocket();
        if (!socket || typeof reader.result !== "string") {
          fail();
          return;
        }
        const base64 = reader.result.split(",")[1];
        const payload: Record<string, unknown> = {
          interviewId,
          audioBase64: base64,
          // The container the browser actually recorded (webm, mp4 on Safari…), without codec params
          mimeType: audioBlob.type.split(";")[0].trim() || "audio/webm",
          language: language ?? "pt",
        };
        if (metrics) payload.visionMetrics = metrics;
        emitAction(socket, {
          kind: "audio",
          event: "audio_answer",
          payload,
          expectedAnswers: answers,
          blob: audioBlob,
        });
      };
      reader.onerror = fail;
      reader.readAsDataURL(audioBlob);
      return true;
    },
    [state.interviewId, connectedSocket, emitAction],
  );

  const sendVisionMetrics = useCallback(
    (frameBase64: string, metrics?: VisionMetrics) => {
      if (!state.interviewId) return;
      const socket = socketRef.current;
      if (!socket?.connected) return; // frames are best-effort — drop while offline
      socket.emit("vision_metrics", {
        interviewId: state.interviewId,
        frameBase64,
        ...(metrics && { metrics }),
      });
    },
    [state.interviewId],
  );

  const clearFailedAnswer = useCallback(() => {
    dispatch({ type: "SET_FAILED_ANSWER", payload: null });
  }, []);

  const retryFeedback = useCallback(async () => {
    const id = state.feedbackFailed?.interviewId || state.interviewId;
    if (!id) return;
    dispatch({ type: "FEEDBACK_RETRY_START" });
    try {
      const feedback = await interviewApi.feedback(id);
      dispatch({ type: "FINAL_FEEDBACK", payload: feedback });
    } catch (err) {
      console.error("[FEEDBACK] retry failed:", err);
      dispatch({ type: "FEEDBACK_RETRY_FAILED" });
    }
  }, [state.feedbackFailed, state.interviewId]);

  return {
    ...state,
    startInterview, sendAnswer, sendAudioAnswer, sendVisionMetrics, retryFeedback, clearFailedAnswer,
  };
};
