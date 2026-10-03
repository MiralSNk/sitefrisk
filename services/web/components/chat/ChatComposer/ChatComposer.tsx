'use client';
/**
 * ChatComposer: быстрые вопросы + поле ввода.
 * Заданные вопросы исчезают из подсказок. Пока модель занята, отправка
 * заблокирована, а набор текста остаётся доступным.
 * На телефонах подсказки прокручиваются горизонтально в одну строку.
 */
import { useState, type FormEvent } from 'react';
import styles from './ChatComposer.module.scss';

/** Пропсы. */
export interface ChatComposerProps {
  /** Быстрые вопросы. */
  suggestions: ReadonlyArray<string>;
  /** Модель занята. */
  busy: boolean;
  /** Отправка вопроса. */
  onSend: (question: string) => void;
  /** Плейсхолдер поля. */
  placeholder?: string;
}

export function ChatComposer({
  suggestions,
  busy,
  onSend,
  placeholder = 'спросите про уязвимости этого сайта…',
}: ChatComposerProps) {
  /** Текст в поле. */
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !value.trim()) return;
    onSend(value);
    setValue('');
  };

  return (
    <div className={styles.root}>
      {suggestions.length > 0 && (
        <div className={styles.suggestions} role="list" aria-label="Быстрые вопросы">
          {suggestions.map((question) => (
            <button
              key={question}
              type="button"
              role="listitem"
              className={styles.suggestion}
              disabled={busy}
              onClick={() => onSend(question)}
            >
              {question}
            </button>
          ))}
        </div>
      )}
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Вопрос модели"
          enterKeyHint="send"
        />
        <button type="submit" className={styles.send} disabled={busy || !value.trim()} aria-label="Отправить">
          →
        </button>
      </form>
    </div>
  );
}
