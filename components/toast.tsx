"use client";

import { CheckCircle2 } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  const show = useCallback((m: string) => {
    setMsg(m);
    setKey((k) => k + 1);
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4 lg:top-auto lg:bottom-6">
        {msg && (
          <div key={key} className="flex animate-pop items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-canvas shadow-float">
            <CheckCircle2 size={17} className="text-jade-soft" />
            {msg}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
