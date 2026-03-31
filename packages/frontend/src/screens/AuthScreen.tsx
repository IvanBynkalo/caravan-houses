import React, { useEffect, useState } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { initTelegram, getTelegramInitData, getTelegramUser } from '../lib/telegram.js';
import { api }                          from '../lib/api.js';

export function AuthScreen() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Инициализация...');

  useEffect(() => {
    initTelegram();
    authenticate();
  }, []);

  async function authenticate() {
    try {
      setStatus('Авторизация...');

      const initData = getTelegramInitData();
      const tgUser   = getTelegramUser();

      // Dev-режим: если нет Telegram, используем тестовые данные
      const body = initData
        ? { initData }
        : { initData: `user=${JSON.stringify({ id: 1, first_name: 'Dev', username: 'dev' })}&hash=devhash` };

      const { token, userId, displayName } = await api.post<{
        token: string; userId: string; displayName: string;
      }>('/auth/telegram', body);

      localStorage.setItem('token',       token);
      localStorage.setItem('playerId',    userId);
      localStorage.setItem('displayName', displayName);

      navigate('/', { replace: true });
    } catch (e: any) {
      setError(e.message ?? 'Ошибка авторизации');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4">
      <div className="text-5xl">🏪</div>
      <h1 className="text-xl font-bold">Торговые Дома</h1>
      {error ? (
        <>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={authenticate}
            className="px-6 py-2 rounded-lg bg-blue-600 text-sm"
          >
            Повторить
          </button>
        </>
      ) : (
        <p className="text-gray-400 text-sm">{status}</p>
      )}
    </div>
  );
}
