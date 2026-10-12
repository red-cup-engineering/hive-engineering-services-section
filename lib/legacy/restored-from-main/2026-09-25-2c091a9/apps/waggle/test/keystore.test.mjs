import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrivateKey } from '@red-cup-engineering/hive-blockchain-client-service/keys.mjs';
import { setKey, loadKey, roleStatus } from '../src/keystore.mjs';

test('shared Hive keys survive encrypted storage and reject wrong passphrases', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'waggle-fixture-'));
  try {
    const wif = new PrivateKey(Buffer.from('00'.repeat(31) + '01', 'hex')).toWif();
    setKey('fixture', 'active', wif, { root, encrypt: true, passphrase: 'fixture passphrase' });
    assert.equal(loadKey('fixture', 'active', { root, passphrase: 'fixture passphrase' }), wif);
    assert.throws(() => loadKey('fixture', 'active', { root, passphrase: 'incorrect' }));
    assert.equal(statSync(path.join(root, 'fixture/active.wif.enc')).mode & 0o777, 0o600);
    assert.equal(roleStatus('fixture', root).active, 'encrypted');
    assert.throws(() => setKey('fixture', 'active', wif, { root }), /encrypted.*already exists/);
    const result = spawnSync(process.execPath, [new URL('../src/cli.mjs', import.meta.url).pathname, 'key', 'status', 'fixture'], { encoding: 'utf8', env: { ...process.env, WAGGLE_ROOT: root } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /active: encrypted/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
