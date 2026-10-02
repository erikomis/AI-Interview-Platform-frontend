"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Mic, MicOff, Send, Loader2 } from "lucide-react";
import { useMicrophone } from "@/hooks/useMicrophone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AIStatus } from "@/types/interview";

interface AudioRecorderProps {
  aiStatus: AIStatus;
  /** Return false when the answer could not be sent (e.g. offline) to keep the input. */
  onSendText: (text: string) => boolean | void;
  onSendAudio: (blob: Blob) => boolean | void;
  disabled?: boolean;
}

export function AudioRecorder({ aiStatus, onSendText, onSendAudio, disabled }: AudioRecorderProps) {
  const [textInput, setTextInput] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isRecording, error, startRecording, stopRecording } = useMicrophone();
  const t = useTranslations("audio");

  const isDisabled = disabled || aiStatus === "thinking" || aiStatus === "speaking";

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob.size > 0) onSendAudio(blob);
    } else {
      await startRecording();
    }
  };

  const handleSendText = () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    if (onSendText(trimmed) === false) return;
    setTextInput("");
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-center h-8">
        {aiStatus === "thinking" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("aiProcessing")}
          </div>
        )}
        {aiStatus === "speaking" && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <div className="flex items-end gap-0.5 h-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="wave-bar" />
              ))}
            </div>
            {t("aiSpeaking")}
          </div>
        )}
        {aiStatus === "listening" && (
          <div className="text-sm text-emerald-600 font-medium">{t("yourTurn")}</div>
        )}
        {aiStatus === "idle" && (
          <div className="text-sm text-muted-foreground">{t("waitingStart")}</div>
        )}
      </div>

      {/* Recording state */}
      {isRecording && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="recording-dot w-3 h-3 rounded-full bg-destructive" />
            <span className="text-sm font-medium text-destructive">{t("recording")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground">{formatTime(recordingTime)}</span>
            <Button size="sm" variant="destructive" onClick={handleToggleRecording}>
              <MicOff className="w-4 h-4 mr-1.5" />
              {t("stopAndSend")}
            </Button>
          </div>
        </div>
      )}

      {/* Text input + controls */}
      {!isRecording && (
        <div className="flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendText();
              }
            }}
            placeholder={isDisabled ? t("waitForAI") : t("typeAnswer")}
            disabled={isDisabled}
            className="flex-1"
          />

          <Button
            size="icon"
            variant="outline"
            onClick={handleToggleRecording}
            disabled={isDisabled}
            className={cn(
              "shrink-0",
              isRecording && "bg-destructive/10 border-destructive/30 text-destructive"
            )}
            title={t("recordAudio")}
          >
            <Mic className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            onClick={handleSendText}
            disabled={isDisabled || !textInput.trim()}
            className="shrink-0"
            title={t("sendAnswer")}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
