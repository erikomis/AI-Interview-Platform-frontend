"use client";

import { useRef, useState, useCallback, useEffect } from "react";

/** Error key; the UI translates it. */
export type MicrophoneError = "unavailable";

const FALLBACK_MIME = "audio/webm";

/** First container the browser can record (Safari has no webm), or the browser default. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
}

export const useMicrophone = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<MicrophoneError | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      // Browser-side clean-up of the voice: big accuracy win for speech recognition
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      releaseStream();
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setError(null);
    } catch {
      releaseStream();
      setError("unavailable");
    }
  }, [releaseStream]);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        mediaRecorderRef.current = null;
        releaseStream();
        setIsRecording(false);
        resolve(new Blob([], { type: FALLBACK_MIME }));
        return;
      }

      recorder.onstop = () => {
        // The real container the browser produced (e.g. audio/mp4 on Safari)
        const type = recorder.mimeType || chunksRef.current[0]?.type || FALLBACK_MIME;
        const blob = new Blob(chunksRef.current, { type });
        mediaRecorderRef.current = null;
        releaseStream();
        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, [releaseStream]);

  // Release the microphone on unmount
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      mediaRecorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return { isRecording, error, startRecording, stopRecording };
};
