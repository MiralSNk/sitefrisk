/**
 * ChatMessageView: одно сообщение ленты.
 *
 * - Пользователь: компактный пузырь справа.
 * - Модель: аватар «›», ссылка на находку и блоки (абзацы/код),
 *   которые проявляются по мере «печати» (по `revealedChars`).
 *
 * Новый тип блока добавляется так: допишите его в `ChatBlock` (lib/chat/types.ts)
 * и ветку в `renderBlock` ниже.
 */
import type { ChatMessage } from '@/hooks/useModelChat';
import type { ChatBlock } from '@/lib/chat/types';
import { SEVERITY_TONE } from '@/lib/scan/tone';
import type { Finding } from '@/lib/scan/types';
import styles from './ChatMessageView.module.scss';

/** Пропсы сообщения. */
export interface ChatMessageViewProps {
  /** Сообщение. */
  message: ChatMessage;
  /** Находка, к которой относится ответ (если есть). */
  relatedFinding: Finding | null;
}

/** Обрезает блоки до `chars` символов: так получается эффект печати по блокам. */
function sliceBlocks(blocks: ReadonlyArray<ChatBlock>, chars: number): ChatBlock[] {
  const out: ChatBlock[] = [];
  let left = chars;
  for (const block of blocks) {
    if (left <= 0) break;
    out.push({ ...block, text: block.text.slice(0, left) });
    left -= block.text.length;
  }
  return out;
}

/** Рендер одного блока по его типу (switch по discriminated union). */
function renderBlock(block: ChatBlock, key: number) {
  switch (block.kind) {
    case 'code':
      return (
        <pre key={key} className={styles.code} data-language={block.language}>
          {block.text}
        </pre>
      );
    case 'paragraph':
    default:
      return (
        <p key={key} className={styles.paragraph}>
          {block.text}
        </p>
      );
  }
}

export function ChatMessageView({ message, relatedFinding }: ChatMessageViewProps) {
  if (message.role === 'user') {
    return <div className={styles.user}>{message.blocks[0]?.text}</div>;
  }

  /** Ещё печатается. */
  const typing = message.revealedChars < message.totalChars;
  /** Видимая часть ответа. */
  const visible = sliceBlocks(message.blocks, message.revealedChars);

  return (
    <div className={styles.model}>
      <div className={styles.avatar} aria-hidden="true">›</div>
      <div className={styles.content}>
        {relatedFinding && (
          <span className={styles.ref} data-tone={SEVERITY_TONE[relatedFinding.severity]}>
            ↳ {relatedFinding.cwe} · {relatedFinding.title}
          </span>
        )}
        {visible.map(renderBlock)}
        {typing && <span className={styles.caret} aria-hidden="true">▌</span>}
      </div>
    </div>
  );
}
