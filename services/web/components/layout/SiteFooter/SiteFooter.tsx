/**
 * SiteFooter: тонкий подвал с лицензией и статусом проекта (серверный компонент).
 */
import { FOOTER_COPY } from '@/lib/content/hero';
import styles from './SiteFooter.module.scss';

/** Пропсы подвала. */
export interface SiteFooterProps {
  /** Лицензия. */
  license?: string;
  /** Статус проекта. */
  status?: string;
}

export function SiteFooter({ license = FOOTER_COPY.license, status = FOOTER_COPY.status }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <span>{license}</span>
      <span>{status}</span>
    </footer>
  );
}
