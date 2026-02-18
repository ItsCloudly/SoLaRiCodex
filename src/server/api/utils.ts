export function parseIdParam(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function ensureHttpScheme(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

export function buildJackettTorznabEndpoint(baseUrl: string): URL {
  const normalizedBaseUrl = ensureHttpScheme(baseUrl);
  const endpoint = new URL(normalizedBaseUrl);
  const cleanPath = endpoint.pathname.replace(/\/+$/, '');

  // Accept a full torznab endpoint or a generic Jackett base URL.
  if (/\/api\/v2\.0\/indexers\/[^/]+\/results\/torznab\/api$/i.test(cleanPath)) {
    endpoint.pathname = cleanPath;
  } else if (/\/api\/v2\.0$/i.test(cleanPath)) {
    endpoint.pathname = `${cleanPath}/indexers/all/results/torznab/api`;
  } else {
    const basePath = cleanPath.length > 0 && cleanPath !== '/' ? cleanPath : '';
    endpoint.pathname = `${basePath}/api/v2.0/indexers/all/results/torznab/api`;
  }

  endpoint.search = '';
  endpoint.hash = '';
  return endpoint;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

export async function readHttpErrorDetail(response: Response): Promise<string | null> {
  try {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const body = await response.text();
    if (!body) return null;

    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
        if (typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
          return truncateText(parsed.error.trim(), 200);
        }
        if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
          return truncateText(parsed.message.trim(), 200);
        }
      } catch {
        // Fall through to plain-text cleanup.
      }
    }

    const cleaned = body
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length === 0) return null;
    return truncateText(cleaned, 200);
  } catch {
    return null;
  }
}

function readNodeErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const directCode = (error as { code?: unknown }).code;
  if (typeof directCode === 'string' && directCode.length > 0) {
    return directCode;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    const causeCode = (cause as { code?: unknown }).code;
    if (typeof causeCode === 'string' && causeCode.length > 0) {
      return causeCode;
    }
  }

  return null;
}

export function describeFetchError(error: unknown): string {
  const code = readNodeErrorCode(error);
  if (code === 'ECONNREFUSED') {
    return 'Connection refused. Jackett is not listening on the configured host/port.';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'Could not resolve Jackett host. Verify the URL hostname.';
  }
  if (code === 'ETIMEDOUT') {
    return 'Connection timed out while reaching Jackett.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Connection failed';
}

export function readTorznabError(xml: string): string | null {
  const errorMatch = xml.match(/<error\b([^>]*)\/?>/i);
  if (!errorMatch) return null;

  const attributes: Record<string, string> = {};
  const attributePattern = /(\w+)=(['"])(.*?)\2/g;
  for (const match of errorMatch[1].matchAll(attributePattern)) {
    attributes[match[1].toLowerCase()] = match[3];
  }

  const description = (attributes.description || '').trim();
  const code = (attributes.code || '').trim();

  if (description && code) {
    return `${description} (code ${code})`;
  }
  if (description) {
    return description;
  }
  if (code) {
    return `Torznab error code ${code}`;
  }
  return 'Unknown torznab error';
}
