import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import fr_CA from './fr_CA.json';
import en_US from './en_US.json';

export const LOCALES = { fr_CA, en_US };

export const DEFAULT_LOCALE = 'en_US';

let current = DEFAULT_LOCALE;
const listeners = new Set();

export function getLocale() {
  return current;
}

export function getLocaleTag() {
  return current.replace('_', '-');
}

export function setLocale(locale) {
  const next = LOCALES[locale] ? locale : DEFAULT_LOCALE;
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l(current));
}

export function t(key, vars = {}) {
  const dict = LOCALES[current] || LOCALES[DEFAULT_LOCALE];
  let str = dict[key] ?? LOCALES[DEFAULT_LOCALE][key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.split(`{${k}}`).join(String(v));
  }
  return str;
}

const LocaleContext = createContext(DEFAULT_LOCALE);

export function LocaleProvider({ children }) {
  const [locale, setState] = useState(current);

  useEffect(() => {
    const fn = (l) => setState(l);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return useCallback((key, vars) => t(key, vars), [locale]);
}
