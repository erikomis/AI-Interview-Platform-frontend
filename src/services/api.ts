import type { StartInterviewResponse, AnswerResponse, InterviewFeedback, VisionMetrics } from "@/types/interview";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

function clearSessionAndRedirect() {
  document.cookie = "session_hint=; path=/; max-age=0";
  window.location.href = "/login";
}

async function apiFetch<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (res.status === 401 && !isRetry) {
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      return apiFetch<T>(path, init, true);
    }
    clearSessionAndRedirect();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${body}`);
  }

  return res.json() as Promise<T>;
}

export const interviewApi = {
  start: (candidateId: string, role: string) =>
    apiFetch<StartInterviewResponse>("/interviews", {
      method: "POST",
      body: JSON.stringify({ candidateId, role }),
    }),

  answer: (id: string, answer: string, visionMetrics?: VisionMetrics) =>
    apiFetch<AnswerResponse>(`/interviews/${id}/answer`, {
      method: "POST",
      body: JSON.stringify({
        answer,
        visionMetrics: visionMetrics ?? { eye_contact: 0.5, stress_level: 0.3, confidence: 0.7 },
      }),
    }),

  feedback: (id: string) =>
    apiFetch<InterviewFeedback>(`/interviews/${id}/feedback`, { method: "POST" }),

  get: (id: string) =>
    apiFetch<unknown>(`/interviews/${id}`),

  history: () =>
    apiFetch<unknown>("/interviews/me/history"),
};
