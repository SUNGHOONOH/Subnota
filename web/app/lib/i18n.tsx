'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'ko' | 'en';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('ko');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('subnota-language');
    if (stored === 'ko' || stored === 'en') setLanguage(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem('subnota-language', language);
    document.documentElement.lang = language;
  }, [hydrated, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}

export function useText() {
  const { language } = useLanguage();
  return (korean: string, english: string) => (language === 'en' ? english : korean);
}
