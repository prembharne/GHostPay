import { createPublicClient, getAddress, http, parseAbi, type Address } from 'viem';
const abi = parseAbi([
  'function decimals() view returns (uint8)', 'function description() view returns (string)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);
export interface OracleFeed { answer: bigint; decimals: number; updatedAt: bigint; roundId: bigint; answeredInRound: bigint; description: string }
export function validateOracleFeed(feed: OracleFeed, pair: string, now: bigint, maxAge: bigint) {
  if (feed.description.replace(/\s/g, '').toUpperCase() !== pair || feed.decimals < 0 || feed.decimals > 18 || feed.answer <= 0n || feed.roundId === 0n || feed.answeredInRound < feed.roundId || feed.updatedAt === 0n || feed.updatedAt > now || now - feed.updatedAt > maxAge) throw new Error('Oracle returned an invalid or stale round.');
}
export function oracleRate(inr: OracleFeed, usdc: OracleFeed, now: bigint, inrMaxAge: bigint, usdcMaxAge: bigint) {
  validateOracleFeed(inr, 'INR/USD', now, inrMaxAge); validateOracleFeed(usdc, 'USDC/USD', now, usdcMaxAge);
  const usdScale = 10n ** BigInt(usdc.decimals);
  if (usdc.answer * 100n < usdScale * 95n || usdc.answer * 100n > usdScale * 105n) throw new Error('USDC price is outside the allowed peg range.');
  const rate = usdc.answer * 10n ** BigInt(inr.decimals) * 1_000_000n / (inr.answer * usdScale);
  if (rate < 50_000_000n || rate > 200_000_000n) throw new Error('Oracle rate is outside the sandbox limits.');
  return rate;
}
export async function chainlinkQuote(env: Record<string, string | undefined>, now = BigInt(Math.floor(Date.now() / 1000))) {
  const { P2P_ORACLE_RPC_URL: rpc, P2P_INR_USD_FEED: inrAddress, P2P_USDC_USD_FEED: usdcAddress } = env;
  // Feed addresses and heartbeat limits must be reviewed against the operator's
  // official catalog. No guessed feed address or fabricated live-price fallback.
  if (!rpc || !inrAddress || !usdcAddress || !env.P2P_INR_MAX_AGE || !env.P2P_USDC_MAX_AGE) return { configured: false as const, reason: 'Live oracle is not configured. Sandbox uses an illustrative rate.' };
  if (!rpc.startsWith('https://') || env.P2P_ORACLE_CHAIN_ID !== '137') throw new Error('Configure a reviewed Polygon oracle source.');
  const age = (value: string) => { if (!/^\d{1,6}$/.test(value) || BigInt(value) < 60n || BigInt(value) > 172800n) throw new Error('Invalid oracle heartbeat limit.'); return BigInt(value); };
  const inrMaxAge = age(env.P2P_INR_MAX_AGE); const usdcMaxAge = age(env.P2P_USDC_MAX_AGE);
  const client = createPublicClient({ transport: http(rpc, { timeout: 6500, retryCount: 0 }) });
  if (await client.getChainId() !== 137) throw new Error('Oracle RPC chain mismatch.');
  async function readFeed(address: Address): Promise<OracleFeed> {
    const [decimals, description, round] = await Promise.all([
      client.readContract({ address, abi, functionName: 'decimals' }), client.readContract({ address, abi, functionName: 'description' }), client.readContract({ address, abi, functionName: 'latestRoundData' }),
    ]);
    return { decimals, description, roundId: round[0], answer: round[1], updatedAt: round[3], answeredInRound: round[4] };
  }
  const inrFeed = getAddress(inrAddress); const usdcFeed = getAddress(usdcAddress);
  const [inr, usdc] = await Promise.all([readFeed(inrFeed), readFeed(usdcFeed)]);
  const rateMicros = oracleRate(inr, usdc, now, inrMaxAge, usdcMaxAge);
  const expiresAt = [now + 60n, inr.updatedAt + inrMaxAge, usdc.updatedAt + usdcMaxAge].reduce((a,b) => a < b ? a : b);
  return { configured: true as const, source: 'Chainlink reference feeds', sourceChainId: 137, settlementChainId: 11155111, rateMicros: rateMicros.toString(), fetchedAt: Number(now), expiresAt: Number(expiresAt), inr: { feed: inrFeed, round: inr.roundId.toString(), updatedAt: Number(inr.updatedAt) }, usdc: { feed: usdcFeed, round: usdc.roundId.toString(), updatedAt: Number(usdc.updatedAt) }, indicativeOnly: true, testTokensHaveNoValue: true };
}
