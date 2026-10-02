import { useTranslations } from "next-intl";
import { Trophy, TrendingUp, TrendingDown, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { InterviewFeedback, InterviewMessage, VisionSnapshot } from "@/types/interview";
import { BehaviorHeatmap } from "./BehaviorHeatmap";
import { InterviewReplay } from "./InterviewReplay";

interface FeedbackPanelProps {
  feedback: InterviewFeedback;
  /** Display name of the interviewer persona (used in the replay) */
  interviewerName: string;
  role: string;
  messages: InterviewMessage[];
  visionHistory: VisionSnapshot[];
}

export function FeedbackPanel({ feedback, interviewerName, role, messages, visionHistory }: FeedbackPanelProps) {
  const t = useTranslations("feedback");

  const scoreLabel = (score: number) => {
    if (score >= 9) return { label: t("excellent"), variant: "success" as const };
    if (score >= 7) return { label: t("good"),      variant: "default" as const };
    if (score >= 5) return { label: t("average"),   variant: "warning" as const };
    return           { label: t("needsWork"),        variant: "destructive" as const };
  };

  const metrics = [
    { key: "technical"     as const, label: t("technical") },
    { key: "communication" as const, label: t("communication") },
    { key: "confidence"    as const, label: t("confidence") },
    { key: "clarity"       as const, label: t("clarity") },
  ];

  const overall = scoreLabel(feedback.overall);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Overall score */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">{t("title")} — {role}</CardTitle>
            <button
              onClick={() => window.print()}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors print:hidden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
              {t("exportPdf")}
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-4xl font-bold text-primary">{feedback.overall.toFixed(1)}</span>
            <Badge variant={overall.variant} className="text-sm px-3 py-1">{overall.label}</Badge>
          </div>
          <Progress value={feedback.overall * 10} className="h-2" />
          <p className="text-sm text-muted-foreground leading-relaxed">{feedback.summary}</p>
        </CardContent>
      </Card>

      {/* Metrics breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Star className="w-4 h-4 text-primary" />
            {t("criteriaTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.map(({ key, label }) => {
            const score = feedback[key];
            const { label: lbl, variant } = scoreLabel(score);
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{score.toFixed(1)}/10</span>
                    <Badge variant={variant} className="text-xs">{lbl}</Badge>
                  </div>
                </div>
                <Progress value={score * 10} className="h-1.5" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <BehaviorHeatmap history={visionHistory} />

      {messages.length > 0 && <InterviewReplay messages={messages} interviewerName={interviewerName} />}

      {/* Strengths & improvements */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              {t("strengths")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span className="text-muted-foreground">{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" />
              {t("improvements")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {feedback.improvements.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span className="text-muted-foreground">{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
