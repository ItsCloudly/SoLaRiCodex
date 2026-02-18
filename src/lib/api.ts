import { getRequestEvent, isServer } from 'solid-js/web';

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!isServer) {
    return normalizedPath;
  }

  const event = getRequestEvent();
  if (event) {
    const origin = new URL(event.request.url).origin;
    return new URL(normalizedPath, origin).toString();
  }

  const port = process.env.PORT ?? '3000';
  return `http://localhost:${port}${normalizedPath}`;
}

function getErrorMessage(payload: unknown, fallbackStatus: number): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.length > 0) {
      return error;
    }
  }

  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return `Request failed (${fallbackStatus})`;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(getApiUrl(path), init);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      return {
        data: null,
        error: `Unexpected response type (${response.status})`,
        status: response.status,
      };
    }

    const payload = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: getErrorMessage(payload, response.status),
        status: response.status,
      };
    }

    return {
      data: payload as T,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
    };
  }
}

export async function fetchJson<T>(path: string): Promise<ApiResult<T>> {
  return requestJson<T>(path);
}
