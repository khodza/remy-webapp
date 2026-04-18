import { useAuthStore } from '@/shared/stores/auth.store';
import { ApiError, buildUrl } from './client';
import { TaskSchema, type Task } from './schemas';

/**
 * Uploads a recorded audio blob to POST /tasks/voice.
 *
 * Has to bypass the shared apiRequest helper because that one sets
 * Content-Type to application/json. FormData requests must leave the header
 * unset so the browser can attach the multipart boundary.
 */
export async function createTaskFromVoice(blob: Blob): Promise<Task> {
  const token = await useAuthStore.getState().authenticate();
  const form = new FormData();
  const filename = filenameForMime(blob.type);
  form.append('audio', blob, filename);

  const response = await fetchWithRetry(token, form);

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new ApiError(response.status, 'VOICE_UPLOAD_FAILED', message);
  }
  return TaskSchema.parse(await response.json());
}

async function fetchWithRetry(
  token: string,
  form: FormData,
): Promise<Response> {
  const url = buildUrl('/tasks/voice');
  let response = await safeFetch(url, token, form);
  if (response.status !== 401) return response;

  // Token expired — re-exchange initData once, then retry.
  useAuthStore.getState().clear();
  const fresh = await useAuthStore.getState().authenticate();
  response = await safeFetch(url, fresh, form);
  return response;
}

async function safeFetch(
  url: string,
  bearer: string,
  form: FormData,
): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}` },
      body: form,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(0, 'NETWORK_ERROR', message);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    if (typeof body?.message === 'string' && body.message) return body.message;
  } catch {
    /* noop */
  }
  return response.statusText || 'Voice upload failed';
}

function filenameForMime(mime: string): string {
  if (mime.includes('webm')) return 'memo.webm';
  if (mime.includes('mp4')) return 'memo.m4a';
  if (mime.includes('ogg')) return 'memo.ogg';
  return 'memo.audio';
}
