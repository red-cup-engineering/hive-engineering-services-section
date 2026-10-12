import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrivateKey } from "@red-cup-engineering/hive-blockchain-client-service/keys.mjs";
import { sha256 } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/hash";
import { verifyHiveSignedMessage } from "@red-cup-engineering/verify-hive-signed-message-service";
import { createHiveLoginApp } from "../src/index.mjs";
import { readHiveLoginNonces } from "../src/nonce.mjs";

test("signed account proof, persisted nonce and host admission compose before session establishment", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "rowan-hive-browser-"));
  const key = new PrivateKey(Buffer.alloc(32, 1)); // disposable fixture, never a wallet
  const pub = key.createPublic().toString();
  const nodes = ["https://first.example", "https://second.example"];
  let admitted = false, sessions = 0;
  const transport = async (_url, envelope) => ({ status: 200, body: JSON.stringify({
    jsonrpc: "2.0", id: envelope.id, result: [{ posting: { key_auths: [[pub, 1]] }, active: { key_auths: [] } }],
  }) });
  const app = createHiveLoginApp({ appName: "fixture-world", stateDir,
    registry: { isHiveAdmitted: account => admitted && account === "fixture" },
    browser: { validSession: () => null, mintHiveChallengeCookie: nonce => nonce,
      hiveChallengeFrom: headers => headers.cookie, clearHiveChallengeCookie: () => "clear",
      establishHiveSession: () => { sessions++; return { cookieHeader: "fixture-session" }; } },
    verify: request => verifyHiveSignedMessage({ ...request, nodes }, { transport }),
    htmlRepr: (body, options) => ({ body, ...options }), jsonRepr: (body, options) => ({ body, ...options }),
    readJsonBody: async req => req.body, renderLoginPage: (_title, body) => body,
  });
  const [login, callback] = app.resources;
  const attempt = async () => {
    const page = login.handler({ req: { headers: {} }, url: new URL("https://fixture.example/login/hive") });
    const nonce = page.headers["set-cookie"];
    assert.ok(readHiveLoginNonces(stateDir)[nonce]);
    const message = JSON.stringify({ app: "fixture-world", type: "login", username: "fixture", nonce });
    const signature = key.sign(sha256(Buffer.from(message))).toString("hex");
    const ctx = { req: { headers: { cookie: nonce, accept: "application/json" },
      body: { account: "fixture", message, signature, nonce } } };
    return { ctx, result: await callback.handler(ctx), nonce };
  };
  try {
    const refused = await attempt();
    assert.equal(refused.result.status, 403);
    assert.equal(sessions, 0);
    assert.equal(readHiveLoginNonces(stateDir)[refused.nonce], undefined);
    admitted = true;
    const accepted = await attempt();
    assert.equal(accepted.result.body.authenticated, true);
    assert.equal(sessions, 1);
    assert.equal((await callback.handler(accepted.ctx)).status, 403);
    assert.equal(sessions, 1);
  } finally { await rm(stateDir, { recursive: true, force: true }); }
});
