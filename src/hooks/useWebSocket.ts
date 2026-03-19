"use client";

import { useEffect, useReducer, useCallback } from "react";
import { getSocket, disconnectSocket } from "@/services/socket";
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
} from "@/types/interview";
import { playAudio, speakText } from "@/utils/audio";

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
  | { type: "SERVER_ERROR"; payload: string };

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
  transcript: "",
};

const STORAGE_KEY = "interview_session";

function loadPersistedState(): Partial<State> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<State>;
  } catch {
    return {};
  }
}

function persistState(state: State) {
  if (typeof window === "undefined") return;
  const { interviewId, messages, feedback, isComplete, visionHistory } = state;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ interviewId, messages, feedback, isComplete, visionHistory }));
}

export function clearInterviewSession() {
  if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "CONNECTED":    return { ...state, isConnected: true, socketError: null };
    case "DISCONNECTED": return { ...state, isConnected: false };
    case "CONNECTION_ERROR": return { ...state, isConnected: false, socketError: action.payload };
    case "SET_INTERVIEW_ID": return { ...state, interviewId: action.payload };
    case "ADD_MESSAGE":  return { ...state, messages: [...state.messages, action.payload] };
    case "SET_AI_STATUS": return { ...state, aiStatus: action.payload };
    case "SET_TRANSCRIPT": return { ...state, transcript: action.payload };
    case "VISION_RESULT": return {
      ...state,
      visionMetrics: action.payload,
      visionHistory: [...state.visionHistory, { metrics: action.payload, timestamp: new Date() }],
    };
    case "FINAL_FEEDBACK": return { ...state, feedback: action.payload, isComplete: true, aiStatus: "idle" };
    case "SERVER_ERROR": return { ...state, socketError: action.payload, aiStatus: "idle" };
    default: return state;
  }
}

export const useWebSocket = (isAuthenticated: boolean) => {
  const [state, dispatch] = useReducer(reducer, { ...initialState, ...loadPersistedState() });

  useEffect(() => {
    persistState(state);
  }, [state.interviewId, state.messages, state.feedback, state.isComplete, state.visionHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMessage = useCallback((role: "interviewer" | "candidate", content: string) => {
    dispatch({ type: "ADD_MESSAGE", payload: { role, content, timestamp: new Date() } });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return; // Don't connect until authenticated

    const socket = getSocket();

    socket.on("connect", () => {
      dispatch({ type: "CONNECTED" });
    });

    socket.on("connect_error", (err) => {
      dispatch({ type: "CONNECTION_ERROR", payload: `Connection error: ${err.message}` });
    });

    socket.on("disconnect", () => {
      dispatch({ type: "DISCONNECTED" });
    });

    socket.on("ai_question", async (data: AiQuestionEvent) => {
      dispatch({ type: "SET_INTERVIEW_ID", payload: data.interviewId });
      addMessage("interviewer", data.question);
      dispatch({ type: "SET_AI_STATUS", payload: "speaking" });
      if (data.audioBase64) {
        await playAudio(data.audioBase64);
      } else {
        await speakText(data.question);
      }
      dispatch({ type: "SET_AI_STATUS", payload: "listening" });
    });

    socket.on("ai_response", async (data: AiResponseEvent) => {
      addMessage("interviewer", data.response);
      dispatch({ type: "SET_AI_STATUS", payload: "speaking" });
      await speakText(data.response);
      dispatch({ type: "SET_AI_STATUS", payload: "thinking" });
    });

    socket.on("transcript", (data: TranscriptEvent) => {
      dispatch({ type: "SET_TRANSCRIPT", payload: data.text });
      addMessage("candidate", data.text);
    });

    socket.on("vision_result", (data: VisionResultEvent) => {
      dispatch({ type: "VISION_RESULT", payload: data.metrics });
    });

    socket.on("final_feedback", (data: FinalFeedbackEvent) => {
      dispatch({ type: "FINAL_FEEDBACK", payload: data.feedback });
    });

    socket.on("error", (data: { message: string }) => {
      dispatch({ type: "SERVER_ERROR", payload: data.message });
    });

    socket.connect();

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.off("ai_question");
      socket.off("ai_response");
      socket.off("transcript");
      socket.off("vision_result");
      socket.off("final_feedback");
      socket.off("error");
      disconnectSocket();
    };
  }, [isAuthenticated, addMessage]);

  const startInterview = useCallback(
    (candidateId: string, role: string, language = "pt", experienceLevel = "mid", sessionMode = "full", cvSummary = "") => {
      const socket = getSocket();
      dispatch({ type: "SET_AI_STATUS", payload: "thinking" });
      socket.emit("start_interview", { candidateId, role, language, experienceLevel, sessionMode, cvSummary });
    },
    [],
  );

  const sendAnswer = useCallback(
    (answer: string, metrics?: VisionMetrics) => {
      if (!state.interviewId) return;
      const socket = getSocket();
      const payload: Record<string, unknown> = {
        interviewId: state.interviewId,
        answer,
      };
      if (metrics) payload.visionMetrics = metrics;
      addMessage("candidate", answer);
      dispatch({ type: "SET_AI_STATUS", payload: "thinking" });
      socket.emit("user_answer", payload);
    },
    [state.interviewId, addMessage],
  );

  const sendAudioAnswer = useCallback(
    (audioBlob: Blob, metrics?: VisionMetrics, language?: string) => {
      if (!state.interviewId) return;
      const socket = getSocket();
      dispatch({ type: "SET_AI_STATUS", payload: "thinking" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        const payload: Record<string, unknown> = {
          interviewId: state.interviewId,
          audioBase64: base64,
          mimeType: "audio/webm",
          language: language ?? "pt",
        };
        if (metrics) payload.visionMetrics = metrics;
        socket.emit("audio_answer", payload);
      };
      reader.readAsDataURL(audioBlob);
    },
    [state.interviewId],
  );

  const sendVisionMetrics = useCallback(
    (frameBase64: string, metrics?: VisionMetrics) => {
      if (!state.interviewId) return;
      const socket = getSocket();
      socket.emit("vision_metrics", {
        interviewId: state.interviewId,
        frameBase64,
        ...(metrics && { metrics }),
      });
    },
    [state.interviewId],
  );

  return { ...state, startInterview, sendAnswer, sendAudioAnswer, sendVisionMetrics };
};
