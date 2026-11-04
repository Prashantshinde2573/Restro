"use client";

// Help center: the help chat, full size.
import { HelpChat } from "@/components/help";
import { MANUALS } from "@/lib/help";
import { useT } from "@/lib/i18n";

export default function HelpPage() {
  const { lang } = useT();
  const m = MANUALS[lang];
  return (
    <div className="px-4 pb-24 pt-3 lg:px-10 lg:pb-10 lg:pt-10">
      <h1 className="large-title">{m.ui.helpCenter}</h1>
      <p className="mt-1 hidden text-[15px] text-muted sm:block">{m.subtitle}</p>
      <div className="mt-3 h-[calc(100dvh-210px)] min-h-[420px] max-w-3xl sm:mt-4 lg:h-[calc(100dvh-200px)]">
        <HelpChat full />
      </div>
    </div>
  );
}
