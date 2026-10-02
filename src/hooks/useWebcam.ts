"use client";

import { useRef, useState, useCallback, useEffect } from "react";

/** Error key; the UI translates it. */
export type WebcamError = "unavailable";

export const useWebcam = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<WebcamError | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsActive(true);
      setError(null);
    } catch {
      setError("unavailable");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }, []);

  // Release the camera on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !videoRef.current.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  }, []);

  return { videoRef, isActive, error, startCamera, stopCamera, captureFrame };
};
