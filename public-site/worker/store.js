export class RequestStore {
  constructor(db, deployment) { this.db = db; this.deployment = deployment; }
  record(row) {
    if (!row) return null;
    return { id: row.id, paymentId: row.payment_id, chainId: row.chain_id, contract: row.contract, recipient: row.recipient,
      status: row.status, createdAt: row.created_at, ...(row.deadline ? { deadline: row.deadline } : {}),
      ...(row.signature ? { signature: row.signature } : {}), version: row.version };
  }
  async get(id) { return this.record(await this.db.prepare('SELECT * FROM claim_requests WHERE id = ? AND chain_id = ? AND contract = ?').bind(id, this.deployment.chainId, this.deployment.address.toLowerCase()).first()); }
  async list(paymentId) {
    const { results } = await this.db.prepare('SELECT * FROM claim_requests WHERE payment_id = ? AND chain_id = ? AND contract = ? ORDER BY created_at, id').bind(paymentId, this.deployment.chainId, this.deployment.address.toLowerCase()).all();
    return results.map(row => this.record(row));
  }
  async create(paymentId, recipient) {
    await this.db.prepare('INSERT INTO claim_requests (id, payment_id, chain_id, contract, recipient, status, created_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, 0) ON CONFLICT (chain_id, contract, payment_id, recipient) DO NOTHING')
      .bind(crypto.randomUUID(), paymentId, this.deployment.chainId, this.deployment.address.toLowerCase(), recipient.toLowerCase(), 'pending', Date.now()).run();
    return (await this.list(paymentId)).find(r => r.recipient === recipient.toLowerCase());
  }
  async update(record, status, deadline = null, signature = null) {
    const row = await this.db.prepare('UPDATE claim_requests SET status = ?, deadline = ?, signature = ?, version = version + 1 WHERE id = ? AND chain_id = ? AND contract = ? AND version = ? RETURNING *')
      .bind(status, deadline, signature, record.id, this.deployment.chainId, this.deployment.address.toLowerCase(), record.version).first();
    if (!row) throw Object.assign(new Error('Request has already been handled. Refresh before retrying.'), { status: 409 });
    return this.record(row);
  }
}
