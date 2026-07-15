import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ro from './ro.json';

const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';

// eslint-disable-next-line import/no-named-as-default-member -- i18next's documented init pattern
i18n.use(initReactI18next).init({
  resources: {
    ro: { translation: ro },
    en: { translation: en },
  },
  lng: deviceLanguage === 'ro' ? 'ro' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
