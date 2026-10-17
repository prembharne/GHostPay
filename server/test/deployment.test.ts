import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { type PublicClient, type Hex } from 'viem';
import { DeploymentRegistry } from '../src/deployment.js';
import { createApp } from '../src/app.js';

describe('Sepolia deployment registration (mock RPC unit tests)', () => {
  const dirs: string[] = [];
  const hash = `0x${'ab'.repeat(32)}` as Hex;
  const blockHash = `0x${'cd'.repeat(32)}` as Hex;
  const contract = '0x1111111111111111111111111111111111111111';
  async function fixture(overrides: Record<string, unknown> = {}) {
    const dir = await mkdtemp(join(tmpdir(), 'ghostpay-sepolia-')); dirs.push(dir);
    const state = { chainId: 11155111, to: null, input: '0x6000', status: 'success', head: 11n, receiptHash: blockHash, canonicalHash: blockHash, ...overrides };
    const client = {
      getChainId: async () => state.chainId,
      getTransaction: async () => ({ to: state.to, input: state.input }),
      getTransactionReceipt: async () => ({ status: state.status, contractAddress: contract, blockNumber: 10n, blockHash: state.receiptHash }),
      getBlockNumber: async () => state.head,
      getBlock: async () => ({ hash: state.canonicalHash }),
      getBytecode: async () => '0x6001',
    } as unknown as PublicClient;
    const path = join(dir, 'sepolia.json'); const registry = new DeploymentRegistry(client, '0x6000', path);
    return { registry, path, state, client };
  }
  after(async () => { for (const dir of dirs) { await unlink(join(dir, 'sepolia.json')).catch(error => { if (error.code !== 'ENOENT') throw error; }); await rmdir(dir); } });
  it('starts in setup mode and blocks claims until configured', async () => {
    const { registry, client } = await fixture(); await registry.load(); assert.equal(registry.current.configured, false);
    const server = createApp(client, registry.current, 'http://localhost:5173', { registry, bytecode: '0x6000' }).listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const base = `http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
      const config = await fetch(`${base}/deployment`).then(r => r.json()); assert.equal(config.chainId, 11155111); assert.equal(config.configured, false);
      assert.equal((await fetch(`${base}/requests`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' })).status, 503);
      const artifact = await fetch(`${base}/deployment/artifact`).then(r => r.json()); assert.equal(artifact.bytecode, '0x6000');
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it('rejects malformed hashes and regular transfers', async () => { const x = await fixture({ to: contract }); await assert.rejects(x.registry.register('bad'), /valid Sepolia/); await assert.rejects(x.registry.register(hash), /create a contract/); });
  it('rejects a contract created from different bytecode', async () => { const x = await fixture({ input: '0x6002' }); await assert.rejects(x.registry.register(hash), /compiled GhostPayEscrow/); });
  it('rejects a failed creation receipt', async () => { const x = await fixture({ status: 'reverted' }); await assert.rejects(x.registry.register(hash), /successfully create/); });
  it('rejects a non-Sepolia RPC', async () => { const x = await fixture({ chainId: 1 }); await assert.rejects(x.registry.register(hash), /must be Ethereum Sepolia/); });
  it('requires two confirmations and a canonical receipt block', async () => {
    const x = await fixture({ head: 10n }); await assert.rejects(x.registry.register(hash), /two Sepolia confirmations/);
    x.state.head = 11n; x.state.canonicalHash = `0x${'ee'.repeat(32)}`; await assert.rejects(x.registry.register(hash), /no longer canonical/);
  });
  it('persists verified data, loads it, and supports idempotent registration', async () => {
    const x = await fixture(); const result = await x.registry.register(hash); assert.equal(result.address, contract); assert.equal(result.chainId, 11155111); assert.equal(result.blockNumber, '10'); assert.equal(result.configured, true);
    assert.deepEqual(JSON.parse(await readFile(x.path, 'utf8')), result); assert.equal(await x.registry.register(hash), x.registry.current);
    const reloaded = new DeploymentRegistry(x.client, '0x6000', x.path); await reloaded.load(); assert.deepEqual(reloaded.current, result);
  });
  it('does not allow another contract to replace an existing deployment', async () => {
    const x = await fixture(); await x.registry.register(hash); await assert.rejects(x.registry.register(`0x${'ef'.repeat(32)}`), /already has a deployment/); assert.equal(x.registry.current.transactionHash, hash);
  });
});
