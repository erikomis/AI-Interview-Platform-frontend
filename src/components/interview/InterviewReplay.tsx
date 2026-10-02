"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InterviewMessage } from "@/types/interview";

interface InterviewReplayProps {
  messages: InterviewMessage[];
  /** Display name of the interviewer persona */
  interviewerName: string;
}

const STEP_DELAY_MS = 1800;

export function InterviewReplay({ messages, interviewerName }: InterviewReplayProps) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const t = useTranslations("replay");

  const dateLocale = locale === "pt" ? "pt-BR" : "en-US";

  function formatTimestamp(date: Date): string {
    return date.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [cursor]);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPlaying(false);
  }, []);

  const advance = useCallback(() => {
    setCursor((prev) => {
      const next = prev + 1;
      if (next >= messages.length) { setPlaying(false); return messages.length - 1; }
      return next;
    });
  }, [messages.length]);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setTimeout(advance, STEP_DELAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, cursor, advance]);

  const handlePlay = () => {
    if (cursor >= messages.length - 1) setCursor(0);
    setPlaying(true);
  };

  const visible = messages.slice(0, cursor + 1);
  const progress = messages.length > 1 ? cursor / (messages.length - 1) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{t("title")}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {t("messages", { current: cursor + 1, total: messages.length })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { stop(); setCursor(0); }} title={t("reset")}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { stop(); setCursor((p) => Math.max(0, p - 1)); }} title={t("previous")} disabled={cursor <= 0}>
            <SkipBack className="w-3.5 h-3.5" />
          </Button>
          {playing ? (
            <Button variant="default" size="icon" className="h-9 w-9" onClick={stop} title={t("pause")}>
              <Pause className="w-4 h-4" />
            </Button>
          ) : (
            <Button variant="default" size="icon" className="h-9 w-9" onClick={handlePlay} title={t("play")}>
              <Play className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { stop(); setCursor((p) => Math.min(messages.length - 1, p + 1)); }} title={t("next")} disabled={cursor >= messages.length - 1}>
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div ref={listRef} className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {visible.map((msg, i) => {
            const isActive = i === cursor;
            const isInterviewer = msg.role === "interviewer";
            return (
              <div
                key={`${msg.role}-${i}-${msg.timestamp instanceof Date ? msg.timestamp.getTime() : i}`}
                className={cn(
                  "flex gap-2 transition-all duration-300",
                  isInterviewer ? "justify-start" : "justify-end",
                  isActive ? "opacity-100 translate-y-0" : "opacity-60"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                    isInterviewer
                      ? "bg-secondary text-secondary-foreground rounded-tl-sm"
                      : "bg-primary text-primary-foreground rounded-tr-sm",
                    isActive && "ring-2 ring-offset-1",
                    isActive && isInterviewer && "ring-cyan-500/50",
                    isActive && !isInterviewer && "ring-primary/50"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium opacity-70">
                      {isInterviewer ? t("aiLabel", { name: interviewerName }) : t("candidateLabel")}
                    </span>
                    <span className="text-[10px] opacity-50">{formatTimestamp(msg.timestamp)}</span>
                  </div>
                  <p className="leading-relaxed">{msg.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
