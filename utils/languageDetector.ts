
import { LanguageInfo } from '../types';

export const LANGUAGES: LanguageInfo[] = [
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)', nativeName: '中文' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어' },
  { code: 'th-TH', name: 'Thai', nativeName: 'ไทย' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
];

export const detectLanguage = (text: string): LanguageInfo => {
  if (!text.trim()) return LANGUAGES.find(l => l.code === 'en-US')!;

  // Unicode Ranges
  const unicodeMap: { [key: string]: RegExp } = {
    'te-IN': /[\u0C00-\u0C7F]/, // Telugu
    'hi-IN': /[\u0900-\u097F]/, // Hindi / Marathi / Nepali
    'ta-IN': /[\u0B80-\u0BFF]/, // Tamil
    'kn-IN': /[\u0C80-\u0CFF]/, // Kannada
    'ml-IN': /[\u0D00-\u0D7F]/, // Malayalam
    'bn-IN': /[\u0980-\u09FF]/, // Bengali
    'gu-IN': /[\u0A80-\u0AFF]/, // Gujarati
    'pa-IN': /[\u0A00-\u0A7F]/, // Punjabi
    'ar-SA': /[\u0600-\u06FF]/, // Arabic
    'zh-CN': /[\u4E00-\u9FFF]/, // Chinese
    'ja-JP': /[\u3040-\u309F\u30A0-\u30FF]/, // Japanese (Hiragana/Katakana)
    'ko-KR': /[\uAC00-\uD7AF]/, // Korean (Hangul)
    'th-TH': /[\u0E00-\u0E7F]/, // Thai
  };

  for (const [code, regex] of Object.entries(unicodeMap)) {
    if (regex.test(text)) {
      const found = LANGUAGES.find(l => l.code === code);
      if (found) return found;
    }
  }

  // Fallback to English if no specific Unicode matches
  return LANGUAGES.find(l => l.code === 'en-US')!;
};
