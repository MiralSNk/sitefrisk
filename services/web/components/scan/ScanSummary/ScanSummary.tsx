/**
 * ScanSummary: итог скана — кольцо риска, заголовок и мета-строка.
 */
import { RiskGauge } from '@/components/ui/RiskGauge/RiskGauge';
import { buildFindingsHeadline, formatSeconds } from '@/lib/scan/format';
import type { ScanReport } from '@/lib/scan/types';
import styles from './ScanSummary.module.scss';

/** Пропсы. */
export interface ScanSummaryProps {
  /** Итоговый отчёт. */
  report: ScanReport;
}

export function ScanSummary({ report }: ScanSummaryProps) {
  /** Две строки заголовка по количеству и критичности находок. */
  const headline = buildFindingsHeadline(report.findings);

  return (
    <div className={styles.summary}>
      <RiskGauge value={report.riskScore} variant="ring" />
      <div className={styles.text}>
        <h3 className={styles.headline}>
          {headline.lead}
          <br />
          <span className={styles.tail}>{headline.tail}</span>
        </h3>
        <div className={styles.meta}>
          {formatSeconds(report.durationMs)} · {report.factsCollected} фактов · сессия {report.sessionId}
        </div>
      </div>
    </div>
  );
}
