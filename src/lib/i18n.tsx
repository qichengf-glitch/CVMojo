"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "zh";

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  // Pick the right string for the current UI language.
  t: (en: string, zh: string) => string;
}

const I18nContext = createContext<I18nValue>({
  lang: "en",
  setLang: () => {},
  toggle: () => {},
  t: (en) => en,
});

const STORAGE_KEY = "cvmojo_lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  // Default English on first render (matches SSR); a saved choice is applied
  // after mount so there is no hydration mismatch.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "zh") setLangState(saved);
    } catch {
      // ignore
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setLangState((cur) => {
      const next = cur === "en" ? "zh" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const t = useCallback((en: string, zh: string) => (lang === "zh" ? zh : en), [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, toggle, t }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
