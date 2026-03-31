// Telegram Web App SDK wrapper
// Библиотека @twa-dev/sdk подключается через npm, но в dev-режиме можно работать без неё

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready:        () => void;
        expand:       () => void;
        enableClosingConfirmation: () => void;
        initData:     string;
        initDataUnsafe: {
          user?: {
            id:         number;
            first_name: string;
            last_name?: string;
            username?:  string;
          };
        };
        colorScheme: 'light' | 'dark';
      };
    };
  }
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp ?? null;
}

export function initTelegram() {
  const tg = getTelegramWebApp();
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.enableClosingConfirmation();
}

export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData ?? '';
}

export function getTelegramUser() {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null;
}

export function isDarkMode(): boolean {
  return getTelegramWebApp()?.colorScheme === 'dark' ?? true;
}
