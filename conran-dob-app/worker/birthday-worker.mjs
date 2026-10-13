// Cloudflare Worker for The Conran Shop birthday block on the thank-you page.
//
// Routes
//   GET  /               health check
//   GET  /auth/callback  Shopify install handshake; stores the Admin API token in KV
//   POST /birthday       called by the thank-you page block with a Shopify session token
//
// Bindings / variables (set in the Cloudflare dashboard)
//   TOKENS         KV namespace
//   SHOP           e.g. the-conran-shop-me.myshopify.com
//   CLIENT_ID      Shopify app client ID
//   CLIENT_SECRET  Shopify app client secret (store as a Secret)

const API_VERSION = '2026-04';
const NAMESPACE = 'custom';
const KEY = 'date_of_birth';
const MIN_DATE = '1900-01-01';
// A birthday can only be attached to an order placed in the last two hours,
// so the endpoint can't be used to edit old orders.
const ORDER_WINDOW_MS = 2 * 60 * 60 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, {status: 204, headers: CORS_HEADERS});
      }
      if (url.pathname === '/' && request.method === 'GET') {
        return text('Conran birthday service is running.');
      }
      if (url.pathname === '/auth/callback' && request.method === 'GET') {
        return await handleAuthCallback(url, env);
      }
      if (url.pathname === '/birthday' && request.method === 'POST') {
        return await handleBirthday(request, env);
      }
      return json({error: 'not_found'}, 404);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({error: error.code}, error.status);
      }
      console.error(error);
      return json({error: 'server_error'}, 500);
    }
  },
};

async function handleBirthday(request, env) {
  const claims = await verifySessionToken(
    request.headers.get('Authorization'),
    env
  );

  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'bad_request');
  }

  const dateOfBirth = String(body?.dateOfBirth ?? '');
  if (!isValidDate(dateOfBirth)) {
    throw new HttpError(400, 'invalid_date');
  }
  const orderId = toOrderGid(body?.orderId);
  if (!orderId) {
    throw new HttpError(400, 'invalid_order');
  }

  const token = await env.TOKENS.get('admin_token');
  if (!token) {
    throw new HttpError(503, 'app_not_connected');
  }

  const {order} = await adminRequest(env, token, ORDER_QUERY, {id: orderId});
  if (!order) {
    throw new HttpError(404, 'order_not_found');
  }
  if (Date.now() - Date.parse(order.createdAt) > ORDER_WINDOW_MS) {
    throw new HttpError(403, 'order_too_old');
  }

  const customer = order.customer;
  // A signed-in buyer may only update their own order.
  if (claims.sub && customer && claims.sub !== customer.id) {
    throw new HttpError(403, 'not_your_order');
  }
  // Keep the first value; later changes are made on the profile page.
  if (customer?.metafield?.value) {
    return json({status: 'exists'});
  }

  const metafields = [
    {ownerId: order.id, namespace: NAMESPACE, key: KEY, type: 'date', value: dateOfBirth},
  ];
  if (customer) {
    metafields.push({
      ownerId: customer.id,
      namespace: NAMESPACE,
      key: KEY,
      type: 'date',
      value: dateOfBirth,
    });
  }

  const {metafieldsSet} = await adminRequest(env, token, SET_MUTATION, {metafields});
  if (metafieldsSet.userErrors?.length) {
    console.error('metafieldsSet', JSON.stringify(metafieldsSet.userErrors));
    throw new HttpError(502, 'save_failed');
  }
  return json({status: 'saved'});
}

const ORDER_QUERY = `query Order($id: ID!) {
  order(id: $id) {
    id
    createdAt
    customer {
      id
      metafield(namespace: "${NAMESPACE}", key: "${KEY}") { value }
    }
  }
}`;

const SET_MUTATION = `mutation Set($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id }
    userErrors { field message code }
  }
}`;

async function adminRequest(env, token, query, variables) {
  const response = await fetch(
    `https://${env.SHOP}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({query, variables}),
    }
  );
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, 'app_not_connected');
  }
  if (!response.ok) {
    throw new HttpError(502, 'shopify_error');
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    console.error('graphql', JSON.stringify(payload.errors));
    throw new HttpError(502, 'shopify_error');
  }
  return payload.data;
}

// --- Install handshake ------------------------------------------------------

async function handleAuthCallback(url, env) {
  const params = url.searchParams;
  const shop = params.get('shop');
  const code = params.get('code');
  const hmac = params.get('hmac');
  if (!shop || !code || !hmac || shop !== env.SHOP) {
    return text('Invalid request.', 400);
  }

  const message = [...params.entries()]
    .filter(([name]) => name !== 'hmac')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
  const expected = await hmacHex(env.CLIENT_SECRET, message);
  if (!timingSafeEqual(expected, hmac)) {
    return text('Invalid signature.', 401);
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: env.CLIENT_ID,
      client_secret: env.CLIENT_SECRET,
      code,
    }),
  });
  if (!response.ok) {
    return text('Shopify refused the install code. Please install again.', 502);
  }
  const {access_token: accessToken, scope} = await response.json();
  await env.TOKENS.put('admin_token', accessToken);
  return text(`Connected to ${shop}. Permissions: ${scope}. You can close this page.`);
}

// --- Session token (HS256 JWT signed with the app's client secret) ----------

async function verifySessionToken(header, env) {
  const match = /^Bearer (.+)$/.exec(header ?? '');
  const parts = match ? match[1].split('.') : [];
  if (parts.length !== 3) {
    throw new HttpError(401, 'unauthorized');
  }
  const [encodedHeader, encodedPayload, signature] = parts;

  let claims;
  try {
    const tokenHeader = JSON.parse(decodeText(encodedHeader));
    if (tokenHeader.alg !== 'HS256') {
      throw new Error('alg');
    }
    const key = await hmacKey(env.CLIENT_SECRET, ['verify']);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    if (!valid) {
      throw new Error('signature');
    }
    claims = JSON.parse(decodeText(encodedPayload));
  } catch {
    throw new HttpError(401, 'unauthorized');
  }

  const now = Math.floor(Date.now() / 1000);
  const dest = String(claims.dest ?? '').replace(/^https?:\/\//, '');
  if (
    claims.aud !== env.CLIENT_ID ||
    dest !== env.SHOP ||
    !(claims.exp > now - 5) ||
    claims.nbf > now + 5
  ) {
    throw new HttpError(401, 'unauthorized');
  }
  return claims;
}

// --- Helpers ----------------------------------------------------------------

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }
  // Allow one day of slack for time zones ahead of UTC.
  const latest = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return value >= MIN_DATE && value <= latest;
}

function toOrderGid(id) {
  const match = /(\d+)$/.exec(String(id ?? ''));
  return match ? `gid://shopify/Order/${match[1]}` : null;
}

async function hmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    usages
  );
}

async function hmacHex(secret, message) {
  const key = await hmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function decodeText(value) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {...CORS_HEADERS, 'Content-Type': 'application/json'},
  });
}

function text(message, status = 200) {
  return new Response(message, {
    status,
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
  });
}
