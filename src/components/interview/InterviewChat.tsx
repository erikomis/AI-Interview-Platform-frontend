"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InterviewMessage } from "@/types/interview";

interface InterviewChatProps {
  messages: InterviewMessage[];
  aiThinking?: boolean;
}

export function InterviewChat({ messages, aiThinking }: InterviewChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const t = useTranslations("interview");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiThinking]);

  if (messages.length === 0 && !aiThinking) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">{t("waitingStart")}</p>
        </div>
      </div>
    );
  }

  const dateLocale = locale === "pt" ? "pt-BR" : "en-US";

  return (
    <div className="flex flex-col gap-4 py-2">
      {messages.map((msg, i) => (
        <div
          key={msg.id ?? i}
          className={cn(
            "flex gap-3 animate-slide-up",
            msg.role === "candidate" && "flex-row-reverse",
            msg.pending && "opacity-70"
          )}
          aria-busy={msg.pending || undefined}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              msg.role === "interviewer" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
            )}
          >
            {msg.role === "interviewer" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>

          <div
            className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              msg.role === "interviewer"
                ? "bg-muted text-foreground rounded-tl-sm"
                : "bg-primary text-primary-foreground rounded-tr-sm"
            )}
          >
            <p>{msg.content}</p>
            <p className={cn("text-xs mt-1.5", msg.role === "interviewer" ? "text-muted-foreground" : "text-primary-foreground/70")}>
              {new Date(msg.timestamp).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}

      {aiThinking && (
        <div className="flex gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
            <div className="thinking-dot" />
            <div className="thinking-dot" />
            <div className="thinking-dot" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
