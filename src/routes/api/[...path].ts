import apiApp from '~/server/api';

type ApiRouteEvent = {
  request: Request;
};

function stripApiPrefix(pathname: string): string {
  const stripped = pathname.replace(/^\/api/, '');
  return stripped.length === 0 ? '/' : stripped;
}

async function handleApiRequest(event: ApiRouteEvent): Promise<Response> {
  const targetUrl = new URL(event.request.url);
  targetUrl.pathname = stripApiPrefix(targetUrl.pathname);

  const method = event.request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await event.request.arrayBuffer();

  const proxiedRequest = new Request(targetUrl.toString(), {
    method: event.request.method,
    headers: event.request.headers,
    body,
  });

  return apiApp.fetch(proxiedRequest);
}

export const GET = handleApiRequest;
export const POST = handleApiRequest;
export const PUT = handleApiRequest;
export const PATCH = handleApiRequest;
export const DELETE = handleApiRequest;
export const OPTIONS = handleApiRequest;
export const HEAD = handleApiRequest;
