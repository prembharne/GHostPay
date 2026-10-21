import { chainlinkQuote } from '../lib/p2p-oracle.js';
export const config = { maxDuration: 25 };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  try { const quote = await chainlinkQuote(process.env); return res.status(quote.configured ? 200 : 503).json(quote); }
  catch { return res.status(503).json({ configured: false, reason: 'Oracle verification failed. Live quotes are unavailable.' }); }
}
