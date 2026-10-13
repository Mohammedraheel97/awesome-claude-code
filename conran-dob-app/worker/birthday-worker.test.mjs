import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import worker from './birthday-worker.mjs';

const SECRET = 'test-secret';
const CLIENT_ID = 'client-123';
const SHOP = 'the-conran-shop-me.myshopify.com';

const b64url = (value) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

function sessionToken(overrides = {}, secret = SECRET) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({alg: 'HS256', typ: 'JWT'});
  const payload = b64url({
    dest: `https://${SHOP}`,
    aud: CLIENT_ID,
    exp: now + 300,
    nbf: now - 10,
    ...overrides,
  });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function makeEnv(token = 'admin-token') {
  const store = new Map(token ? [['admin_token', token]] : []);
  return {
    SHOP,
    CLIENT_ID,
    CLIENT_SECRET: SECRET,
    TOKENS: {
      get: async (key) => store.get(key) ?? null,
      put: async (key, value) => void store.set(key, value),
    },
  };
}

function birthdayRequest({token = sessionToken(), body}) {
  return new Request('https://worker.example/birthday', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
}

const recentOrder = (customer) => ({
  order: {
    id: 'gid://shopify/Order/1001',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    customer,
  },
});

let calls;
const realFetch = globalThis.fetch;

function mockShopify({order, userErrors = []}) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({url: String(url), headers: init.headers, body});
    if (body.query.includes('metafieldsSet')) {
      return Response.json({data: {metafieldsSet: {metafields: [], userErrors}}});
    }
    return Response.json({data: order});
  };
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test('saves the birthday on the order and the customer', async () => {
  mockShopify({order: recentOrder({id: 'gid://shopify/Customer/7', metafield: null})});
  const response = await worker.fetch(
    birthdayRequest({body: {orderId: 'gid://shopify/Order/1001', dateOfBirth: '1990-03-15'}}),
    makeEnv()
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {status: 'saved'});
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');

  const mutation = calls.find((call) => call.body.query.includes('metafieldsSet'));
  assert.equal(mutation.headers['X-Shopify-Access-Token'], 'admin-token');
  assert.deepEqual(
    mutation.body.variables.metafields.map(({ownerId, namespace, key, type, value}) => ({
      ownerId, namespace, key, type, value,
    })),
    [
      {ownerId: 'gid://shopify/Order/1001', namespace: 'custom', key: 'date_of_birth', type: 'date', value: '1990-03-15'},
      {ownerId: 'gid://shopify/Customer/7', namespace: 'custom', key: 'date_of_birth', type: 'date', value: '1990-03-15'},
    ]
  );
});

test('accepts an order identity id and uses its number', async () => {
  mockShopify({order: recentOrder({id: 'gid://shopify/Customer/7', metafield: null})});
  await worker.fetch(
    birthdayRequest({body: {orderId: 'gid://shopify/OrderIdentity/1001', dateOfBirth: '1990-03-15'}}),
    makeEnv()
  );
  assert.equal(calls[0].body.variables.id, 'gid://shopify/Order/1001');
});

test('keeps an existing birthday', async () => {
  mockShopify({order: recentOrder({id: 'gid://shopify/Customer/7', metafield: {value: '1985-01-01'}})});
  const response = await worker.fetch(
    birthdayRequest({body: {orderId: '1001', dateOfBirth: '1990-03-15'}}),
    makeEnv()
  );
  assert.deepEqual(await response.json(), {status: 'exists'});
  assert.equal(calls.some((call) => call.body.query.includes('metafieldsSet')), false);
});

test('saves on the order only when it has no customer', async () => {
  mockShopify({order: recentOrder(null)});
  const response = await worker.fetch(
    birthdayRequest({body: {orderId: '1001', dateOfBirth: '1990-03-15'}}),
    makeEnv()
  );
  assert.equal(response.status, 200);
  const mutation = calls.find((call) => call.body.query.includes('metafieldsSet'));
  assert.equal(mutation.body.variables.metafields.length, 1);
});

test('rejects a token signed with another secret', async () => {
  mockShopify({order: recentOrder(null)});
  const response = await worker.fetch(
    birthdayRequest({token: sessionToken({}, 'other-secret'), body: {orderId: '1001', dateOfBirth: '1990-03-15'}}),
    makeEnv()
  );
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test('rejects a token for another app, another shop, or an expired one', async () => {
  mockShopify({order: recentOrder(null)});
  const body = {orderId: '1001', dateOfBirth: '1990-03-15'};
  for (const overrides of [
    {aud: 'someone-else'},
    {dest: 'https://other-shop.myshopify.com'},
    {exp: Math.floor(Date.now() / 1000) - 600},
  ]) {
    const response = await worker.fetch(birthdayRequest({token: sessionToken(overrides), body}), makeEnv());
    assert.equal(response.status, 401);
  }
  assert.equal(calls.length, 0);
});

test('rejects a missing token', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/birthday', {method: 'POST', body: '{}'}),
    makeEnv()
  );
  assert.equal(response.status, 401);
});

test('rejects invalid or future dates', async () => {
  mockShopify({order: recentOrder(null)});
  const tomorrowPlus = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  for (const dateOfBirth of ['1990-02-30', '1899-12-31', '15/03/1990', '', tomorrowPlus]) {
    const response = await worker.fetch(birthdayRequest({body: {orderId: '1001', dateOfBirth}}), makeEnv());
    assert.equal(response.status, 400, dateOfBirth);
  }
  assert.equal(calls.length, 0);
});

test('rejects an order older than two hours', async () => {
  mockShopify({
    order: {order: {id: 'gid://shopify/Order/1001', createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(), customer: null}},
  });
  const response = await worker.fetch(birthdayRequest({body: {orderId: '1001', dateOfBirth: '1990-03-15'}}), makeEnv());
  assert.equal(response.status, 403);
});

test("rejects a signed-in buyer writing to someone else's order", async () => {
  mockShopify({order: recentOrder({id: 'gid://shopify/Customer/7', metafield: null})});
  const response = await worker.fetch(
    birthdayRequest({
      token: sessionToken({sub: 'gid://shopify/Customer/999'}),
      body: {orderId: '1001', dateOfBirth: '1990-03-15'},
    }),
    makeEnv()
  );
  assert.equal(response.status, 403);
});

test('reports when the app has not been connected yet', async () => {
  mockShopify({order: recentOrder(null)});
  const response = await worker.fetch(
    birthdayRequest({body: {orderId: '1001', dateOfBirth: '1990-03-15'}}),
    makeEnv(null)
  );
  assert.equal(response.status, 503);
});

test('answers the CORS preflight', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/birthday', {method: 'OPTIONS'}),
    makeEnv()
  );
  assert.equal(response.status, 204);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});

function signedCallback(overrides = {}, secret = SECRET) {
  const params = {code: 'abc', shop: SHOP, timestamp: '1700000000', host: 'aG9zdA', ...overrides};
  const message = Object.keys(params)
    .sort()
    .map((name) => `${name}=${params[name]}`)
    .join('&');
  const hmac = createHmac('sha256', secret).update(message).digest('hex');
  return new URL(`https://worker.example/auth/callback?${new URLSearchParams({...params, hmac})}`);
}

test('install handshake stores the access token', async () => {
  const env = makeEnv(null);
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), `https://${SHOP}/admin/oauth/access_token`);
    assert.deepEqual(JSON.parse(init.body), {client_id: CLIENT_ID, client_secret: SECRET, code: 'abc'});
    return Response.json({access_token: 'shpat_new', scope: 'write_customers'});
  };
  const response = await worker.fetch(new Request(signedCallback()), env);
  assert.equal(response.status, 200);
  assert.equal(await env.TOKENS.get('admin_token'), 'shpat_new');
});

test('install handshake rejects a bad signature or another shop', async () => {
  const env = makeEnv(null);
  globalThis.fetch = async () => {
    throw new Error('should not call Shopify');
  };
  const forged = await worker.fetch(new Request(signedCallback({}, 'wrong-secret')), env);
  assert.equal(forged.status, 401);
  const otherShop = await worker.fetch(new Request(signedCallback({shop: 'evil.myshopify.com'})), env);
  assert.equal(otherShop.status, 400);
  assert.equal(await env.TOKENS.get('admin_token'), null);
});
