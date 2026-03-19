import { useTranslations } from "next-intl";
import { Eye, Brain, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VisionSnapshot } from "@/types/interview";

interface BehaviorHeatmapProps {
  history: VisionSnapshot[];
}

function valueToColor(v: number, invert = false): string {
  const n = invert ? 1 - v : v;
  if (n < 0.5) {
    const t = n * 2;
    return `rgb(${Math.round(220 + (234 - 220) * t)},${Math.round(38 + (179 - 38) * t)},${Math.round(38 + (8 - 38) * t)})`;
  }
  const t = (n - 0.5) * 2;
  return `rgb(${Math.round(234 + (34 - 234) * t)},${Math.round(179 + (197 - 179) * t)},${Math.round(8 + (94 - 8) * t)})`;
}

function formatTime(snap: VisionSnapshot, first: VisionSnapshot): string {
  const diff = Math.round((snap.timestamp.getTime() - first.timestamp.getTime()) / 1000);
  const m = Math.floor(diff / 60).toString().padStart(2, "0");
  const s = (diff % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function BehaviorHeatmap({ history }: BehaviorHeatmapProps) {
  const t = useTranslations("heatmap");

  const METRICS = [
    { key: "eye_contact"  as const, label: t("eyeContact"), icon: <Eye   className="w-3.5 h-3.5" /> },
    { key: "confidence"   as const, label: t("confidence"), icon: <Zap   className="w-3.5 h-3.5" /> },
    { key: "stress_level" as const, label: t("stress"),     icon: <Brain className="w-3.5 h-3.5" />, invert: true },
  ];

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{t("noData")}</p>
        </CardContent>
      </Card>
    );
  }

  const MAX_COLS = 80;
  const step = Math.max(1, Math.floor(history.length / MAX_COLS));
  const samples = history.filter((_, i) => i % step === 0);
  const first = samples[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{t("title")}</CardTitle>
          <span className="text-xs text-muted-foreground">{t("samples", { count: samples.length })}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {METRICS.map(({ key, label, icon, invert }) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {icon}
              <span>{label}</span>
            </div>
            <div className="flex gap-px rounded overflow-hidden h-6" title={label}>
              {samples.map((snap, i) => {
                const val = snap.metrics[key] as number;
                return (
                  <div
                    key={i}
                    className="flex-1 min-w-0 cursor-default transition-opacity hover:opacity-75"
                    style={{ backgroundColor: valueToColor(val, invert) }}
                    title={`${formatTime(snap, first)} — ${(val * 100).toFixed(0)}%`}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">{t("start")}</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 rounded" style={{ background: "linear-gradient(to right, rgb(220,38,38), rgb(234,179,8), rgb(34,197,94))" }} />
            <span className="text-xs text-muted-foreground">{t("better")}</span>
          </div>
          <span className="text-xs text-muted-foreground">{t("end")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
