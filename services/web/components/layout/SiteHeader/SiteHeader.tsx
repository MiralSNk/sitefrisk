/**
 * SiteHeader: шапка сайта (серверный компонент).
 * Бренд слева, статус сервисов и ссылка на GitHub справа.
 * На телефонах текст статуса прячется, остаётся только пульсирующая точка.
 */
import { StatusDot } from '@/components/ui/StatusDot/StatusDot';
import { HEADER_COPY, SITE_LINKS } from '@/lib/content/hero';
import styles from './SiteHeader.module.scss';

/** Пропсы шапки. Все необязательны: по умолчанию берутся из `content/hero.ts`. */
export interface SiteHeaderProps {
  /** Название бренда. */
  brand?: string;
  /** Сколько сервисов онлайн. */
  servicesOnline?: number;
  /** Сколько сервисов всего. */
  servicesTotal?: number;
  /** Ссылка на репозиторий. */
  githubUrl?: string;
}

export function SiteHeader({
  brand = HEADER_COPY.brand,
  servicesOnline = HEADER_COPY.servicesOnline,
  servicesTotal = HEADER_COPY.servicesTotal,
  githubUrl = SITE_LINKS.github,
}: SiteHeaderProps) {
  /** Все ли сервисы живы: от этого зависит цвет точки. */
  const allOnline = servicesOnline === servicesTotal;

  return (
    <header className={styles.header}>
      <a href="/" className={styles.brand} aria-label={`${brand} — на главную`}>
        <span className={styles.hash} aria-hidden="true">#</span>
        {brand}
      </a>
      <div className={styles.actions}>
        <span className={styles.status}>
          <StatusDot tone={allOnline ? 'cyan' : 'sand'} />
          <span className={styles.statusText}>
            {servicesOnline}/{servicesTotal} сервиса online
          </span>
        </span>
        <a href={githubUrl} target="_blank" rel="noopener noreferrer" className={styles.github}>
          GitHub ↗
        </a>
      </div>
    </header>
  );
}
