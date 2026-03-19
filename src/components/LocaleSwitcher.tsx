"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocaleSwitcherProps {
  className?: string;
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitch = (newLocale: "pt" | "en") => {
    if (newLocale === locale) return;
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className={cn("flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1", className)}>
      <Globe className="w-3.5 h-3.5 text-muted-foreground ml-1" />
      {(["pt", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => handleSwitch(l)}
          aria-pressed={locale === l}
          className={cn(
            "text-xs px-2.5 py-1 rounded-lg font-medium transition-all duration-150",
            locale === l
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l === "pt" ? "PT" : "EN"}
        </button>
      ))}
    </div>
  );
}
