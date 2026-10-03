/**
 * Весь текст хиро-секции в одном месте.
 */

/** Ссылки сайта. */
export const SITE_LINKS = {
  /** Репозиторий проекта. */
  github: 'https://github.com/MiralSNk/sitefrisk',
} as const;

/** Тексты шапки. */
export const HEADER_COPY = {
  /** Название бренда без префикса «#». */
  brand: 'sitefrisk',
  /** Сколько сервисов онлайн / всего (заглушка; позже можно брать из health-check). */
  servicesOnline: 4,
  servicesTotal: 4,
} as const;

/** Тексты подвала. */
export const FOOTER_COPY = {
  /** Лицензия. */
  license: 'Apache 2.0',
  /** Статус проекта. */
  status: 'дипломный проект · в активной разработке',
} as const;

/** Тексты первого экрана. */
export const HERO_COPY = {
  /** Метка над заголовком. */
  eyebrow: 'в активной разработке',
  /** Начало заголовка. */
  headlineLead: 'Сайт выглядит',
  /** Слово с глитч-эффектом. */
  headlineGlitchWord: 'надёжно.',
  /** Вторая строка заголовка. */
  headlineTail: 'Так же выглядели все взломанные.',
  /** Она же во время глитча «смена языка». */
  headlineTailAlt: 'They all looked safe, too.',
  /** Подзаголовок, проявляется посимвольно. */
  subheadline:
    'Собственная дообученная модель детекции уязвимостей — объясняет находки понятным языком, не обёртка над чужим LLM API.',
  /** Текст кнопки скана. */
  ctaLabel: 'Просканировать',
  /** Плейсхолдер поля URL. */
  inputPlaceholder: 'https://ваш-сайт.ru',
  /** Подпись поля для скринридеров. */
  inputAriaLabel: 'Адрес сайта для скана',
  /** Подсказка под чипами, пока ни один не выбран. */
  chipsHint: 'наведите или нажмите — что из этого уже реально работает',
  /** Подписи 3D-панели. */
  shieldCaption: 'scan_target.obj',
  shieldLive: '● live',
  /** Подпись демо-лога. */
  demoLogLabel: 'демо-лог',
  /** Подпись демо-индикатора. */
  demoGaugeNote: 'демо',
} as const;

/** Чип с фичей: короткая метка + раскрываемая деталь. */
export interface FeatureChip {
  /** Стабильный id. */
  readonly id: string;
  /** Текст на чипе. */
  readonly label: string;
  /** Пояснение, которое появляется при наведении/нажатии. */
  readonly detail: string;
}

/** Чипы под формой. */
export const FEATURE_CHIPS: ReadonlyArray<FeatureChip> = [
  { id: 'lora', label: 'LoRA/QLoRA', detail: 'Своя дообученная модель — не обёртка над чужим LLM API' },
  { id: 'ssrf', label: 'SSRF-guard', detail: 'Защищённый сборщик фактов, а не просто curl по URL' },
  { id: 'cwe', label: 'CWE-таксономия', detail: 'Находки классифицированы по стандарту MITRE CWE' },
];

/** Строки демо-лога на первом экране (печатаются по кругу). */
export const DEMO_LOG_LINES: ReadonlyArray<string> = [
  'scanning example.com...',
  'header: Content-Security-Policy — отсутствует',
  'tls: версия 1.2 — рекомендован 1.3',
  'exposed_path: /.env — 200 OK (!)',
  'CWE-200: Exposure of Sensitive Information',
  'risk_score: вычислен — см. индикатор справа',
];

/** Значение демо-индикатора риска на первом экране. */
export const DEMO_RISK_SCORE = 6.8;
