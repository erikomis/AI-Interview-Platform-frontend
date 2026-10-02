"use client";

import { useCallback, useEffect, useRef } from "react";
import { getSocket } from "@/services/socket";
import type { ServerErrorCode } from "@/types/interview";

const TRANSCRIBE_TIMEOUT_MS = 90_000;

/** Server error codes that answer a pending `transcribe_audio` request. */
const TRANSCRIBE_ERRORS: ReadonlySet<string> = new Set([
  "EMPTY_TRANSCRIPT", "TRANSCRIPTION_FAILED", "RATE_LIMITED", "INVALID_PAYLOAD",
  "NOT_IN_PROGRESS", "ALL_ANSWERED", "FORBIDDEN", "NOT_FOUND", "INTERNAL",
]);

export class TranscriptionError extends Error {
  constructor(public readonly code: ServerErrorCode | "TIMEOUT" | "OFFLINE") {
    super(code);
  }
}

/**
 * Speech → text for review: the recording is transcribed by the server and the
 * text comes back to the candidate, who can fix misrecognised words before
 * sending it as a normal text answer.
 */
export function useTranscription(interviewId: string | null) {
  const pending = useRef<{ resolve: (text: string) => void; reject: (e: TranscriptionError) => void } | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onTranscription = (data: { interviewId: string; text: string }) => {
      if (data.interviewId !== interviewId || !pending.current) return;
      pending.current.resolve(data.text);
      pending.current = null;
    };
    const onError = (data: { code?: string }) => {
      if (!pending.current || !data?.code || !TRANSCRIBE_ERRORS.has(data.code)) return;
      pending.current.reject(new TranscriptionError(data.code as ServerErrorCode));
      pending.current = null;
    };
    socket.on("transcription", onTranscription);
    socket.on("error", onError);
    return () => {
      socket.off("transcription", onTranscription);
      socket.off("error", onError);
      pending.current?.reject(new TranscriptionError("OFFLINE"));
      pending.current = null;
    };
  }, [interviewId]);

  return useCallback(
    (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const socket = getSocket();
        if (!interviewId || !socket.connected) return reject(new TranscriptionError("OFFLINE"));
        pending.current?.reject(new TranscriptionError("OFFLINE"));

        const timer = setTimeout(() => {
          pending.current = null;
          reject(new TranscriptionError("TIMEOUT"));
        }, TRANSCRIBE_TIMEOUT_MS);
        pending.current = {
          resolve: (text) => { clearTimeout(timer); resolve(text); },
          reject: (e) => { clearTimeout(timer); reject(e); },
        };

        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result !== "string") {
            pending.current?.reject(new TranscriptionError("OFFLINE"));
            pending.current = null;
            return;
          }
          socket.emit("transcribe_audio", {
            interviewId,
            audioBase64: reader.result.split(",")[1],
            mimeType: blob.type.split(";")[0].trim() || "audio/webm",
          });
        };
        reader.readAsDataURL(blob);
      }),
    [interviewId],
  );
}
