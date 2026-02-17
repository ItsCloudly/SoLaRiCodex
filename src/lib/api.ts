import { getRequestEvent, isServer } from 'solid-js/web';

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
