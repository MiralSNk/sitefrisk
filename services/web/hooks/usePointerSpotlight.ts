'use client';
/**
 * usePointerSpotlight: следит за курсором и пишет его координаты
 * в CSS-переменные `--spot-x` / `--spot-y` элемента.
 *
 * Пишет напрямую в style, без setState, поэтому React не перерисовывает
 * компонент на каждое движение мыши. На тач-устройствах ничего не делает.
 */
import { useEffect, useRef, type RefObject } from 'react';

/** @returns ref, который нужно повесить на элемент-контейнер */
export function usePointerSpotlight<T extends HTMLElement>(): RefObject<T | null> {
  /** Ссылка на DOM-элемент. */
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    /** id кадра: обновляем не чаще одного раза за кадр. */
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--spot-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        el.style.setProperty('--spot-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      });
    };
    el.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
    };
  }, []);

  return ref;
}
