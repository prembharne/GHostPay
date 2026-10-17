const upstream = 'https://ghostpay-prem-sepolia.brawnyfrost16.chatgpt.site';
export const MAX_BODY = 12288;
const route = /^(?:health|deployment(?:\/artifact)?|requests(?:\/payment\/[1-9]\d{0,76}|\/[\da-f-]{36}(?:\/(?:authorize|reject))?)?)$/i;
const result = (error, status) => ({ status, type: 'application/json', body: JSON.stringify({ error }) });

export async function relay({ method, path, origin, host, contentType, body }, fetcher = fetch) {
  if (!['GET', 'POST'].includes(method)) return result('Method not allowed.', 405);
  if (typeof path !== 'string' || !route.test(path)) return result('API route not found.', 404);
  if (method === 'POST') {
    if (origin && origin !== `https://${host}`) return result('Cross-origin writes are not allowed.', 403);
    if (!contentType?.toLowerCase().includes('application/json')) return result('JSON content type is required.', 415);
    if (!body || body.length > MAX_BODY) return result(body ? 'Request is too large.' : 'Missing JSON body.', body ? 413 : 400);
  }
  try {
    const response = await fetcher(`${upstream}/api/${path}`, {
      method, headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json', Origin: upstream } : {}) },
      body: method === 'POST' ? body : undefined, signal: AbortSignal.timeout(25000), redirect: 'error',
    });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) return result('Claim relay returned an unexpected response. Please retry.', 502);
    return { status: response.status, type, body: await response.text() };
  } catch {
    return result('Claim relay temporarily unavailable. Please retry shortly.', 502);
  }
}
