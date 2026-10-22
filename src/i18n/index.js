import { en } from './translations/en.js';
import { ta } from './translations/ta.js';

export const translations = {
  en,
  ta,
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

export function translate(key, lang = 'en', fallback = '', params = {}) {
  let actualFallback = fallback;
  let actualParams = params;
  if (fallback && typeof fallback === 'object' && Object.keys(params).length === 0) {
    actualParams = fallback;
    actualFallback = '';
  }

  const currentDict = translations[lang] || translations.en;
  let text = (currentDict && currentDict[key]) || (translations.en && translations.en[key]) || actualFallback || key;

  if (actualParams && typeof actualParams === 'object') {
    for (const [k, v] of Object.entries(actualParams)) {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), v !== undefined && v !== null ? v : '');
    }
  }

  return text;
}

export default {
  translations,
  SUPPORTED_LANGUAGES,
  translate,
};
