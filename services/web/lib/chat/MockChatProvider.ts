/**
 * MockChatProvider: демо-реализация стратегии `ChatProvider`.
 * Отвечает по цепочке правил из `answerRules.ts` с имитацией задержки сети.
 */
import { ANSWER_RULES, FALLBACK_ANSWER, findByCwe, type AnswerRule } from './answerRules';
import type { ChatAnswer, ChatContext, ChatProvider, ThinkingPlan } from './types';

/** Имитация задержки ответа модели, мс. */
const DEFAULT_LATENCY_MS = 600;

export class MockChatProvider implements ChatProvider {
  /**
   * @param rules     цепочка правил (можно подменить в тестах)
   * @param latencyMs имитация сетевой задержки
   */
  constructor(
    private readonly rules: ReadonlyArray<AnswerRule> = ANSWER_RULES,
    private readonly latencyMs: number = DEFAULT_LATENCY_MS,
  ) {}

  /** Находит первое подходящее правило (сердце Chain of Responsibility). */
  private resolveRule(question: string): AnswerRule | undefined {
    const normalized = question.toLowerCase();
    return this.rules.find((rule) => rule.matches(normalized));
  }

  greet(context: ChatContext): ChatAnswer {
    const { findings } = context.report;
    const top = findings[0];
    return {
      relatedFindingId: null,
      blocks: [
        {
          kind: 'paragraph',
          text: top
            ? `Скан завершён. Нашёл проблем: ${findings.length}. Главная — «${top.title}».`
            : 'Скан завершён. Явных проблем не нашёл.',
        },
        { kind: 'paragraph', text: 'Выберите находку или спросите, с чего начать.' },
      ],
    };
  }

  planThinking(question: string, context: ChatContext): ThinkingPlan {
    const finding = findByCwe(context, this.resolveRule(question)?.cwe);
    const session = `читаю отчёт сессии ${context.report.sessionId}`;
    return {
      relatedFindingId: finding?.id ?? null,
      steps: finding
        ? [session, `сопоставляю с ${finding.cwe}`, 'формирую рекомендации']
        : [session, 'ранжирую находки по риску', 'формирую ответ'],
    };
  }

  async ask(question: string, context: ChatContext): Promise<ChatAnswer> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    const rule = this.resolveRule(question);
    if (!rule) return FALLBACK_ANSWER;
    return {
      relatedFindingId: findByCwe(context, rule.cwe)?.id ?? null,
      blocks: rule.build(context),
    };
  }

  suggestedQuestions(context: ChatContext): ReadonlyArray<string> {
    return ['С чего начать?', ...context.report.findings.map((f) => f.suggestedQuestion)];
  }
}
