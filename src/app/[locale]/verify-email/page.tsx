import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, XCircle, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const t = await getTranslations("verifyEmail");
  const tc = await getTranslations("common");

  let success = false;

  if (token) {
    try {
      // Use server-side URL (resolves correctly inside Docker via service name)
      const backendUrl =
        process.env.BACKEND_URL ??
        process.env.NEXT_PUBLIC_BACKEND_URL ??
        'http://localhost:3000';
      const res = await fetch(
        `${backendUrl}/auth/verify-email?token=${encodeURIComponent(token)}`,
      );
      success = res.ok;
    } catch {
      success = false;
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div aria-hidden className="pointer-events-none fixed -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl" />

      <Card className="w-full max-w-md shadow-2xl border border-border/60 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <div className={`h-1 w-full ${success ? "bg-emerald-500" : "bg-destructive"}`} />
        <CardContent className="px-8 py-10 text-center space-y-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${success ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
            {success
              ? <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              : <XCircle className="w-7 h-7 text-destructive" />
            }
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm">{tc("brand")}</span>
            </div>
            <LocaleSwitcher />
          </div>

          <div>
            <h1 className="text-xl font-bold mb-1">
              {success ? t("successTitle") : t("failTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {success ? t("successMessage") : t("failMessage")}
            </p>
          </div>

          <Button asChild className="w-full rounded-xl h-11">
            <Link href={success ? "/login" : "/"}>
              {success ? t("signIn") : t("goHome")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
