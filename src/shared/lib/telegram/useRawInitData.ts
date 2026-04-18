import { retrieveRawInitData } from '@telegram-apps/sdk-react';

export function readRawInitData(): string | null {
  try {
    return retrieveRawInitData() ?? null;
  } catch {
    return null;
  }
}
