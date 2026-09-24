import { readRawInitData } from '@/shared/lib/telegram';
import { ApiError, buildUrl } from './client';
import { AuthResultSchema, type AuthResult } from './schemas';

/**
 * Exchanges Telegram initData for a short-lived JWT.
 *
 * Intentionally bypasses the shared apiClient's Bearer flow because this
 * single endpoint uses `Authorization: tma <initDataRaw>` instead. Every
 * other request must go through apiRequest.
 */
export async function exchangeInitDataForJwt(): Promise<AuthResult> {
  const initDataRaw = readRawInitData();
  if (!initDataRaw) {
    throw new ApiError(0, 'NO_INIT_DATA', 'Telegram initData unavailable — open this app from the Remy bot.');
  }

  let response: Response;
  try {
    response = await fetch(buildUrl('/auth/telegram'), {
      method: 'POST',
      headers: { Authorization: `tma ${initDataRaw}` },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(0, 'NETWORK_ERROR', message);
  }

  if (!response.ok) {
    let code = 'AUTH_ERROR';
    let message = response.statusText || 'Authentication failed';
    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (body.message) message = body.message;
      if (body.error) code = body.error;
    } catch {
      /* noop — body wasn't JSON */
    }
    throw new ApiError(response.status, code, message);
  }

  return AuthResultSchema.parse(await response.json());
}
