'use client';
/**
 * ModelChat: панель диалога с моделью.
 * Шапка (модель, контекст) → лента сообщений с автопрокруткой → подсказки и ввод.
 * Состояние приходит снаружи (`useModelChat` в ScanResults), здесь только UI.
 */
import { useEffect, useRef } from 'react';
import { ChatComposer } from '@/components/chat/ChatComposer/ChatComposer';
import { ChatMessageView } from '@/components/chat/ChatMessageView/ChatMessageView';
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator/ThinkingIndicator';
import { StatusDot } from '@/components/ui/StatusDot/StatusDot';
import type { ModelChat as ModelChatApi } from '@/hooks/useModelChat';
import type { Finding } from '@/lib/scan/types';
import styles from './ModelChat.module.scss';

/** Пропсы панели. */
export interface ModelChatProps {
  /** API чата. */
  chat: ModelChatApi;
  /** Находки отчёта: по ним подписываются ответы («↳ CWE-538 · …»). */
  findings: ReadonlyArray<Finding>;
  /** Id сессии для шапки. */
  sessionId: string;
  /** Имя модели. */
  modelName?: string;
  /** Подпись версии. */
  modelVersion?: string;
}

export function ModelChat({
  chat,
  findings,
  sessionId,
  modelName = 'sitefrisk-model',
  modelVersion = 'v0 · демо',
}: ModelChatProps) {
  /** Прокручиваемая лента. */
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Автопрокрутка вниз при новых символах/шагах.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.thinking]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.model}>
          <StatusDot tone="cyan" />
          {modelName}
          <span className={styles.version}>{modelVersion}</span>
        </div>
        <div className={styles.context}>контекст: отчёт {sessionId}</div>
      </div>

      <div ref={feedRef} className={styles.feed} role="log" aria-live="polite" aria-busy={chat.busy}>
        {chat.messages.map((message) => (
          <ChatMessageView
            key={message.id}
            message={message}
            relatedFinding={findings.find((f) => f.id === message.relatedFindingId) ?? null}
          />
        ))}
        {chat.thinking && <ThinkingIndicator thinking={chat.thinking} />}
      </div>

      <ChatComposer suggestions={chat.suggestions} busy={chat.busy} onSend={chat.send} />
    </div>
  );
}
