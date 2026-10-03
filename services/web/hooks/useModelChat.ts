'use client';
/**
 * useModelChat: состояние диалога с моделью по результатам скана.
 *
 * Отвечает за:
 *  - приветствие после скана;
 *  - отправку вопроса и показ «размышлений» по шагам;
 *  - потоковую «печать» ответа (по CHARS_PER_TICK символов);
 *  - подсветку находки, о которой идёт речь;
 *  - список ещё не заданных быстрых вопросов.
 *
 * С реальным стримингом модели (SSE/WebSocket) можно убрать имитацию печати
 * и дописывать `revealedChars` по мере прихода токенов.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ERROR_ANSWER } from '@/lib/chat/answerRules';
import type { ChatAnswer, ChatBlock, ChatContext, ChatProvider } from '@/lib/chat/types';
import type { ScanReport } from '@/lib/scan/types';

/** Сообщение в ленте. */
export interface ChatMessage {
  /** Уникальный id. */
  readonly id: string;
  /** Автор. */
  readonly role: 'user' | 'model';
  /** Содержимое. */
  readonly blocks: ReadonlyArray<ChatBlock>;
  /** К какой находке относится. */
  readonly relatedFindingId: string | null;
  /** Сколько символов уже «напечатано». */
  readonly revealedChars: number;
  /** Сколько символов всего. */
  readonly totalChars: number;
}

/** Состояние «модель думает». */
export interface ThinkingState {
  /** Все шаги плана. */
  readonly steps: ReadonlyArray<string>;
  /** Сколько шагов уже показано. */
  readonly visibleCount: number;
}

/** Публичный API чата. */
export interface ModelChat {
  /** Лента сообщений. */
  readonly messages: ReadonlyArray<ChatMessage>;
  /** Состояние размышления (null, если модель не думает). */
  readonly thinking: ThinkingState | null;
  /** Модель занята (думает или печатает): ввод заблокирован. */
  readonly busy: boolean;
  /** Находка в фокусе разговора. */
  readonly activeFindingId: string | null;
  /** Быстрые вопросы, которые ещё не задавали. */
  readonly suggestions: ReadonlyArray<string>;
  /** Отправить вопрос. */
  send(question: string): void;
}

/** Шаг таймера печати, мс. */
const TYPE_TICK_MS = 16;
/** Сколько символов добавлять за шаг. */
const CHARS_PER_TICK = 4;
/** Интервал между шагами размышления, мс. */
const THINK_STEP_MS = 450;
/** Минимальная длительность «размышления», мс (чтобы шаги успели показаться). */
const MIN_THINK_MS = 1400;
/** Задержка приветствия после завершения скана, мс. */
const GREETING_DELAY_MS = 900;

/** Длина всех блоков ответа в символах. */
const countChars = (blocks: ReadonlyArray<ChatBlock>) => blocks.reduce((sum, b) => sum + b.text.length, 0);
/** Промис-задержка. */
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useModelChat(provider: ChatProvider, report: ScanReport): ModelChat {
  /** Контекст для провайдера: стабильный, пока не сменился отчёт. */
  const context = useMemo<ChatContext>(() => ({ report }), [report]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState<ThinkingState | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  /** Уже заданные вопросы: скрываем их из подсказок. */
  const [asked, setAsked] = useState<string[]>([]);

  /** Таймер печати. */
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Таймеры шагов размышления. */
  const thinkTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Счётчик id сообщений. */
  const idRef = useRef(0);
  /** Смонтирован ли компонент: защита от setState после размонтирования. */
  const mountedRef = useRef(true);

  /** Печатается ли сейчас какое-то сообщение. */
  const isTyping = messages.some((m) => m.revealedChars < m.totalChars);
  const busy = thinking !== null || isTyping;
  /** busy в ref: `send` читает актуальное значение и не пересоздаётся. */
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  /** Добавляет ответ модели и запускает его «печать». */
  const streamAnswer = useCallback((answer: ChatAnswer) => {
    const id = `m${++idRef.current}`;
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: 'model',
        blocks: answer.blocks,
        relatedFindingId: answer.relatedFindingId,
        revealedChars: 0,
        totalChars: countChars(answer.blocks),
      },
    ]);
    if (answer.relatedFindingId) setActiveFindingId(answer.relatedFindingId);
    if (typingRef.current) clearInterval(typingRef.current);
    typingRef.current = setInterval(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, revealedChars: Math.min(m.totalChars, m.revealedChars + CHARS_PER_TICK) } : m,
        ),
      );
    }, TYPE_TICK_MS);
  }, []);

  // Печать закончилась: останавливаем таймер.
  useEffect(() => {
    if (!isTyping && typingRef.current) {
      clearInterval(typingRef.current);
      typingRef.current = null;
    }
  }, [isTyping]);

  // Приветствие после скана.
  useEffect(() => {
    const timer = setTimeout(() => streamAnswer(provider.greet(context)), GREETING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [provider, context, streamAnswer]);

  // Очистка всех таймеров при размонтировании.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (typingRef.current) clearInterval(typingRef.current);
      thinkTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || busyRef.current) return;
      busyRef.current = true;

      setMessages((prev) => [
        ...prev,
        {
          id: `m${++idRef.current}`,
          role: 'user',
          blocks: [{ kind: 'paragraph', text: question }],
          relatedFindingId: null,
          revealedChars: question.length,
          totalChars: question.length,
        },
      ]);
      setAsked((prev) => (prev.includes(question) ? prev : [...prev, question]));

      // Показываем план размышлений по шагам.
      const plan = provider.planThinking(question, context);
      if (plan.relatedFindingId) setActiveFindingId(plan.relatedFindingId);
      setThinking({ steps: plan.steps, visibleCount: 1 });
      thinkTimersRef.current.forEach(clearTimeout);
      thinkTimersRef.current = plan.steps.slice(1).map((_, i) =>
        setTimeout(() => setThinking((t) => (t ? { ...t, visibleCount: i + 2 } : t)), THINK_STEP_MS * (i + 1)),
      );

      let answer: ChatAnswer;
      try {
        [answer] = await Promise.all([provider.ask(question, context), wait(MIN_THINK_MS)]);
      } catch {
        answer = ERROR_ANSWER;
      }
      if (!mountedRef.current) return;
      setThinking(null);
      streamAnswer(answer);
    },
    [provider, context, streamAnswer],
  );

  const suggestions = useMemo(
    () => provider.suggestedQuestions(context).filter((q) => !asked.includes(q)),
    [provider, context, asked],
  );

  return { messages, thinking, busy, activeFindingId, suggestions, send };
}
