import { create } from 'zustand';
import i18n from '../i18n';

type Language = 'zh' | 'en';

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: (localStorage.getItem('language') as Language) || 'zh',
  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    set({ language: lang });
  },
}));
