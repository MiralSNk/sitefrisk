'use client';
/**
 * HeroExperience: оркестратор первого экрана (Mediator).
 *
 * Связывает независимые части и держит общее состояние:
 *  - провайдеры данных (из фабрики `lib/providers.ts`);
 *  - сессию скана (`useScanSession`);
 *  - глитч-планировщик (`useGlitchScheduler`);
 *  - подсветку под курсором (`usePointerSpotlight`).
 *
 * По фазе сессии показывает либо `HeroIntro` (первый экран), либо `ScanView`
 * (скан → отчёт → чат). Дочерние компоненты друг о друге не знают,
 * всё общение идёт через пропсы отсюда.
 */
import { useEffect, useMemo, useRef } from 'react';
import { GlitchOverlay } from '@/components/hero/GlitchOverlay/GlitchOverlay';
import { HeroBackdrop } from '@/components/hero/HeroBackdrop/HeroBackdrop';
import { HeroIntro } from '@/components/hero/HeroIntro/HeroIntro';
import { ScanView } from '@/components/scan/ScanView/ScanView';
import { useGlitchScheduler } from '@/hooks/useGlitchScheduler';
import { usePointerSpotlight } from '@/hooks/usePointerSpotlight';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useScanSession } from '@/hooks/useScanSession';
import { ACTIVE_GLITCH_POOL, IDLE_GLITCH_POOL, type GlitchType } from '@/lib/glitch/glitchFactory';
import { createChatProvider, createScanProvider } from '@/lib/providers';
import { cssVars } from '@/lib/utils/cssVars';
import styles from './HeroExperience.module.scss';

/** Пропсы. */
export interface HeroExperienceProps {
  /** Множитель скорости демо-скана (1 = обычная). */
  scanSpeed?: number;
}

export function HeroExperience({ scanSpeed = 1 }: HeroExperienceProps) {
  /** Пользователь просит меньше движения: глитчи и печать выключаются. */
  const reducedMotion = usePrefersReducedMotion();
  /** Провайдеры создаются один раз за жизнь компонента. */
  const scanProvider = useMemo(() => createScanProvider(), []);
  const chatProvider = useMemo(() => createChatProvider(), []);

  /** Ссылка на trigger глитча. Сессия создаётся раньше планировщика, поэтому через ref. */
  const glitchTriggerRef = useRef<((type: GlitchType, intensity?: number) => void) | null>(null);

  const session = useScanSession(scanProvider, {
    speed: scanSpeed,
    // На каждом завершённом этапе — короткий сильный «удар» помех.
    onStageComplete: () => glitchTriggerRef.current?.('scan', 1.3),
  });

  /** Фаза сессии. */
  const { phase } = session.state;

  const glitch = useGlitchScheduler({
    enabled: !reducedMotion,
    pool: phase === 'idle' ? IDLE_GLITCH_POOL : ACTIVE_GLITCH_POOL,
  });

  useEffect(() => {
    glitchTriggerRef.current = glitch.trigger;
  }, [glitch.trigger]);

  /** Ref для подсветки под курсором (пишет --spot-x/--spot-y). */
  const spotlightRef = usePointerSpotlight<HTMLElement>();
  /** Текущий глитч. */
  const event = glitch.event;

  return (
    <section ref={spotlightRef} className={styles.hero} data-phase={phase} aria-label="sitefrisk — сканер безопасности">
      <HeroBackdrop animated={!reducedMotion} />
      <GlitchOverlay event={event} />

      <div
        className={styles.content}
        data-glitch={event?.type}
        style={cssVars({ '--shake-x': `${event?.shake.x ?? 0}px`, '--shake-y': `${event?.shake.y ?? 0}px` })}
      >
        {phase === 'idle' ? (
          <HeroIntro glitchEvent={event} reducedMotion={reducedMotion} onScan={session.start} error={session.state.error} />
        ) : (
          <ScanView session={session} chatProvider={chatProvider} />
        )}
      </div>
    </section>
  );
}
