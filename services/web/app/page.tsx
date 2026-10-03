/**
 * Главная страница.
 *
 * Серверный компонент: собирает каркас (шапка → хиро → подвал).
 * Вся интерактивность изолирована в клиентском `HeroExperience`,
 * поэтому шапка и подвал рендерятся на сервере и не попадают в клиентский бандл.
 */
import { SiteFooter } from '@/components/layout/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader/SiteHeader';
import { HeroExperience } from '@/components/hero/HeroExperience/HeroExperience';
import styles from './page.module.scss';

export default function HomePage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <HeroExperience />
      </main>
      <SiteFooter />
    </div>
  );
}
