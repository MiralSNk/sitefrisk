/**
 * Правила ответов демо-модели (паттерн Chain of Responsibility).
 *
 * Каждое правило проверяет вопрос (`matches`) и, если подходит, собирает ответ
 * (`build`). Правила перебираются по порядку, срабатывает первое подходящее.
 * Чтобы добавить новую тему, допишите объект в `ANSWER_RULES`.
 */
import type { Finding } from '../scan/types';
import type { ChatAnswer, ChatBlock, ChatContext } from './types';

/** Одно правило цепочки. */
export interface AnswerRule {
  /** Идентификатор правила (для отладки). */
  readonly id: string;
  /** CWE находки, к которой относится правило (если есть). */
  readonly cwe?: string;
  /** Подходит ли вопрос. На вход приходит вопрос в нижнем регистре. */
  matches(question: string): boolean;
  /** Собирает блоки ответа. */
  build(context: ChatContext): ReadonlyArray<ChatBlock>;
}

/** Хелпер: абзац. */
const p = (text: string): ChatBlock => ({ kind: 'paragraph', text });
/** Хелпер: блок кода. */
const code = (text: string, language?: string): ChatBlock => ({ kind: 'code', text, language });

/** Ищет находку в отчёте по CWE. */
export function findByCwe(context: ChatContext, cwe?: string): Finding | undefined {
  return cwe ? context.report.findings.find((f) => f.cwe === cwe) : undefined;
}

/** Цепочка правил: порядок важен. */
export const ANSWER_RULES: ReadonlyArray<AnswerRule> = [
  {
    id: 'env',
    cwe: 'CWE-538',
    matches: (q) => q.includes('env'),
    build: () => [
      p('Это главная находка. Файл отдаётся без авторизации, а внутри — DB_PASSWORD. По сути, ключи от базы лежат в открытом доступе.'),
      p('Закройте dot-файлы на уровне веб-сервера:'),
      code('location ~ /\\. {\n  deny all;\n}', 'nginx'),
      p('Затем смените все секреты из файла — считайте их скомпрометированными — и проверьте логи обращений к /.env.'),
    ],
  },
  {
    id: 'csp',
    cwe: 'CWE-693',
    matches: (q) => q.includes('csp') || q.includes('policy'),
    build: () => [
      p('Без CSP браузер выполнит любой внедрённый скрипт — это усиливает последствия XSS. Начните с режима отчётов, чтобы ничего не сломать:'),
      code(
        "// next.config.ts\nheaders: async () => [{\n  source: '/(.*)',\n  headers: [{\n    key: 'Content-Security-Policy-Report-Only',\n    value: \"default-src 'self'; object-src 'none'\",\n  }],\n}]",
        'ts',
      ),
      p('Через неделю, когда соберёте нарушения, переключите заголовок на боевой.'),
    ],
  },
  {
    id: 'tls',
    cwe: 'CWE-326',
    matches: (q) => q.includes('tls'),
    build: () => [
      p('Риск низкий: TLS 1.2 с ECDHE пока безопасен. Но 1.3 быстрее — на один round-trip меньше — и отсекает устаревшие шифры.'),
      code('ssl_protocols TLSv1.2 TLSv1.3;', 'nginx'),
      p('Обычно хватает одной строки в конфиге nginx и перезагрузки.'),
    ],
  },
  {
    id: 'priority',
    matches: (q) => ['начать', 'перв', 'приорит'].some((k) => q.includes(k)),
    build: (ctx) => [
      p('По приоритету:'),
      code(
        ctx.report.findings
          .map((f, i) => `${String(i + 1).padStart(2, '0')}  ${f.cwe.padEnd(9)} ${f.title}`)
          .join('\n'),
      ),
      p('Начните с первого пункта — после него risk_score заметно снизится.'),
    ],
  },
];

/** Ответ, если ни одно правило не подошло. */
export const FALLBACK_ANSWER: ChatAnswer = {
  relatedFindingId: null,
  blocks: [
    p('Пока отвечаю в демо-режиме — модель ещё дообучается. Спросите про конкретную находку, и я разберу её подробнее.'),
  ],
};

/** Ответ на случай ошибки провайдера. */
export const ERROR_ANSWER: ChatAnswer = {
  relatedFindingId: null,
  blocks: [p('Не удалось получить ответ модели. Попробуйте ещё раз через пару секунд.')],
};
