"use client";

import { Bot, History, LogOut, LogIn, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export function HomeHeader() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const t = useTranslations("header");
  const tc = useTranslations("common");

  return (
    <header className="z-10 border-b border-border/50 bg-background/70 backdrop-blur-md sticky top-0">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
          <Bot className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm tracking-tight">{tc("brand")}</span>

        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitcher />
          {!loading && user && (
            <>
              <button
                onClick={() => router.push("/history")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="w-4 h-4" />
                {t("history")}
              </button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2">
                <User className="w-3.5 h-3.5" />
                <span>{user.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout().then(() => router.push("/login"))}
                className="gap-1.5 text-xs h-8"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("logout")}
              </Button>
            </>
          )}
          {!loading && !user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/login")}
              className="gap-1.5 text-xs h-8"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t("login")}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
