import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { enUS } from "./en-US";
import { zhCN } from "./zh-CN";

export type Locale = "zh-CN" | "en-US";

const STORAGE_KEY = "grammar-station-locale";

const catalogs: Record<Locale, Record<string, string>> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{{${name}}}`
  );
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  enumLabel: (prefix: string, value: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en-US" || v === "zh-CN") return v;
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  if (nav.toLowerCase().startsWith("zh")) return "zh-CN";
  return "zh-CN";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const table = catalogs[locale];
      const fallback = locale === "zh-CN" ? enUS : zhCN;
      const raw = table[key] ?? fallback[key] ?? key;
      return interpolate(raw, vars);
    },
    [locale]
  );

  const enumLabel = useCallback(
    (prefix: string, value: string) => {
      const key = `${prefix}.${value}`;
      return t(key);
    },
    [t]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, enumLabel }),
    [locale, setLocale, t, enumLabel]
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${t("app.title")} ${t("app.subtitle")}`.trim();
  }, [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
