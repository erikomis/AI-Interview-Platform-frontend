"use client";

import { useActionState, useReducer } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Lock, Eye, EyeOff, Loader2, Bot, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { resetPasswordAction, type ResetPasswordState } from "./actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

const initial: ResetPasswordState = { status: "idle" };

type UIState = { password: string; showPassword: boolean };
type UIAction = { type: "SET_PASSWORD"; value: string } | { type: "TOGGLE_SHOW" };

function uiReducer(s: UIState, a: UIAction): UIState {
  switch (a.type) {
    case "SET_PASSWORD": return { ...s, password: a.value };
    case "TOGGLE_SHOW":  return { ...s, showPassword: !s.showPassword };
  }
}

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const tc = useTranslations("common");
  const tAuth = useTranslations("auth");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [{ password, showPassword }, uiDispatch] = useReducer(uiReducer, { password: "", showPassword: false });
  const [state, action, pending] = useActionState(resetPasswordAction, initial);

  const passwordRules = [
    { test: (p: string) => p.length >= 8,                                                         label: tAuth("passwordRules.minChars") },
    { test: (p: string) => /[A-Z]/.test(p),                                                       label: tAuth("passwordRules.uppercase") },
    { test: (p: string) => /[a-z]/.test(p),                                                       label: tAuth("passwordRules.lowercase") },
    { test: (p: string) => /\d/.test(p),                                                           label: tAuth("passwordRules.number") },
    { test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),                        label: tAuth("passwordRules.special") },
  ];

  const strength = passwordRules.filter((r) => r.test(password)).length;
  const strengthColor =
    strength <= 2 ? "bg-red-500" :
    strength <= 3 ? "bg-amber-500" :
    strength <= 4 ? "bg-yellow-400" : "bg-emerald-500";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div aria-hidden className="pointer-events-none fixed -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl" />
      <div aria-hidden className="pointer-events-none fixed -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/6 blur-3xl" />

      <Card className="w-full max-w-md shadow-2xl border border-border/60 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <CardHeader className="pt-8 pb-4 px-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg tracking-tight">{tc("brand")}</span>
            </div>
            <LocaleSwitcher />
          </div>
          <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          {state.status === "success" ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground">{t("doneMessage")}</p>
              <Button asChild className="w-full rounded-xl h-11">
                <Link href="/login">{t("signIn")}</Link>
              </Button>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              <input type="hidden" name="token" value={token} />

              <div className="space-y-1.5">
                <Label htmlFor="password">{t("passwordLabel")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={tAuth("passwordPlaceholderNew")}
                    value={password}
                    onChange={(e) => uiDispatch({ type: "SET_PASSWORD", value: e.target.value })}
                    className="pl-9 pr-10 h-11 rounded-xl"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => uiDispatch({ type: "TOGGLE_SHOW" })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                        style={{ width: `${(strength / passwordRules.length) * 100}%` }}
                      />
                    </div>
                    <ul className="space-y-0.5">
                      {passwordRules.map((rule) => (
                        <li
                          key={rule.label}
                          className={`text-xs flex items-center gap-1.5 ${rule.test(password) ? "text-emerald-400" : "text-muted-foreground"}`}
                        >
                          <span>{rule.test(password) ? "✓" : "·"}</span>
                          {rule.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {state.status === "error" && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                  {state.message}
                </p>
              )}

              <Button
                type="submit"
                disabled={pending || strength < passwordRules.length}
                className="w-full h-11 rounded-xl font-semibold gap-2"
              >
                {pending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("updating")}</>
                  : t("submit")
                }
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
