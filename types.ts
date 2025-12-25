
export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
}

export type AppStatus = 'idle' | 'listening' | 'speaking' | 'error';

export interface Message {
  id: string;
  text: string;
  type: 'user' | 'system';
  lang: LanguageInfo;
  timestamp: number;
}
