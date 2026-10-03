/**
 * Типы чата с моделью.
 *
 * Ответ модели состоит из блоков (абзац / код), а не из одной строки:
 * UI может по-разному рендерить разные типы. Позже легко добавить
 * `{ kind: 'list' }` или `{ kind: 'link' }`: расширьте union и
 * добавьте ветку в `ChatMessageView`.
 */
import type { ScanReport } from '../scan/types';

/** Блок содержимого ответа. */
export type ChatBlock =
  /** Обычный абзац текста. */
  | { readonly kind: 'paragraph'; readonly text: string }
  /** Фрагмент кода/конфига. `language` пригодится для подсветки синтаксиса. */
  | { readonly kind: 'code'; readonly text: string; readonly language?: string };

/** Ответ модели. */
export interface ChatAnswer {
  /** Id находки, к которой относится ответ (подсветится в списке слева). */
  readonly relatedFindingId: string | null;
  /** Содержимое ответа. */
  readonly blocks: ReadonlyArray<ChatBlock>;
}

/** План «размышлений»: что показывать, пока модель отвечает. */
export interface ThinkingPlan {
  /** Шаги вида «читаю отчёт…», «сопоставляю с CWE-538…». */
  readonly steps: ReadonlyArray<string>;
  /** Находка, о которой спросили (подсвечивается сразу, ещё до ответа). */
  readonly relatedFindingId: string | null;
}

/** Контекст разговора: модель отвечает «основываясь на уязвимостях сайта». */
export interface ChatContext {
  /** Отчёт скана. */
  readonly report: ScanReport;
}

/**
 * Стратегия общения с моделью (паттерн Strategy).
 * `MockChatProvider` отвечает по правилам, будущий `HttpChatProvider` пойдёт в ml-сервис.
 */
export interface ChatProvider {
  /** Приветствие сразу после скана. */
  greet(context: ChatContext): ChatAnswer;
  /** Что показывать, пока ждём ответ. Вызывается синхронно, до `ask`. */
  planThinking(question: string, context: ChatContext): ThinkingPlan;
  /** Ответ на вопрос пользователя. */
  ask(question: string, context: ChatContext): Promise<ChatAnswer>;
  /** Быстрые вопросы-подсказки под чатом. */
  suggestedQuestions(context: ChatContext): ReadonlyArray<string>;
}
