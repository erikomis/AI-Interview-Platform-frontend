"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trophy, BarChart2, Clock, Globe, Layers, Loader2, AlertCircle, RotateCcw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HistoryNav } from "@/components/HistoryNav";
import { Link } from "@/i18n/navigation";
import { interviewApi } from "@/services/api";
import { HttpError } from "@/services/auth";
import type { HistoryInterview, UserHistory, AnalyticsData, AnalyticsSession } from "@/types/interview";

const SCORE_COLOR = (n: number) =>
  n >= 8 ? "text-emerald-400" : n >= 6 ? "text-amber-400" : "text-red-400";

type LegendLabels = { overall: string; technical: string; communication: string };

function ProgressChart({ sessions, legend }: { sessions: AnalyticsSession[]; legend: LegendLabels }) {
  if (sessions.length < 2) return null;
  const W = 500;
  const H = 160;
  const PAD = { top: 16, right: 24, bottom: 24, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xPos = (i: number) => PAD.left + (i / (sessions.length - 1)) * innerW;
  const yPos = (v: number | null) => PAD.top + innerH - ((v ?? 0) / 10) * innerH;

  const line = (key: keyof AnalyticsSession) =>
    sessions
      .map((s, i) => {
        const v = s[key] as number | null;
        if (v === null) return null;
        return `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");

  const dots = (key: keyof AnalyticsSession, fill: string) =>
    sessions.map((s, i) => {
      const v = s[key] as number | null;
      if (v === null) return null;
      return (
        <circle
          key={i}
          cx={xPos(i).toFixed(1)}
          cy={yPos(v).toFixed(1)}
          r="3"
          fill={fill}
        />
      );
    });

  const lastIdx = sessions.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Y axis grid lines */}
      {[0, 5, 10].map((v) => (
        <line
          key={v}
          x1={PAD.left} y1={yPos(v)}
          x2={W - PAD.right} y2={yPos(v)}
          stroke="#1e293b" strokeWidth="1"
        />
      ))}
      {/* Y labels */}
      {[0, 5, 10].map((v) => (
        <text key={v} x={PAD.left - 4} y={yPos(v) + 4} textAnchor="end" fontSize="9" fill="#64748b">{v}</text>
      ))}
      {/* X labels */}
      {sessions.map((s, i) => (
        <text key={i} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#64748b">{s.index}</text>
      ))}

      {/* Lines */}
      <path d={line("technical")}     fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={line("communication")} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={line("overall")}       fill="none" stroke="#a78bfa" strokeWidth="2"   strokeLinejoin="round" />

      {/* Dots */}
      {dots("technical",     "#60a5fa")}
      {dots("communication", "#34d399")}
      {dots("overall",       "#a78bfa")}

      {/* Last value label for overall */}
      {sessions[lastIdx].overall !== null && (
        <text
          x={xPos(lastIdx) + 5}
          y={yPos(sessions[lastIdx].overall!) - 4}
          fontSize="10"
          fill="#a78bfa"
          fontWeight="600"
        >
          {sessions[lastIdx].overall!.toFixed(1)}
        </text>
      )}

      {/* Legend */}
      <circle cx={PAD.left}      cy={PAD.top - 4} r="3" fill="#a78bfa" />
      <text x={PAD.left + 6}     y={PAD.top}      fontSize="9" fill="#a78bfa">{legend.overall}</text>
      <circle cx={PAD.left + 52} cy={PAD.top - 4} r="3" fill="#60a5fa" />
      <text x={PAD.left + 58}    y={PAD.top}      fontSize="9" fill="#60a5fa">{legend.technical}</text>
      <circle cx={PAD.left + 114} cy={PAD.top - 4} r="3" fill="#34d399" />
      <text x={PAD.left + 120}   y={PAD.top}      fontSize="9" fill="#34d399">{legend.communication}</text>
    </svg>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-lg font-bold ${SCORE_COLOR(value)}`}>{value.toFixed(1)}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

type Labels = {
  levelJunior: string; levelMid: string; levelSenior: string;
  langPt: string; langEn: string;
  interviewerMale: string; interviewerFemale: string;
  strengths: string; improvements: string; notCompleted: string;
  technical: string; communication: string; confidence: string; clarity: string;
};

function InterviewCard({ item, locale, labels }: { item: HistoryInterview; locale: string; labels: Labels }) {
  const dateLocale = locale === "pt" ? "pt-BR" : "en-US";
  const date = new Date(item.createdAt).toLocaleDateString(dateLocale, {
    day: "2-digit", month: "short", year: "numeric",
  });
  const levelMap: Record<string, string> = {
    junior: labels.levelJunior,
    mid: labels.levelMid,
    senior: labels.levelSenior,
  };

  return (
    <Card className="border border-border/60 bg-card/80 rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-semibold text-sm">{item.role}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs gap-1">
                <Layers className="w-3 h-3" />{levelMap[item.experienceLevel] ?? item.experienceLevel}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Globe className="w-3 h-3" />{item.language === "en" ? labels.langEn : labels.langPt}
              </Badge>
              {item.interviewer && (
                <Badge variant="outline" className="text-xs gap-1">
                  <UserRound className="w-3 h-3" />
                  {item.interviewer === "female" ? labels.interviewerFemale : labels.interviewerMale}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />{date}
              </span>
            </div>
          </div>
          {item.overall !== null && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className={`text-xl font-bold ${SCORE_COLOR(item.overall)}`}>{item.overall.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">/10</span>
            </div>
          )}
        </div>

        {item.overall !== null && (
          <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/30 px-4 py-3">
            <ScoreBadge label={labels.technical}     value={item.technical} />
            <ScoreBadge label={labels.communication} value={item.communication} />
            <ScoreBadge label={labels.confidence}    value={item.confidence} />
            <ScoreBadge label={labels.clarity}       value={item.clarity} />
          </div>
        )}

        {item.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3">
            {item.summary}
          </p>
        )}

        {(item.strengths?.length || item.improvements?.length) ? (
          <div className="grid grid-cols-2 gap-3 text-xs">
            {item.strengths && item.strengths.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-emerald-400">{labels.strengths}</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {item.strengths.map((s, i) => <li key={i}>· {s}</li>)}
                </ul>
              </div>
            )}
            {item.improvements && item.improvements.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-amber-400">{labels.improvements}</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {item.improvements.map((s, i) => <li key={i}>· {s}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {item.status !== "completed" && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {labels.notCompleted}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: UserHistory; analytics: AnalyticsData | null };

export default function HistoryPage() {
  const locale = useLocale();
  const t = useTranslations("historyPage");
  const tFeedback = useTranslations("feedback");
  const tc = useTranslations("common");
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  // Fetched client-side: the refresh_token cookie is scoped to /auth, so only the
  // browser can refresh an expired access token (apiFetch does it, single-flight).
  const fetchData = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      const [data, analytics] = await Promise.all([
        interviewApi.history(),
        interviewApi.analytics().catch((err) => {
          if (err instanceof HttpError && err.status === 401) throw err;
          return null; // analytics are optional
        }),
      ]);
      setLoad({ status: "ready", data, analytics });
    } catch (err) {
      // 401 → apiFetch already redirected to the (locale-aware) login page
      if (err instanceof HttpError && err.status === 401) return;
      setLoad({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (load.status !== "ready") {
    return (
      <div className="min-h-screen bg-background">
        <HistoryNav />
        <main className="max-w-3xl mx-auto px-4 py-8">
          {load.status === "loading" ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card className="border border-border/60 rounded-2xl">
              <CardContent className="py-12 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
                <p className="text-sm text-muted-foreground">{t("loadError")}</p>
                <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => void fetchData()}>
                  <RotateCcw className="w-4 h-4" />
                  {t("retry")}
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    );
  }

  const { data, analytics } = load;
  const { interviews, user } = data;
  const completed = interviews.filter((i: HistoryInterview) => i.status === "completed");
  const avgOverall = completed.length
    ? completed.reduce((s: number, i: HistoryInterview) => s + (i.overall ?? 0), 0) / completed.length
    : null;

  const labels: Labels = {
    levelJunior: t("levelJunior"), levelMid: t("levelMid"), levelSenior: t("levelSenior"),
    langPt: t("langPt"), langEn: t("langEn"),
    interviewerMale: t("interviewerWith", { name: tc("interviewerMaleName") }),
    interviewerFemale: t("interviewerWith", { name: tc("interviewerFemaleName") }),
    strengths: t("strengths"), improvements: t("improvements"), notCompleted: t("notCompleted"),
    technical: tFeedback("technical"), communication: tFeedback("communication"),
    confidence: tFeedback("confidence"), clarity: tFeedback("clarity"),
  };

  const legend: LegendLabels = {
    overall: t("legendOverall"),
    technical: t("legendTechnical"),
    communication: t("legendCommunication"),
  };

  return (
    <div className="min-h-screen bg-background">
      <HistoryNav />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {interviews.length === 0 && (
          <Card className="border border-border/60 rounded-2xl">
            <CardContent className="py-12 text-center space-y-2">
              <BarChart2 className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">{t("noInterviews")}</p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/">{t("startNow")}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {interviews.length > 0 && (
          <>
            <Card className="border border-border/60 bg-card/80 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {user?.name}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {t("completedCount", { count: completed.length })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {avgOverall !== null && (
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-muted-foreground">{t("averageScore")}</span>
                    <span className={`font-bold ${SCORE_COLOR(avgOverall)}`}>{avgOverall.toFixed(1)}/10</span>
                  </div>
                )}
                {analytics?.averages && (
                  <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/30 px-4 py-3">
                    <ScoreBadge label={labels.technical}     value={analytics.averages.technical} />
                    <ScoreBadge label={labels.communication} value={analytics.averages.communication} />
                    <ScoreBadge label={labels.confidence}    value={analytics.averages.confidence} />
                    <ScoreBadge label={labels.clarity}       value={analytics.averages.clarity} />
                  </div>
                )}
              </CardContent>
            </Card>

            {analytics?.hasData && analytics.sessions.length >= 2 && (
              <Card className="border border-border/60 bg-card/80 rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-primary" />
                    {t("progress")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <ProgressChart sessions={analytics.sessions} legend={legend} />
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {interviews.map((item: HistoryInterview) => (
                <InterviewCard key={item.id} item={item} locale={locale} labels={labels} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
