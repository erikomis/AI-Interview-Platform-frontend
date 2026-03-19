import { Bot, Mic, Video, Brain, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { InterviewForm } from "@/components/interview-form";
import { HomeHeader } from "@/components/HomeHeader";

export default function Home() {
  const t = useTranslations("home");

  const features = [
    { icon: Bot,   key: "ai" as const },
    { icon: Mic,   key: "voice" as const },
    { icon: Video, key: "video" as const },
    { icon: Brain, key: "feedback" as const },
  ];

  const stats = ["questions", "language", "ai"] as const;

  return (
    <div className="relative min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Decorative blobs */}
      <div aria-hidden className="pointer-events-none fixed -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl" />
      <div aria-hidden className="pointer-events-none fixed -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/6 blur-3xl" />
      <div aria-hidden className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/3 blur-3xl" />

      {/* Header — client island for auth state */}
      <HomeHeader />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left: Hero */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-medium bg-primary/10 text-primary rounded-full px-3 py-1.5 ring-1 ring-primary/20">
                <Sparkles className="w-3 h-3" />
                {t("poweredBy")}
              </div>

              <h1 className="text-5xl font-extrabold tracking-tight leading-[1.1]">
                {t("heroTitle")}{" "}
                <span className="text-primary">{t("heroHighlight")}</span>
              </h1>

              <p className="text-muted-foreground text-base leading-relaxed max-w-md">
                {t("heroSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {features.map(({ icon: Icon, key }) => (
                <div
                  key={key}
                  className="group flex items-start gap-3 p-4 rounded-2xl bg-card/60 border border-border/60 hover:border-primary/30 hover:bg-card transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-semibold leading-tight">{t(`features.${key}.title`)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(`features.${key}.desc`)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 pt-2">
              {stats.map((key) => (
                <div key={key} className="text-center">
                  <p className="text-xl font-bold text-primary">{t(`stats.${key}.value`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`stats.${key}.label`)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form — client island */}
          <InterviewForm />
        </div>
      </main>
    </div>
  );
}
