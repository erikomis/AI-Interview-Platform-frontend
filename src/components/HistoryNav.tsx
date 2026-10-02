"use client";

import { Bot, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function HistoryNav() {
  const router = useRouter();
  const t = useTranslations("historyNav");

  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">{t("title")}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> {t("home")}
        </Button>
      </div>
    </header>
  );
}
