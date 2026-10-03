/**
 * Корневой layout приложения (App Router).
 *
 * Отвечает за:
 *  - подключение шрифтов через next/font: самохостинг, без layout shift;
 *  - глобальные стили (`globals.scss`);
 *  - метаданные и viewport.
 *
 * Шрифты отдаются как CSS-переменные (--font-serif / --font-mono / --font-sans),
 * их читает `_tokens.scss`. Чтобы сменить шрифт, поменяйте импорт ниже,
 */
import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import '../styles/globals.scss';

/** Антиква для заголовков */
const serifFont = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

/** Моноширинный: логи, метки, код, технический «голос» продукта. */
const monoFont = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

/** Гротеск для основного текста. */
const sansFont = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

/** SEO-метаданные страницы. */
export const metadata: Metadata = {
  title: 'sitefrisk — ИИ-сканер веб-безопасности',
  description:
    'Собственная дообученная модель детекции уязвимостей. Находит проблемы сайта и объясняет их понятным языком.',
};

/** Настройки viewport: цвет системной панели на мобильных и масштаб. */
export const viewport: Viewport = {
  themeColor: '#0a0b0f',
  width: 'device-width',
  initialScale: 1,
};

/** Пропсы корневого layout. */
interface RootLayoutProps {
  /** Содержимое текущей страницы. */
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru" className={`${serifFont.variable} ${monoFont.variable} ${sansFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
