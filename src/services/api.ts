import type {
  StartInterviewResponse,
  AnswerResponse,
  InterviewFeedback,
  InterviewDetails,
  VisionMetrics,
  UserHistory,
  AnalyticsData,
} from "@/types/interview";
import { BACKEND_URL } from "@/lib/config";
import { refreshSession, redirectToLogin, HttpError } from "@/services/auth";

export async function apiFetch<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (res.status === 401 && !isRetry) {
    if (await refreshSession()) {
      return apiFetch<T>(path, init, true);
    }
    redirectToLogin();
    throw new HttpError(401, "Session expired");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(res.status, `${res.status} ${body}`);
  }

  if (res.status === 204) return undefined as T;
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
      body: JSON.stringify(visionMetrics ? { answer, visionMetrics } : { answer }),
    }),

  feedback: (id: string) =>
    apiFetch<InterviewFeedback>(`/interviews/${id}/feedback`, { method: "POST" }),

  get: (id: string) =>
    apiFetch<InterviewDetails>(`/interviews/${id}`, { cache: "no-store" }),

  history: () =>
    apiFetch<UserHistory>("/interviews/me/history", { cache: "no-store" }),

  analytics: () =>
    apiFetch<AnalyticsData>("/interviews/me/analytics", { cache: "no-store" }),
};
