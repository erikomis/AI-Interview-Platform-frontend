"use client";

import { useEffect, useReducer, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "@/services/socket";
import { refreshSession, redirectToLogin } from "@/services/auth";
import { interviewApi } from "@/services/api";
import type {
  InterviewMessage,
  InterviewFeedback,
  VisionMetrics,
  VisionSnapshot,
  AIStatus,
  AiQuestionEvent,
  AiResponseEvent,
  TranscriptEvent,
  VisionResultEvent,
  FinalFeedbackEvent,
  FeedbackFailedEvent,
} from "@/types/interview";
import { playAudio, speakText } from "@/utils/audio";

/** Client-side errors; the UI translates them. */
export type ClientErrorKey = "offline" | "timeout" | "feedbackRetryFailed";

type State = {
  isConnected: boolean;
  interviewId: string | null;
  messages: InterviewMessage[];
  feedback: InterviewFeedback | null;
  visionMetrics: VisionMetrics | null;
  visionHistory: VisionSnapshot[];
  aiStatus: AIStatus;
  isComplete: boolean;
  socketError: string | null;
  clientError: ClientErrorKey | null;
  feedbackFailed: { interviewId: string; message: string } | null;
  feedbackRetrying: boolean;
  transcript: string;
};

type Action =
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "CONNECTION_ERROR"; payload: string }
  | { type: "SET_INTERVIEW_ID"; payload: string }
  | { type: "ADD_MESSAGE"; payload: InterviewMessage }
  | { type: "SET_AI_STATUS"; payload: AIStatus }
  | { type: "SET_TRANSCRIPT"; payload: string }
  | { type: "VISION_RESULT"; payload: VisionMetrics }
  | { type: "FINAL_FEEDBACK"; payload: InterviewFeedback }
  | { type: "SERVER_ERROR"; payload: string }
  | { type: "CLIENT_ERROR"; payload: ClientErrorKey }
  | { type: "FEEDBACK_FAILED"; payload: { interviewId: string; message: string } }
  | { type: "FEEDBACK_RETRY_START" }
  | { type: "FEEDBACK_RETRY_FAILED" }
  | { type: "REQUEST_SENT" }
  | { type: "SERVER_RESPONDED" };

const initialState: State = {
  isConnected: false,
  interviewId: null,
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
  transcript: "",
};

const STORAGE_KEY = "interview_session";

/** Max time to wait for the server to answer (local LLMs can be slow). */
const RESPONSE_TIMEOUT_MS = 6 * 60 * 1000;

function reviveDate(value: unknown): Date {
  const d = new Date(value as string | number | Date);
  return isNaN(d.getTime()) ? new Date() : d;
}

function loadPersistedState(): Partial<State> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<State>;
    // JSON turns Dates into strings — revive them so consumers can call getTime() etc.
    return {
      ...parsed,
      messages: (parsed.messages ?? []).map((m) => ({ ...m, timestamp: reviveDate(m.timestamp) })),
      visionHistory: (parsed.visionHistory ?? []).map((v) => ({ ...v, timestamp: reviveDate(v.timestamp) })),
    };
  } catch {
    return {};
  }
}

function persistState(state: State) {
  if (typeof window === "undefined") return;
  const { interviewId, messages, feedback, isComplete, visionHistory } = state;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ interviewId, messages, feedback, isComplete, visionHistory }));
  } catch {
    // storage full / unavailable — persistence is best-effort
  }
}

export function clearInterviewSession() {
  if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "CONNECTED":    return { ...state, isConnected: true, socketError: null, clientError: state.clientError === "offline" ? null : state.clientError };
    case "DISCONNECTED": return { ...state, isConnected: false };
    case "CONNECTION_ERROR": return { ...state, isConnected: false, socketError: action.payload };
    case "SET_INTERVIEW_ID": return { ...state, interviewId: action.payload };
    case "ADD_MESSAGE":  return { ...state, messages: [...state.messages, action.payload] };
    // Once the interview is complete, late playback callbacks must not leave the status stuck
    case "SET_AI_STATUS": return state.isComplete ? state : { ...state, aiStatus: action.payload };
    case "SET_TRANSCRIPT": return { ...state, transcript: action.payload };
    case "VISION_RESULT": return {
      ...state,
      visionMetrics: action.payload,
      visionHistory: [...state.visionHistory, { metrics: action.payload, timestamp: new Date() }],
    };
    case "FINAL_FEEDBACK": return {
      ...state, feedback: action.payload, isComplete: true, aiStatus: "idle",
      feedbackFailed: null, feedbackRetrying: false, socketError: null, clientError: null,
    };
    case "SERVER_ERROR": return { ...state, socketError: action.payload, aiStatus: "idle" };
    case "CLIENT_ERROR": return {
      ...state,
      clientError: action.payload,
      aiStatus: action.payload === "timeout" ? "idle" : state.aiStatus,
    };
    case "FEEDBACK_FAILED": return { ...state, feedbackFailed: action.payload, feedbackRetrying: false, aiStatus: "idle" };
    case "FEEDBACK_RETRY_START": return { ...state, feedbackRetrying: true, clientError: null };
    case "REQUEST_SENT": return { ...state, aiStatus: "thinking", socketError: null, clientError: null };
    case "SERVER_RESPONDED": return { ...state, clientError: state.clientError === "timeout" ? null : state.clientError };
    case "FEEDBACK_RETRY_FAILED": return { ...state, feedbackRetrying: false, clientError: "feedbackRetryFailed" };
    default: return state;
  }
}

export const useWebSocket = (isAuthenticated: boolean, language = "pt") => {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...initialState, ...loadPersistedState() }));

  const socketRef = useRef<Socket | null>(null);
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Serialized audio playback: ai_response speech, then ai_question audio, never overlapping
  const playbackRef = useRef<Promise<void>>(Promise.resolve());
  const playbackGenRef = useRef(0);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    persistState(state);
  }, [state.interviewId, state.messages, state.feedback, state.isComplete, state.visionHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMessage = useCallback((role: "interviewer" | "candidate", content: string) => {
    dispatch({ type: "ADD_MESSAGE", payload: { role, content, timestamp: new Date() } });
  }, []);

  const clearResponseTimeout = useCallback(() => {
    if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    responseTimerRef.current = null;
  }, []);

  const armResponseTimeout = useCallback(() => {
    clearResponseTimeout();
    responseTimerRef.current = setTimeout(() => {
      responseTimerRef.current = null;
      dispatch({ type: "CLIENT_ERROR", payload: "timeout" });
    }, RESPONSE_TIMEOUT_MS);
  }, [clearResponseTimeout]);

  const enqueuePlayback = useCallback((task: () => Promise<void>) => {
    const gen = playbackGenRef.current;
    playbackRef.current = playbackRef.current
      .then(() => (gen === playbackGenRef.current ? task() : undefined))
      .catch((err) => console.error("[AUDIO] playback failed:", err));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return; // Don't connect until authenticated

    const socket = getSocket();
    socketRef.current = socket;
    let disposed = false;
    let authExpired = false;
    let reauthAttempts = 0;

    const reauthAndReconnect = async () => {
      // Avoid an endless loop if the server keeps rejecting freshly refreshed tokens
      if (reauthAttempts >= 2) { redirectToLogin(); return; }
      reauthAttempts += 1;
      const ok = await refreshSession();
      if (disposed) return;
      if (ok) socket.connect();
      else redirectToLogin();
    };

    socket.on("connect", () => {
      reauthAttempts = 0;
      dispatch({ type: "CONNECTED" });
    });

    socket.on("connect_error", (err: Error) => {
      if (err.message === "unauthorized") {
        void reauthAndReconnect();
        return;
      }
      dispatch({ type: "CONNECTION_ERROR", payload: `Connection error: ${err.message}` });
    });

    // Server signals the access token expired mid-session; it disconnects right after
    socket.on("auth_expired", () => {
      authExpired = true;
      void refreshSession(); // start early; single-flight so reauth below reuses it
    });

    socket.on("disconnect", (reason: Socket.DisconnectReason) => {
      dispatch({ type: "DISCONNECTED" });
      // "io server disconnect" is not auto-reconnected by socket.io
      if (authExpired && reason === "io server disconnect") {
        authExpired = false;
        void reauthAndReconnect();
      }
    });

    socket.on("ai_question", (data: AiQuestionEvent) => {
      clearResponseTimeout();
      dispatch({ type: "SERVER_RESPONDED" });
      dispatch({ type: "SET_INTERVIEW_ID", payload: data.interviewId });
      addMessage("interviewer", data.question);
      enqueuePlayback(async () => {
        dispatch({ type: "SET_AI_STATUS", payload: "speaking" });
        if (data.audioBase64) {
          await playAudio(data.audioBase64);
        } else {
          await speakText(data.question, languageRef.current);
        }
        dispatch({ type: "SET_AI_STATUS", payload: "listening" });
      });
    });

    socket.on("ai_response", (data: AiResponseEvent) => {
      clearResponseTimeout();
      dispatch({ type: "SERVER_RESPONDED" });
      addMessage("interviewer", data.response);
      enqueuePlayback(async () => {
        dispatch({ type: "SET_AI_STATUS", payload: "speaking" });
        await speakText(data.response, languageRef.current);
        // Still waiting for the next question (or feedback) — a queued ai_question will take over
        dispatch({ type: "SET_AI_STATUS", payload: "thinking" });
      });
      // The next question / feedback may still take a while
      armResponseTimeout();
    });

    socket.on("transcript", (data: TranscriptEvent) => {
      dispatch({ type: "SET_TRANSCRIPT", payload: data.text });
      addMessage("candidate", data.text);
    });

    socket.on("vision_result", (data: VisionResultEvent) => {
      dispatch({ type: "VISION_RESULT", payload: data.metrics });
    });

    socket.on("final_feedback", (data: FinalFeedbackEvent) => {
      clearResponseTimeout();
      dispatch({ type: "FINAL_FEEDBACK", payload: data.feedback });
    });

    socket.on("feedback_failed", (data: FeedbackFailedEvent) => {
      clearResponseTimeout();
      dispatch({ type: "FEEDBACK_FAILED", payload: { interviewId: data.interviewId, message: data.message } });
    });

    socket.on("error", (data: { message: string }) => {
      clearResponseTimeout();
      dispatch({ type: "SERVER_ERROR", payload: data.message });
    });

    socket.connect();

    return () => {
      disposed = true;
      socket.off("connect");
      socket.off("connect_error");
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
      // Drop queued playback and stop any ongoing speech
      playbackGenRef.current += 1;
      playbackRef.current = Promise.resolve();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [isAuthenticated, addMessage, enqueuePlayback, armResponseTimeout, clearResponseTimeout]);

  /** Returns the socket if connected; otherwise flags the offline state. */
  const connectedSocket = useCallback((): Socket | null => {
    const socket = socketRef.current;
    if (socket?.connected) return socket;
    dispatch({ type: "CLIENT_ERROR", payload: "offline" });
    return null;
  }, []);

  const startInterview = useCallback(
    (candidateId: string, role: string, language = "pt", experienceLevel = "mid", sessionMode = "full", cvSummary = ""): boolean => {
      const socket = connectedSocket();
      if (!socket) return false;
      dispatch({ type: "REQUEST_SENT" });
      socket.emit("start_interview", { candidateId, role, language, experienceLevel, sessionMode, cvSummary });
      armResponseTimeout();
      return true;
    },
    [connectedSocket, armResponseTimeout],
  );

  const sendAnswer = useCallback(
    (answer: string, metrics?: VisionMetrics): boolean => {
      if (!state.interviewId) return false;
      const socket = connectedSocket();
      if (!socket) return false;
      const payload: Record<string, unknown> = {
        interviewId: state.interviewId,
        answer,
      };
      if (metrics) payload.visionMetrics = metrics;
      addMessage("candidate", answer);
      dispatch({ type: "REQUEST_SENT" });
      socket.emit("user_answer", payload);
      armResponseTimeout();
      return true;
    },
    [state.interviewId, addMessage, connectedSocket, armResponseTimeout],
  );

  const sendAudioAnswer = useCallback(
    (audioBlob: Blob, metrics?: VisionMetrics, language?: string): boolean => {
      if (!state.interviewId) return false;
      if (!connectedSocket()) return false;
      const interviewId = state.interviewId;
      dispatch({ type: "REQUEST_SENT" });
      const reader = new FileReader();
      reader.onloadend = () => {
        // Re-check: the connection may have dropped while encoding
        const socket = connectedSocket();
        if (!socket) {
          dispatch({ type: "SET_AI_STATUS", payload: "listening" });
          return;
        }
        const base64 = (reader.result as string).split(",")[1];
        const payload: Record<string, unknown> = {
          interviewId,
          audioBase64: base64,
          mimeType: "audio/webm",
          language: language ?? "pt",
        };
        if (metrics) payload.visionMetrics = metrics;
        socket.emit("audio_answer", payload);
        armResponseTimeout();
      };
      reader.onerror = () => dispatch({ type: "SET_AI_STATUS", payload: "listening" });
      reader.readAsDataURL(audioBlob);
      return true;
    },
    [state.interviewId, connectedSocket, armResponseTimeout],
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

  const retryFeedback = useCallback(async () => {
    const id = state.feedbackFailed?.interviewId ?? state.interviewId;
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

  return { ...state, startInterview, sendAnswer, sendAudioAnswer, sendVisionMetrics, retryFeedback };
};
