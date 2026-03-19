"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Mail, Loader2, Bot, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

const initial: ForgotPasswordState = { status: "idle" };

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const tc = useTranslations("common");
  const tAuth = useTranslations("auth");
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);

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
              <p className="text-sm text-muted-foreground">
                {t("sentMessage", { email: state.email ?? "" })}
              </p>
              <Button asChild variant="outline" className="w-full rounded-xl h-11">
                <Link href="/login">{t("backToLogin")}</Link>
              </Button>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("emailLabel")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={tAuth("emailPlaceholder")}
                    className="pl-9 h-11 rounded-xl"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {state.status === "error" && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                  {state.message}
                </p>
              )}

              <Button
                type="submit"
                disabled={pending}
                className="w-full h-11 rounded-xl font-semibold gap-2"
              >
                {pending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("sending")}</>
                  : t("submit")
                }
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="flex items-center justify-center gap-1 text-primary hover:underline">
                  <ArrowLeft className="w-3.5 h-3.5" /> {t("backToLogin")}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
