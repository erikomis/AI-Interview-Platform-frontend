"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, Wifi, WifiOff, RotateCcw, CheckCircle2, AlertCircle, History, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useWebSocket, clearInterviewSession } from "@/hooks/useWebSocket";
import { VideoPreview } from "@/components/video/VideoPreview";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { InterviewChat } from "@/components/interview/InterviewChat";
import { FeedbackPanel } from "@/components/interview/FeedbackPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AIAvatarScene = dynamic(
  () => import("@/components/avatar/AIAvatarScene").then((m) => ({ default: m.AIAvatarScene })),
  { ssr: false }
);

export function InterviewClient() {
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations("interview");
  const tc = useTranslations("common");

  const [candidateName, setCandidateName] = useState("");
  const [candidateRole, setCandidateRole] = useState("");
  const [candidateLanguage, setCandidateLanguage] = useState("pt");
  const [candidateLevel, setCandidateLevel] = useState("mid");
  const [sessionMode, setSessionMode] = useState("full");
  const [cvSummary, setCvSummary] = useState("");
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);

  const {
    isConnected, interviewId, messages, feedback, visionMetrics,
    visionHistory, aiStatus, isComplete, socketError, clientError,
    feedbackFailed, feedbackRetrying,
    startInterview, sendAnswer, sendAudioAnswer, sendVisionMetrics, retryFeedback,
  } = useWebSocket(!!user, candidateLanguage);

  useEffect(() => { console.log("[WS] isConnected:", isConnected); }, [isConnected]);
  useEffect(() => { console.log("[WS] interviewId:", interviewId); }, [interviewId]);
  useEffect(() => { console.log("[WS] aiStatus:", aiStatus); }, [aiStatus]);
  useEffect(() => { console.log("[WS] isComplete:", isComplete); }, [isComplete]);
  useEffect(() => { console.log("[WS] socketError:", socketError); }, [socketError]);
  useEffect(() => { console.log("[WS] messages updated — count:", messages.length, messages); }, [messages]);
  useEffect(() => { console.log("[WS] feedback updated:", feedback); }, [feedback]);
  useEffect(() => { console.log("[WS] visionMetrics updated:", visionMetrics); }, [visionMetrics]);

  // Redirect to login if session expires mid-interview
  useEffect(() => {
    if (!user && started) {
      router.replace("/login?next=/interview");
    }
  }, [user, started, router]);

  useEffect(() => {
    console.log("[SESSION] loading from sessionStorage");
    const name     = sessionStorage.getItem("candidateName");
    const role     = sessionStorage.getItem("candidateRole");
    const language = sessionStorage.getItem("candidateLanguage") ?? "pt";
    const level    = sessionStorage.getItem("candidateLevel") ?? "mid";
    const mode     = sessionStorage.getItem("sessionMode") ?? "full";
    const cv       = sessionStorage.getItem("cvSummary") ?? "";
    if (!name || !role) { router.replace("/"); return; }
    setCandidateName(name);
    setCandidateRole(role);
    setCandidateLanguage(language);
    setCandidateLevel(level);
    setSessionMode(mode);
    setCvSummary(cv);
  }, [router]);

  // If the connection drops before the server created the interview, the
  // start_interview request may be lost — allow it to be re-emitted on reconnect.
  useEffect(() => {
    if (!isConnected && !interviewId) startedRef.current = false;
  }, [isConnected, interviewId]);

  useEffect(() => {
    if (isConnected && candidateName && candidateRole && !startedRef.current) {
      startedRef.current = true;
      setStarted(true);
      if (!interviewId) {
        const sent = startInterview(candidateName, candidateRole, candidateLanguage, candidateLevel, sessionMode, cvSummary);
        if (!sent) startedRef.current = false;
      }
    }
  }, [isConnected, candidateName, candidateRole, candidateLanguage, candidateLevel, sessionMode, cvSummary, startInterview, interviewId]);

  const handleFrameCapture = useCallback((frame: string) => {
    if (!interviewId) return;
    sendVisionMetrics(frame);
  }, [interviewId, sendVisionMetrics]);

  const handleRestart = () => {
    sessionStorage.removeItem("candidateName");
    sessionStorage.removeItem("candidateRole");
    clearInterviewSession();
    router.push("/");
  };

  const aiStatusText: Record<string, string> = {
    idle:      t("aiIdle"),
    thinking:  t("aiThinking"),
    speaking:  t("aiSpeaking"),
    listening: t("aiListening"),
  };
  const aiStatusColor: Record<string, string> = {
    idle:      "text-muted-foreground",
    thinking:  "text-amber-400",
    speaking:  "text-cyan-400",
    listening: "text-emerald-400",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-semibold text-sm">{tc("brand")}</span>
              {candidateRole && (
                <span className="text-xs text-muted-foreground ml-2">— {candidateRole}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={isConnected ? "success" : "destructive"} className="gap-1.5 text-xs">
              {isConnected ? (
                <><Wifi className="w-3 h-3" /> {t("connected")}</>
              ) : (
                <><WifiOff className="w-3 h-3" /> {t("disconnected")}</>
              )}
            </Badge>

            {isComplete && (
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                {t("complete")}
              </Badge>
            )}

            <Button variant="ghost" size="sm" onClick={() => router.push("/history")} className="gap-1.5">
              <History className="w-4 h-4" />
              {t("history")}
            </Button>

            <Button variant="ghost" size="sm" onClick={handleRestart} className="gap-1.5">
              <RotateCcw className="w-4 h-4" />
              {t("newInterview")}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <aside className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-white/5 shadow-xl shadow-cyan-950/30">
            <AIAvatarScene aiStatus={aiStatus} />
            <div className="px-4 py-2 flex items-center justify-between bg-card border-t border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{tc("aiName")}</span>
                <span className="text-xs text-muted-foreground">— {t("interviewer")}</span>
              </div>
              <span className={`text-xs font-medium ${aiStatusColor[aiStatus] ?? "text-muted-foreground"}`}>
                {aiStatusText[aiStatus] ?? ""}
              </span>
            </div>
          </div>

          <VideoPreview
            visionMetrics={visionMetrics}
            onFrameCapture={started ? handleFrameCapture : undefined}
          />

          {candidateName && (
            <div className="rounded-xl border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">{t("candidate")}</p>
              <p className="font-semibold">{candidateName}</p>
              <p className="text-sm text-muted-foreground">{candidateRole}</p>
            </div>
          )}

          {messages.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-2">
              {(() => {
                const totalMap: Record<string, number> = { practice: 5, full: 10, intensive: 15 };
                const total = totalMap[sessionMode] ?? 10;
                const current = Math.min(messages.filter((m) => m.role === "candidate").length, total);
                return (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("progress")}</span>
                      <span>{current}/{total} {t("questions")}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(current / total, 1) * 100}%` }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </aside>

        <div className="flex flex-col gap-4 min-h-0">
          {(clientError || socketError) && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-center gap-2 text-sm text-destructive animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {clientError ? t(`errors.${clientError}`) : socketError}
            </div>
          )}

          {feedbackFailed && !isComplete && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-center justify-between gap-3 text-sm text-destructive animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{t("errors.feedbackFailed")}</span>
              </div>
              <Button size="sm" variant="outline" onClick={retryFeedback} disabled={feedbackRetrying} className="gap-1.5 shrink-0">
                {feedbackRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {feedbackRetrying ? t("retryingFeedback") : t("retryFeedback")}
              </Button>
            </div>
          )}

          {isComplete && feedback ? (
            <div className="flex-1 overflow-y-auto">
              <FeedbackPanel
                feedback={feedback}
                role={candidateRole}
                messages={messages}
                visionHistory={visionHistory}
              />
            </div>
          ) : (
            <>
              <div className={cn("flex-1 overflow-y-auto rounded-xl border bg-card px-4 py-3", "min-h-[400px] lg:min-h-0")}>
                <InterviewChat messages={messages} aiThinking={aiStatus === "thinking"} />
              </div>

              <div className="rounded-xl border bg-card p-4">
                <AudioRecorder
                  aiStatus={aiStatus}
                  onSendText={(text) => sendAnswer(text, visionMetrics ?? undefined)}
                  onSendAudio={(blob) => sendAudioAnswer(blob, visionMetrics ?? undefined, candidateLanguage)}
                  disabled={isComplete || !started || !!feedbackFailed}
                />
              </div>
            </>
          )}

          {isComplete && (
            <div className="flex gap-3">
              <Button onClick={handleRestart} variant="outline" className="flex-1 gap-2">
                <RotateCcw className="w-4 h-4" />
                {t("newInterview")}
              </Button>
              <Button onClick={() => router.push("/history")} variant="outline" className="flex-1 gap-2">
                <History className="w-4 h-4" />
                {t("history")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
