'use client';
/**
 * HeroIntro: первый экран до скана.
 *
 * Слева: eyebrow, глитч-заголовок, «расшифровывающийся» подзаголовок,
 * форма скана и чипы-фичи. Справа: 3D-щит, демо-лог и демо-индикатор риска.
 * На мобильных колонки встают одна под другой, щит уходит под форму.
 */
import { DemoLog } from '@/components/hero/DemoLog/DemoLog';
import { FeatureChips } from '@/components/hero/FeatureChips/FeatureChips';
import { ScanForm } from '@/components/hero/ScanForm/ScanForm';
import { ShieldPanel } from '@/components/shield/ShieldPanel/ShieldPanel';
import { GlitchText } from '@/components/ui/GlitchText/GlitchText';
import { RiskGauge } from '@/components/ui/RiskGauge/RiskGauge';
import { StatusDot } from '@/components/ui/StatusDot/StatusDot';
import { useScrambleText } from '@/hooks/useScrambleText';
import { DEMO_RISK_SCORE, FEATURE_CHIPS, HERO_COPY } from '@/lib/content/hero';
import type { GlitchEvent } from '@/lib/glitch/glitchFactory';
import styles from './HeroIntro.module.scss';

/** Пропсы первого экрана. */
export interface HeroIntroProps {
  /** Активный глитч: влияет на заголовок и кнопку. */
  glitchEvent: GlitchEvent | null;
  /** Reduced motion: без печати текста. */
  reducedMotion: boolean;
  /** Запуск скана с нормализованным URL. */
  onScan: (target: string) => void;
  /** Ошибка прошлого скана (показывается под формой). */
  error?: string | null;
}

export function HeroIntro({ glitchEvent, reducedMotion, onScan, error }: HeroIntroProps) {
  /** Подзаголовок с эффектом расшифровки. */
  const subheadline = useScrambleText(HERO_COPY.subheadline, { enabled: !reducedMotion });
  /** Глитч «смена языка» переключает вторую строку заголовка. */
  const tail = glitchEvent?.type === 'lang' ? HERO_COPY.headlineTailAlt : HERO_COPY.headlineTail;

  return (
    <div className={styles.grid}>
      <div className={styles.copy}>
        <div className={styles.eyebrow}>
          <StatusDot tone="sand" />
          {HERO_COPY.eyebrow}
        </div>

        <h1 className={styles.headline}>
          {HERO_COPY.headlineLead} <GlitchText text={HERO_COPY.headlineGlitchWord} intense={glitchEvent !== null} />
          <br />
          <span className={styles.headlineTail} lang={glitchEvent?.type === 'lang' ? 'en' : undefined}>
            {tail}
          </span>
        </h1>

        {/* Скринридер читает полный текст сразу, анимацию видят только зрячие. */}
        <p className={styles.subheadline} aria-label={HERO_COPY.subheadline}>
          <span aria-hidden="true">{subheadline}</span>
        </p>

        <ScanForm onSubmit={onScan} labelOverride={glitchEvent?.buttonLabel ?? null} error={error} />

        <FeatureChips chips={FEATURE_CHIPS} hint={HERO_COPY.chipsHint} />
      </div>

      <div className={styles.visual}>
        <ShieldPanel caption={HERO_COPY.shieldCaption} liveLabel={HERO_COPY.shieldLive} autoRotate={!reducedMotion} />
        <div className={styles.readouts}>
          <DemoLog label={HERO_COPY.demoLogLabel} animated={!reducedMotion} />
          <div className={styles.gaugeCell}>
            <RiskGauge value={DEMO_RISK_SCORE} variant="disc" animate={!reducedMotion} />
            <span className={styles.gaugeNote}>{HERO_COPY.demoGaugeNote}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
