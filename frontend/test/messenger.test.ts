import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreview, parsePayment, validateHomeserver } from '../src/messenger/model.ts';
const contract = '0x3F5632eDFcbF22D7CFF126106854a6700Ffd7bF4';
test('payment cards accept a bounded Sepolia reference without trusting amount or status text', () => {
  const input = { version: 1, chainId: 11155111, contract, paymentId: '1', amount: '1000', status: 'claimed' };
  assert.deepEqual(parsePayment(input), { version: 1, chainId: 11155111, contract, paymentId: '1' });
  for (const paymentId of ['0', '-1', '1.2', '01', '1<script>', String(2n ** 256n)]) assert.equal(parsePayment({ ...input, paymentId }), undefined);
});
test('payment references reject other chains, invalid addresses, versions and shapes', () => {
  const input = { version: 1, chainId: 11155111, contract, paymentId: '1' };
  for (const patch of [{ chainId: 1 }, { chainId: 31337 }, { contract: 'https://evil.example' }, { contract: '0x1' }, { version: 3 }, { paymentId: 1 }]) assert.equal(parsePayment({ ...input, ...patch }), undefined);
  assert.equal(parsePayment(null), undefined); assert.equal(parsePayment('1'), undefined);
});
test('homeserver configuration only accepts secure origins and explicit loopback development', () => {
  assert.equal(validateHomeserver('https://matrix.example.com/'), 'https://matrix.example.com');
  assert.equal(validateHomeserver('http://localhost:8008'), 'http://localhost:8008');
  for (const url of ['http://matrix.example.com', 'javascript:alert(1)', 'https://user:password@matrix.example.com', 'https://matrix.example.com/path', 'https://matrix.example.com?token=secret', 'https://matrix.example.com#fragment']) assert.throws(() => validateHomeserver(url));
});
test('design preview is explicitly local and contains no fabricated funded payment reference', () => {
  const preview = createPreview(); assert.ok(preview.rooms.length > 0);
  for (const room of preview.rooms) assert.equal(room.encrypted, false);
  const messages = Object.values(preview.messages).flat(); assert.ok(messages.some(m => m.previewPayment));
  for (const message of messages) { assert.equal(message.state, 'local'); assert.equal(message.payment, undefined); }
});
