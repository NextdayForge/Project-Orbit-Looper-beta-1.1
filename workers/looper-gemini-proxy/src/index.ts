/**
 * Orbit Looper — Gemini proxy for beta (Cloudflare Workers).
 * Keeps GEMINI_API_KEY off client devices.
 */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface Env {
  GEMINI_API_KEY: string;
  BETA_TOKEN: string;
}

interface ProxyRequestBody {
  model?: string;
  request?: Record<string, unknown>;
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

    const auth = request.headers.get('Authorization') ?? '';
    const expected = `Bearer ${env.BETA_TOKEN}`;
    if (!env.BETA_TOKEN || auth !== expected) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: 'Server misconfigured' }, 500);
    }

    let payload: ProxyRequestBody;
    try {
      payload = (await request.json()) as ProxyRequestBody;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const model = payload.model?.trim() || 'gemini-2.5-flash';
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
