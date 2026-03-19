"use client";

import { useReducer, useState } from "react";
import { z } from "zod";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Briefcase, User, ArrowRight, Loader2, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Types & schema ─────────────────────────────────────────────────────────────

type ExperienceLevel = "junior" | "mid" | "senior";
type SessionMode = "practice" | "full" | "intensive";

const schema = z.object({
  name:  z.string().trim().min(1),
  role:  z.string().trim().min(1),
  level: z.enum(["junior", "mid", "senior"]),
});

// ── Reducer ────────────────────────────────────────────────────────────────────

type State = {
  name:        string;
  role:        string;
  level:       ExperienceLevel;
  sessionMode: SessionMode;
  cvSummary:   string;
  loading:     boolean;
  error:       string | null;
};

type Action =
  | { type: "SET_NAME";         value: string }
  | { type: "SET_ROLE";         value: string }
  | { type: "SET_LEVEL";        value: ExperienceLevel }
  | { type: "SET_SESSION_MODE"; value: SessionMode }
  | { type: "SET_CV_SUMMARY";   value: string }
  | { type: "RESET_ROLE" }
  | { type: "START" }
  | { type: "VALIDATION_ERR"; message: string };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_NAME":         return { ...s, name: a.value, error: null };
    case "SET_ROLE":         return { ...s, role: a.value, error: null };
    case "SET_LEVEL":        return { ...s, level: a.value };
    case "SET_SESSION_MODE": return { ...s, sessionMode: a.value };
    case "SET_CV_SUMMARY":   return { ...s, cvSummary: a.value };
    case "RESET_ROLE":       return { ...s, role: "" };
    case "START":            return { ...s, loading: true, error: null };
    case "VALIDATION_ERR":   return { ...s, error: a.message };
  }
}

const initial: State = { name: "", role: "", level: "mid", sessionMode: "full", cvSummary: "", loading: false, error: null };

// ── Component ──────────────────────────────────────────────────────────────────

export function InterviewForm() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("interviewForm");
  const { user } = useAuth();

  const [state, dispatch] = useReducer(reducer, initial);
  const { name, role, level, sessionMode, cvSummary, loading, error } = state;
  const [cvOpen, setCvOpen] = useState(false);

  const handleLangSwitch = (newLocale: string) => {
    if (newLocale === locale) return;
    dispatch({ type: "RESET_ROLE" });
    router.replace(pathname, { locale: newLocale });
  };

  const handleStart = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    const result = schema.safeParse({ name, role, level });
    if (!result.success) {
      const field = result.error.issues[0]?.path[0];
      dispatch({
        type: "VALIDATION_ERR",
        message: field === "name" ? t("errors.nameRequired") : t("errors.roleRequired"),
      });
      return;
    }
    dispatch({ type: "START" });
    sessionStorage.setItem("candidateName",     result.data.name);
    sessionStorage.setItem("candidateRole",     result.data.role);
    sessionStorage.setItem("candidateLanguage", locale);
    sessionStorage.setItem("candidateLevel",    result.data.level);
    sessionStorage.setItem("sessionMode",       sessionMode);
    sessionStorage.setItem("cvSummary",         cvSummary);
    router.push("/interview");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleStart();
  };

  const roles = t.raw("roles") as string[];

  const levelOptions: { value: ExperienceLevel; label: string }[] = [
    { value: "junior", label: t("levelJunior") },
    { value: "mid",    label: t("levelMid") },
    { value: "senior", label: t("levelSenior") },
  ];

  return (
    <Card className="shadow-2xl border border-border/60 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

      <CardHeader className="pb-4 pt-7 px-7">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{t("title")}</CardTitle>
            <CardDescription className="text-sm mt-1">{t("subtitle")}</CardDescription>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
            <Globe className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            {(["pt", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => handleLangSwitch(l)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-lg font-medium transition-all duration-150",
                  locale === l
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {l === "pt" ? "PT-BR" : "EN"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-7 pb-7">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">{t("nameLabel")}</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="name"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => dispatch({ type: "SET_NAME", value: e.target.value })}
              className="pl-9 h-11 rounded-xl bg-background/60 border-border/60 focus-visible:border-primary/50 focus-visible:ring-primary/20"
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role" className="text-sm font-medium">{t("roleLabel")}</Label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="role"
              placeholder={t("rolePlaceholder")}
              value={role}
              onChange={(e) => dispatch({ type: "SET_ROLE", value: e.target.value })}
              className="pl-9 h-11 rounded-xl bg-background/60 border-border/60 focus-visible:border-primary/50 focus-visible:ring-primary/20"
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {roles.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => dispatch({ type: "SET_ROLE", value: suggestion })}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-all duration-150",
                  role === suggestion
                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground border-transparent hover:border-border/60"
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{t("levelLabel")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {levelOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => dispatch({ type: "SET_LEVEL", value: opt.value })}
                className={cn(
                  "py-2.5 rounded-xl border text-sm font-medium transition-all duration-150",
                  level === opt.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/60 hover:border-border"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{t("sessionModeLabel") || "Session"}</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "practice"  as SessionMode, label: t("sessionPractice")  || "Practice (5q)"  },
                { value: "full"      as SessionMode, label: t("sessionFull")       || "Full (10q)"     },
                { value: "intensive" as SessionMode, label: t("sessionIntensive")  || "Intensive (15q)"},
              ] as { value: SessionMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => dispatch({ type: "SET_SESSION_MODE", value: opt.value })}
                className={cn(
                  "py-2.5 rounded-xl border text-sm font-medium transition-all duration-150",
                  sessionMode === opt.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/60 hover:border-border"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setCvOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {cvOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {t("addCv") || "+ Add CV / Résumé"}
          </button>
          {cvOpen && (
            <textarea
              rows={5}
              placeholder={t("cvPlaceholder") || "Paste your CV text here (optional, max 4000 chars)…"}
              value={cvSummary}
              onChange={(e) => dispatch({ type: "SET_CV_SUMMARY", value: e.target.value.slice(0, 4000) })}
              className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none"
            />
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <Button
          onClick={handleStart}
          disabled={loading}
          className="w-full h-11 gap-2 rounded-xl text-sm font-semibold shadow-sm shadow-primary/20 transition-all duration-200"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("starting")}
            </>
          ) : (
            <>
              {t("startBtn")}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground/70">{t("footer")}</p>
      </CardContent>
    </Card>
  );
}
