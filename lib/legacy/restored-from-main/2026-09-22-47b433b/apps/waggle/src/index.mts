/**
 * @emsenn/waggle — the Hive+ledger compound app.
 *
 * waggle gives a person an offline, codified, multidimensionally-witnessed
 * record of what is in their Hive wallet, and owns the local key store. It
 * composes two single-scope computers — @emsenn/computing-with-hive (chain
 * reads/writes + key math) and @emsenn/ledger-computer (double-entry
 * booking) — per the ruling that fun-named packages are compounds over
 * single-scope computers.
 *
 * This module re-exports the key store (./keystore), its at-rest encryption
 * (./crypto), and the sync pipeline (./sync). The CLI (./cli) drives them.
 */
export {
  encryptSecret, decryptSecret, cryptoSelfTest,
} from "./crypto.mjs";

export {
  KEYSTORE_ROLES, defaultKeystoreRoot, keystoreDir,
  setKey, loadKey, listKeys, roleStatus,
} from "./keystore.mjs";
export type {
  KeystoreRole, KeyForm, KeyListing, RoleStatus,
  SetKeyOptions, LoadKeyOptions,
} from "./keystore.mjs";

export {
  syncAccount, loadBalances,
  serializeLedger, deserializeLedger, renderBalances, renderSummary,
} from "./sync.mjs";
export type {
  SyncOptions, SyncResult, PersistedLedger,
} from "./sync.mjs";
