'use client';
/**
 * usePrefersReducedMotion: следит за системной настройкой «уменьшить движение».
 * Когда она включена, глитчи, печать текста и автоповорот 3D отключаются.
 * Используется `useSyncExternalStore`: без мигания и с корректным SSR.
 */
import { useSyncExternalStore } from 'react';

/** Медиазапрос настройки. */
const QUERY = '(prefers-reduced-motion: reduce)';

/** Подписка на изменения медиазапроса. */
function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** Текущее значение на клиенте. */
const getSnapshot = () => window.matchMedia(QUERY).matches;
/** На сервере считаем, что анимации разрешены. */
const getServerSnapshot = () => false;

/** @returns true, если пользователь попросил уменьшить движение. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
