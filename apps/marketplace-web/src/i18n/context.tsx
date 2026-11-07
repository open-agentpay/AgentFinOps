'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { SupportedLocale, Translations } from './types';
import { zh } from './locales/zh';

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: Translations;
}

const translationsMap: Record<SupportedLocale, Translations> = {
  zh,
};

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: zh,
});

export function I18nProvider({
  children,
  initialLocale = 'zh',
}: {
  children: React.ReactNode;
  initialLocale?: SupportedLocale;
}) {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  useEffect(() => {
    try {
      setLocaleState('zh');
      document.documentElement.lang = 'zh-CN';
      localStorage.setItem('NEXT_LOCALE', 'zh');
    } catch {
      // Ignore in non-browser environments
    }
  }, []);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState('zh');
    try {
      localStorage.setItem('NEXT_LOCALE', 'zh');
      document.cookie = `NEXT_LOCALE=zh; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = 'zh-CN';
    } catch {
      // Ignore
    }
  }, []);

  const value = {
    locale,
    setLocale,
    t: zh,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
