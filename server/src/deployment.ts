import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getAddress, isAddress, zeroAddress, type Address, type Hex, type PublicClient } from 'viem';
import { SEPOLIA_CHAIN_ID } from '../../shared/network.js';

export interface DeploymentRecord {
  address: Address; chainId: number; blockNumber: string; configured: boolean; transactionHash?: Hex;
}
export class DeploymentRegistry {
  readonly current: DeploymentRecord = { address: zeroAddress, chainId: SEPOLIA_CHAIN_ID, blockNumber: '0', configured: false };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private client: PublicClient, private bytecode: Hex, private path: string) {}
  async load() {
    let record: DeploymentRecord;
    try { record = JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    if (record.chainId !== SEPOLIA_CHAIN_ID || !isAddress(record.address) || record.address === zeroAddress || !record.transactionHash || !/^\d+$/.test(record.blockNumber)) throw new Error('Invalid saved Sepolia deployment.');
    // Recheck the original creation transaction instead of trusting a JSON address.
    const verified = await this.verify(record.transactionHash);
    if (verified.address.toLowerCase() !== record.address.toLowerCase()) throw new Error('Saved deployment does not match its on-chain receipt.');
    Object.assign(this.current, verified);
  }
  register(hash: unknown): Promise<DeploymentRecord> {
    const result = this.queue.then(async () => {
      if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw Object.assign(new Error('A valid Sepolia deployment transaction hash is required.'), { status: 400 });
      if (this.current.configured) {
        if (this.current.transactionHash?.toLowerCase() === hash.toLowerCase()) return this.current;
        throw Object.assign(new Error('This relay already has a deployment. Replacing it could hide existing deposits and is disabled.'), { status: 409 });
      }
      const verified = await this.verify(hash as Hex);
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(`${this.path}.tmp`, JSON.stringify(verified, null, 2));
      await rename(`${this.path}.tmp`, this.path);
      Object.assign(this.current, verified);
      return this.current;
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async verify(hash: Hex): Promise<DeploymentRecord> {
    if (await this.client.getChainId() !== SEPOLIA_CHAIN_ID) throw new Error('Deployment RPC must be Ethereum Sepolia.');
    const [tx, receipt, head] = await Promise.all([
      this.client.getTransaction({ hash }), this.client.getTransactionReceipt({ hash }), this.client.getBlockNumber(),
    ]);
    if (receipt.status !== 'success' || !receipt.contractAddress || tx.to !== null) throw new Error('Transaction did not successfully create a contract.');
    if (tx.input.toLowerCase() !== this.bytecode.toLowerCase()) throw new Error('Transaction does not deploy the compiled GhostPayEscrow contract.');
    if (head < receipt.blockNumber + 1n) throw new Error('Wait for two Sepolia confirmations before finishing setup.');
    const [block, code] = await Promise.all([
      this.client.getBlock({ blockNumber: receipt.blockNumber }),
      this.client.getBytecode({ address: receipt.contractAddress }),
    ]);
    if (block.hash !== receipt.blockHash || !code || code === '0x') throw new Error('Deployment is missing or no longer canonical on Sepolia.');
    return { address: getAddress(receipt.contractAddress), chainId: SEPOLIA_CHAIN_ID, blockNumber: String(receipt.blockNumber), configured: true, transactionHash: hash };
  }
}
