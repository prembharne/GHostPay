import { relay, MAX_BODY } from '../lib/relay.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  let body;
  try {
    if (req.method === 'POST') {
      if (Number(req.headers['content-length'] || 0) > MAX_BODY) throw Object.assign(new Error('Request is too large.'), { status: 413 });
      if (req.body !== undefined) body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      else {
        const chunks = []; let size = 0;
        for await (const chunk of req) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > MAX_BODY) throw Object.assign(new Error('Request is too large.'), { status: 413 }); chunks.push(bytes); }
        body = Buffer.concat(chunks);
      }
    }
    const path = req.query?.path ?? new URL(req.url, 'https://request.invalid').searchParams.get('path');
    const response = await relay({ method: req.method, path, origin: req.headers.origin, host: req.headers.host, contentType: req.headers['content-type'], body });
    res.statusCode = response.status; res.setHeader('Content-Type', response.type); res.end(response.body);
  } catch (error) {
    res.statusCode = error.status || 400; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.status === 413 ? 'Request is too large.' : 'Invalid request body.' }));
  }
}
