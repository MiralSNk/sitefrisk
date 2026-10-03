'use client';
/**
 * ScanForm: поле URL + кнопка скана с живой валидацией.
 *
 * - Подсказка под полем меняется по мере ввода (`validateTarget`).
 * - Домен без схемы принимается, https:// подставится сам.
 * - Кнопка может временно показать «глитч-надпись» (`labelOverride`).
 * - На телефонах кнопка встаёт под поле на всю ширину: удобно попадать пальцем.
 */
import { useId, useState, type FormEvent } from 'react';
import { HERO_COPY } from '@/lib/content/hero';
import { validateTarget } from '@/lib/utils/validateTarget';
import styles from './ScanForm.module.scss';

/** Пропсы формы. */
export interface ScanFormProps {
  /** Вызывается с нормализованным URL, если ввод корректен. */
  onSubmit: (target: string) => void;
  /** Временная подмена текста кнопки (глитч). null = обычный текст. */
  labelOverride?: string | null;
  /** Текст кнопки. */
  label?: string;
  /** Плейсхолдер поля. */
  placeholder?: string;
  /** Внешняя ошибка (например, бэкенд отказал). */
  error?: string | null;
}

export function ScanForm({
  onSubmit,
  labelOverride = null,
  label = HERO_COPY.ctaLabel,
  placeholder = HERO_COPY.inputPlaceholder,
  error = null,
}: ScanFormProps) {
  /** Значение поля. */
  const [value, setValue] = useState('');
  /** Пробовал ли пользователь отправить форму (показываем ошибку только после этого). */
  const [attempted, setAttempted] = useState(false);
  /** id подсказки для aria-describedby. */
  const hintId = useId();
  /** Результат валидации текущего ввода. */
  const validation = validateTarget(value);
  /** Можно ли запускать скан. */
  const canSubmit = validation.normalized !== null;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAttempted(true);
    if (validation.normalized) onSubmit(validation.normalized);
  };

  /** Тон подсказки: ok / предупреждение / нейтрально. */
  const hintTone = error ? 'rose' : canSubmit ? 'cyan' : validation.status === 'invalid' && attempted ? 'sand' : 'muted';

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field} data-invalid={(validation.status === 'invalid' && attempted) || undefined}>
        <input
          className={styles.input}
          type="url"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={HERO_COPY.inputAriaLabel}
          aria-describedby={hintId}
          aria-invalid={validation.status === 'invalid' && attempted}
        />
        <button type="submit" className={styles.button} data-glitching={labelOverride ? true : undefined}>
          {labelOverride ?? (
            <>
              {label} <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </div>
      <p id={hintId} className={styles.hint} data-tone={hintTone} aria-live="polite">
        {error ?? validation.message}
      </p>
    </form>
  );
}
