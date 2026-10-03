/**
 * Фабрика провайдеров данных.
 *
 * Единственное место, где решается, откуда берутся данные: из мока или
 * с реального бэкенда. Переключается переменной окружения:
 *
 *   NEXT_PUBLIC_SITEFRISK_BACKEND=mock   # по умолчанию, демо
 *   NEXT_PUBLIC_SITEFRISK_BACKEND=live   # реальный сканер через /api/scan
 *
 * Компоненты получают готовые экземпляры и не знают, какая реализация внутри.
 */
import { MockChatProvider } from './chat/MockChatProvider';
import type { ChatProvider } from './chat/types';
import { HttpScanProvider } from './scan/HttpScanProvider';
import { MockScanProvider } from './scan/MockScanProvider';
import { MOCK_STAGES } from './scan/mockScenario';
import type { ScanProvider } from './scan/types';

/** Режим источника данных. */
export type BackendMode = 'mock' | 'live';

/** Текущий режим из env (на клиенте доступны только NEXT_PUBLIC_*). */
export const BACKEND_MODE: BackendMode =
  process.env.NEXT_PUBLIC_SITEFRISK_BACKEND === 'live' ? 'live' : 'mock';

/** Создаёт провайдер скана под текущий режим. */
export function createScanProvider(mode: BackendMode = BACKEND_MODE): ScanProvider {
  switch (mode) {
    case 'live':
      // Этапы пока берём из сценария; позже их можно отдавать с бэкенда.
      return new HttpScanProvider(MOCK_STAGES);
    case 'mock':
    default:
      return new MockScanProvider();
  }
}

/** Создаёт провайдер чата под текущий режим. */
export function createChatProvider(mode: BackendMode = BACKEND_MODE): ChatProvider {
  switch (mode) {
    case 'live':
      // TODO: HttpChatProvider → ml-сервис (FastAPI). Пока используем мок.
      return new MockChatProvider();
    case 'mock':
    default:
      return new MockChatProvider();
  }
}
