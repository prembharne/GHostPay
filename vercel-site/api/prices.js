import { createMarketService } from '../lib/market.js';
const prices = createMarketService(fetch, process.env.COINGECKO_DEMO_API_KEY);
export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Use GET.' }); }
  try { const result = await prices(); res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=45'); return res.status(200).json(result); }
  catch { res.setHeader('Cache-Control', 'no-store'); return res.status(503).json({ error: 'Live prices are temporarily unavailable. Retry or enter a native-coin amount.' }); }
}
