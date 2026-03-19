"use client";

import { useReducer } from "react";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Eye, EyeOff, Loader2, Bot, Lock, Mail, User, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/services/auth";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

// ── Zod schemas ────────────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8)
  .refine((p) => /[A-Z]/.test(p), "uppercase")
  .refine((p) => /[a-z]/.test(p), "lowercase")
  .refine((p) => /\d/.test(p), "digit")
  .refine((p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p), "special");

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
});

// ── Reducer ────────────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "error" | "registered" | "resending" | "resent";

type State = {
  name: string;
  email: string;
  password: string;
  showPassword: boolean;
  showRules: boolean;
  status: Status;
  error: string | null;
};

type Action =
  | { type: "SET_FIELD"; field: "name" | "email" | "password"; value: string }
  | { type: "TOGGLE_PASSWORD" }
  | { type: "SHOW_RULES" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_OK" }
  | { type: "SUBMIT_ERR"; message: string }
  | { type: "RESEND_START" }
  | { type: "RESEND_OK" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_FIELD":       return { ...s, [a.field]: a.value };
    case "TOGGLE_PASSWORD": return { ...s, showPassword: !s.showPassword };
    case "SHOW_RULES":      return { ...s, showRules: true };
    case "SUBMIT_START":    return { ...s, status: "loading", error: null };
    case "SUBMIT_OK":       return { ...s, status: "registered" };
    case "SUBMIT_ERR":      return { ...s, status: "error", error: a.message };
    case "RESEND_START":    return { ...s, status: "resending" };
    case "RESEND_OK":       return { ...s, status: "resent" };
  }
}

const initial: State = {
  name: "", email: "", password: "",
  showPassword: false, showRules: false,
  status: "idle", error: null,
};

// ── Component ──────────────────────────────────────────────────────────────────

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, register } = useAuth();
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  const [state, dispatch] = useReducer(reducer, initial);
  const { name, email, password, showPassword, showRules, status, error } = state;

  const isRegister = mode === "register";
  const loading = status === "loading";

  const passwordRules = [
    { test: (p: string) => p.length >= 8,                                          label: t("passwordRules.minChars") },
    { test: (p: string) => /[A-Z]/.test(p),                                        label: t("passwordRules.uppercase") },
    { test: (p: string) => /[a-z]/.test(p),                                        label: t("passwordRules.lowercase") },
    { test: (p: string) => /\d/.test(p),                                            label: t("passwordRules.number") },
    { test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),         label: t("passwordRules.special") },
  ];

  const passwordStrength = passwordRules.filter((r) => r.test(password)).length;
  const strengthColor =
    passwordStrength <= 2 ? "bg-red-500" :
    passwordStrength <= 3 ? "bg-amber-500" :
    passwordStrength <= 4 ? "bg-yellow-400" : "bg-emerald-500";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    const schema = isRegister ? registerSchema : loginSchema;
    const result = schema.safeParse({ name, email, password });

    if (!result.success) {
      const field = result.error.issues[0]?.path[0];
      const msg =
        field === "email"    ? t("errors.emailInvalid") :
        field === "name"     ? t("errors.nameTooShort") :
                               t("errors.passwordWeak");
      dispatch({ type: "SUBMIT_ERR", message: msg });
      return;
    }

    dispatch({ type: "SUBMIT_START" });
    try {
      if (isRegister) {
        await register(name.trim(), email.trim().toLowerCase(), password);
        dispatch({ type: "SUBMIT_OK" });
      } else {
        await login(email.trim().toLowerCase(), password);
        router.replace("/");
      }
    } catch (err) {
      dispatch({ type: "SUBMIT_ERR", message: (err as Error).message });
    }
  };

  const handleResend = async () => {
    if (status === "resending" || status === "resent") return;
    dispatch({ type: "RESEND_START" });
    try {
      await authApi.resendVerification();
      dispatch({ type: "RESEND_OK" });
    } catch {
      dispatch({ type: "RESEND_OK" }); // silent — show resent anyway
    }
  };

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
          <CardTitle className="text-2xl font-bold">
            {isRegister ? t("titleRegister") : t("titleLogin")}
          </CardTitle>
          <CardDescription>
            {isRegister ? t("subtitleRegister") : t("subtitleLogin")}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          {status === "registered" ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <MailCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{t("verifyTitle")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("verifySent")} <strong>{email}</strong>.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={state.status === "resending" || state.status === "resent"}
                className="text-xs"
              >
                {state.status === "resending"
                  ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />{t("verifyResending")}</>
                  : state.status === "resent" ? t("verifyResent") : t("verifyResend")}
              </Button>
              <Button asChild variant="outline" className="w-full rounded-xl h-11">
                <Link href="/">{t("verifyContinue")}</Link>
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{t("nameLabel")}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder={t("namePlaceholder")}
                        value={name}
                        onChange={(e) => dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })}
                        className="pl-9 h-11 rounded-xl"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("emailLabel")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(e) => dispatch({ type: "SET_FIELD", field: "email", value: e.target.value })}
                      className="pl-9 h-11 rounded-xl"
                      autoComplete={isRegister ? "email" : "username"}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("passwordLabel")}</Label>
                    {!isRegister && (
                      <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                        {t("forgotPassword")}
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={isRegister ? t("passwordPlaceholderNew") : t("passwordPlaceholderExisting")}
                      value={password}
                      onChange={(e) => dispatch({ type: "SET_FIELD", field: "password", value: e.target.value })}
                      onFocus={() => isRegister && dispatch({ type: "SHOW_RULES" })}
                      className="pl-9 pr-10 h-11 rounded-xl"
                      autoComplete={isRegister ? "new-password" : "current-password"}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "TOGGLE_PASSWORD" })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {isRegister && password.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                          style={{ width: `${(passwordStrength / passwordRules.length) * 100}%` }}
                        />
                      </div>
                      {showRules && (
                        <ul className="space-y-0.5">
                          {passwordRules.map((rule) => (
                            <li
                              key={rule.label}
                              className={`text-xs flex items-center gap-1.5 transition-colors ${
                                rule.test(password) ? "text-emerald-400" : "text-muted-foreground"
                              }`}
                            >
                              <span>{rule.test(password) ? "✓" : "·"}</span>
                              {rule.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl font-semibold gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {isRegister ? t("loadingRegister") : t("loadingLogin")}</>
                  ) : (
                    isRegister ? t("submitRegister") : t("submitLogin")
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-5">
                {isRegister ? (
                  <>{t("haveAccount")}{" "}
                    <Link href="/login" className="text-primary font-medium hover:underline">{t("signIn")}</Link>
                  </>
                ) : (
                  <>{t("noAccount")}{" "}
                    <Link href="/register" className="text-primary font-medium hover:underline">{t("createOne")}</Link>
                  </>
                )}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
