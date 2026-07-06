/**
 * Orbit Looper — Gemini proxy for beta (Cloudflare Workers).
 * Keeps GEMINI_API_KEY off client devices.
 *
 * The beta token ships inside public client bundles (EXPO_PUBLIC_*), so treat
 * it as world-readable. The model allowlist, body-size cap, and rate limit
 * below are the actual cost-abuse defenses, not the token.
 */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Models this proxy forwards. Anything else is rejected — the model string
 * is interpolated into the upstream URL, so this also blocks path injection. */
const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite']);

/** Legitimate prompts are a few KB; reject anything wildly larger. */
const MAX_BODY_BYTES = 100_000;

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  GEMINI_API_KEY: string;
  BETA_TOKEN: string;
  /** Optional: Workers rate-limiting binding (see wrangler.toml). */
  RATE_LIMITER?: RateLimiter;
}

interface ProxyRequestBody {
  model?: string;
  request?: Record<string, unknown>;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.byteLength !== bBytes.byteLength) {
    return false;
  }
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    if (url.pathname !== '/v1/generate') {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    if (env.RATE_LIMITER) {
      const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
      if (!success) {
        return jsonResponse({ error: 'Too many requests' }, 429);
      }
    }

    const auth = request.headers.get('Authorization') ?? '';
    if (!env.BETA_TOKEN || !timingSafeEqualStr(auth, `Bearer ${env.BETA_TOKEN}`)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: 'Server misconfigured' }, 500);
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Request body too large' }, 413);
    }

    let payload: ProxyRequestBody;
    try {
      payload = JSON.parse(rawBody) as ProxyRequestBody;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const model = payload.model?.trim() || 'gemini-2.5-flash';
    if (!ALLOWED_MODELS.has(model)) {
      return jsonResponse({ error: 'Model not allowed' }, 400);
    }

    const geminiBody = payload.request;
    if (!geminiBody || typeof geminiBody !== 'object') {
      return jsonResponse({ error: 'Missing request body' }, 400);
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const text = await geminiRes.text();
    return new Response(text, {
      status: geminiRes.status,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
      },
    });
  },
};
