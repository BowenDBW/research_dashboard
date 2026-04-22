import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

const resources = {
  en: { translation: en },
  zh: { translation: zh },
};

// Get saved language from localStorage or use browser language
const getSavedLanguage = (): string => {
  const saved = localStorage.getItem('language');
  if (saved && (saved === 'en' || saved === 'zh')) {
    return saved;
  }
  // Default to Chinese for this app
  return 'zh';
};

i18n.use(initReactI18next).init({
  resources,
  lng: getSavedLanguage(),
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
