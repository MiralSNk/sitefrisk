'use client';
/**
 * ScanResults: экран после скана.
 * Слева итог и список находок, справа чат с моделью. Это две половины
 * одного разговора, поэтому состояние чата (`useModelChat`) живёт здесь
 * и раздаётся обеим сторонам:
 *  - клик по находке отправляет вопрос в чат;
 *  - находка, которую обсуждает модель, подсвечивается в списке.
 *
 * На мобильных чат встаёт под находки, перед ним есть якорь-кнопка
 * «к чату с моделью».
 */
import { useRef } from 'react';
import { ModelChat } from '@/components/chat/ModelChat/ModelChat';
import { FindingItem } from '@/components/scan/FindingItem/FindingItem';
import { ScanSummary } from '@/components/scan/ScanSummary/ScanSummary';
import { useModelChat } from '@/hooks/useModelChat';
import type { ChatProvider } from '@/lib/chat/types';
import type { Finding, ScanReport } from '@/lib/scan/types';
import styles from './ScanResults.module.scss';

/** Пропсы. */
export interface ScanResultsProps {
  /** Итоговый отчёт. */
  report: ScanReport;
  /** Провайдер чата. */
  chatProvider: ChatProvider;
}

export function ScanResults({ report, chatProvider }: ScanResultsProps) {
  /** Состояние диалога. */
  const chat = useModelChat(chatProvider, report);
  /** Ссылка на чат: на мобильных к нему прокручиваем после клика по находке. */
  const chatRef = useRef<HTMLDivElement | null>(null);

  /** Клик по находке: спросить модель и показать чат, если он ниже экрана. */
  const handleSelect = (finding: Finding) => {
    chat.send(finding.suggestedQuestion);
    const el = chatRef.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) {
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 16, behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.grid}>
      <div className={styles.left}>
        <ScanSummary report={report} />
        <section className={styles.findings} aria-labelledby="findings-title">
          <h3 id="findings-title" className={styles.findingsTitle}>
            находки
          </h3>
          <ul className={styles.list}>
            {report.findings.map((finding, i) => (
              <li key={finding.id}>
                <FindingItem
                  finding={finding}
                  index={i}
                  active={chat.activeFindingId === finding.id}
                  disabled={chat.busy}
                  onSelect={handleSelect}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div ref={chatRef} className={styles.right}>
        <ModelChat chat={chat} findings={report.findings} sessionId={report.sessionId} />
      </div>
    </div>
  );
}
