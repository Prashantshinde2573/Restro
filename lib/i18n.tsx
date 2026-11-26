"use client";

import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "mr" | "hi";

import { L, currentLang, dateLocale, dictLoaded, loadDict, setCurrentLang } from "./i18n-core";
export { L, currentLang, dateLocale };

const dict = {
  pulse: { en: "Pulse", mr: "आढावा", hi: "पल्स" },
  pos: { en: "New order", mr: "नवीन ऑर्डर", hi: "नया ऑर्डर" },
  orders: { en: "Orders", mr: "ऑर्डर्स", hi: "ऑर्डर" },
  tables: { en: "Tables", mr: "टेबल्स", hi: "टेबल" },
  kitchen: { en: "Kitchen", mr: "किचन", hi: "किचन" },
  menu: { en: "Menu", mr: "मेनू", hi: "मेन्यू" },
  inventory: { en: "Stock", mr: "स्टॉक", hi: "स्टॉक" },
  customers: { en: "Guests", mr: "ग्राहक", hi: "ग्राहक" },
  staff: { en: "Staff sales", mr: "स्टाफ विक्री", hi: "स्टाफ बिक्री" },
  access: { en: "Members & access", mr: "सदस्य आणि परवानग्या", hi: "सदस्य और एक्सेस" },
  payroll: { en: "Attendance & pay", mr: "हजेरी आणि पगार", hi: "हाज़िरी और वेतन" },
  attendance: { en: "My attendance", mr: "माझी हजेरी", hi: "मेरी हाज़िरी" },
  marketing: { en: "Campaigns", mr: "मोहिमा", hi: "कैंपेन" },
  insights: { en: "Insights", mr: "इनसाइट्स", hi: "इनसाइट्स" },
  reports: { en: "Reports", mr: "रिपोर्ट्स", hi: "रिपोर्ट" },
  activity: { en: "Activity", mr: "हालचाली", hi: "गतिविधि" },
  settings: { en: "Settings", mr: "सेटिंग्ज", hi: "सेटिंग्स" },
  help: { en: "Help center", mr: "मदत केंद्र", hi: "सहायता केंद्र" },
  whatsNew: { en: "What's new", mr: "नवीन काय", hi: "नया क्या है" },
  more: { en: "More", mr: "अधिक", hi: "और" },
  run: { en: "Run service", mr: "सर्व्हिस", hi: "सर्विस" },
  manage: { en: "Manage", mr: "व्यवस्थापन", hi: "मैनेज" },
  grow: { en: "Grow", mr: "वाढ", hi: "ग्रोथ" },
  search: { en: "Search dishes", mr: "डिश शोधा", hi: "डिश खोजें" },
  sendKitchen: { en: "Send to kitchen", mr: "किचनला पाठवा", hi: "किचन भेजें" },
  charge: { en: "Charge", mr: "बिल घ्या", hi: "बिल लें" },
} as const;

export type TKey = keyof typeof dict;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => dict[k].en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("restropi.lang") as Lang | null;
      if (saved === "en" || saved === "mr" || saved === "hi") setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("restropi.lang", l);
    } catch {}
  };

  const [dictReady, setDictReady] = useState(dictLoaded());
  useEffect(() => {
    if (lang !== "en" && !dictLoaded()) void loadDict().then(() => setDictReady(true));
  }, [lang]);

  setCurrentLang(lang);
  // a new language (or its texts arriving) redraws every screen once: texts are read with L() while drawing
  return (
    <Ctx.Provider value={{ lang, setLang, t: (k) => dict[k][lang] }}>
      <Fragment key={`${lang}${dictReady ? "+" : ""}`}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export const useT = () => useContext(Ctx);
