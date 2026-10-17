// Keep countdowns moving between Ethereum blocks; on-chain timestamp checks remain authoritative.
let anchor: { number: bigint | null; timestamp: bigint; observedAt: bigint } | undefined;
export function chainNow(block: { number: bigint | null; timestamp: bigint }): bigint {
  const wall = BigInt(Math.floor(Date.now() / 1000));
  if (!anchor || anchor.number !== block.number) anchor = { number: block.number, timestamp: block.timestamp > wall ? block.timestamp : wall, observedAt: wall };
  return anchor.timestamp + (wall - anchor.observedAt);
}
