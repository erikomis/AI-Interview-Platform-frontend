"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Camera, CameraOff, Eye, AlertCircle } from "lucide-react";
import { useWebcam } from "@/hooks/useWebcam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VisionMetrics } from "@/types/interview";

interface VideoPreviewProps {
  visionMetrics: VisionMetrics | null;
  onFrameCapture?: (frame: string) => void;
}

export function VideoPreview({ visionMetrics, onFrameCapture }: VideoPreviewProps) {
  const { videoRef, isActive, error, startCamera, stopCamera, captureFrame } = useWebcam();
  const t = useTranslations("video");

  useEffect(() => {
    if (!isActive || !onFrameCapture) return;
    const interval = setInterval(() => {
      const frame = captureFrame();
      if (frame) onFrameCapture(frame);
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive, onFrameCapture, captureFrame]);

  const metricColor = (value: number) => {
    if (value >= 0.7) return "text-emerald-500";
    if (value >= 0.4) return "text-amber-500";
    return "text-red-500";
  };

  const metricBar = (value: number) => {
    if (value >= 0.7) return "bg-emerald-500";
    if (value >= 0.4) return "bg-amber-500";
    return "bg-red-500";
  };

  const metrics = [
    { label: t("eyeContact"),  value: visionMetrics?.eye_contact ?? 0 },
    { label: t("confidence"),  value: visionMetrics?.confidence ?? 0 },
    { label: t("stressLevel"), value: visionMetrics ? 1 - visionMetrics.stress_level : 0 },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Video Feed */}
      <div className="relative rounded-xl overflow-hidden bg-muted aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />

        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/80">
            <CameraOff className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("cameraOff")}</p>
          </div>
        )}

        {isActive && (
          <div className="absolute top-2 left-2">
            <Badge variant="destructive" className="gap-1 text-xs">
              <span className="recording-dot w-1.5 h-1.5 rounded-full bg-white inline-block" />
              {t("live")}
            </Badge>
          </div>
        )}

        {error && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="bg-destructive/90 text-destructive-foreground text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Camera Toggle */}
      <Button
        variant={isActive ? "outline" : "default"}
        size="sm"
        onClick={isActive ? stopCamera : startCamera}
        className="w-full gap-2"
      >
        {isActive ? (
          <><CameraOff className="w-4 h-4" /> {t("disableCamera")}</>
        ) : (
          <><Camera className="w-4 h-4" /> {t("enableCamera")}</>
        )}
      </Button>

      {/* Vision Metrics */}
      {visionMetrics && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Eye className="w-4 h-4 text-primary" />
            {t("behavioralAnalysis")}
          </div>

          {metrics.map(({ label, value }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className={metricColor(value)}>{Math.round(value * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${metricBar(value)}`}
                  style={{ width: `${value * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
