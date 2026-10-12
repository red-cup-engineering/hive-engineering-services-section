// rpc — JSON-RPC 2.0 transport + node failover for Hive (spec docs/dev/notes/03-rpc-read-spec.md).
// HTTP exchanges use the shared bounded JSON-RPC transport. A `transport` may be injected for offline testing.
//
// Envelope (spec §1): { jsonrpc:"2.0", method:"<api>.<method>", params:<array|object>, id:<number> }.
// Errors surface three ways (spec §2): (1) network/transport failure, (2) non-2xx HTTP,
// (3) a JSON-RPC `error` object on HTTP 200. We retry-next-node on all of them, plus on an
// unparseable body. We do up to two full passes over the node list before giving up.

import { createJsonRpcTransport, callJsonRpc } from "@red-cup-engineering/json-rpc-transport-service";

// spec §3 — curated public mainnet API node base URLs.
export const DEFAULT_NODES = [
  "https://api.hive.blog",
  "https://api.deathwing.me",
  "https://api.openhive.network",
  "https://anyx.io",
  "https://hive-api.arcange.eu",
  "https://techcoderx.com",
  "https://rpc.mahdiyari.info",
  "https://api.c0ff33a.uk",
];

export class RpcClient {
  // passes: full sweeps of the node list per call (default 2); backoffMs: the pause before sweep k is k·backoffMs.
  constructor({ nodes = DEFAULT_NODES, timeout = 8000, transport, fetch, passes = 2, backoffMs = 0 } = {}) {
    this.nodes = Array.isArray(nodes) && nodes.length ? [...nodes] : [...DEFAULT_NODES];
    this.timeout = timeout;
    this.passes = passes;
    this.backoffMs = backoffMs;
    // An injected transport, or one over an injected fetch, for offline use; else real https.
    this.transport = transport || createJsonRpcTransport({ timeout, ...(fetch ? { fetchImpl: fetch } : {}) });
    this._id = 0; // numeric id, incremented per call
    this._start = 0; // round-robin start index, rotated per call so load spreads
  }

  // Build the JSON-RPC 2.0 envelope. Testable in isolation.
  buildEnvelope(method, params) {
    return { jsonrpc: "2.0", method, params, id: ++this._id };
  }

  // POST `method`/`params` to nodes in order from a rotating start, with failover.
  // Returns the JSON-RPC `result`; throws carrying the last error/message if all nodes fail.
  async call(method, params) {
    const envelope = this.buildEnvelope(method, params);
    const n = this.nodes.length;
    const start = this._start;
    this._start = (this._start + 1) % n; // rotate starting node for the next call

    let lastError = null;
    // Full passes over the node list (spec §2: one pass, then a second), pausing between passes.
    for (let pass = 0; pass < this.passes; pass++) {
      if (pass > 0 && this.backoffMs > 0) await new Promise((resolve) => setTimeout(resolve, this.backoffMs * pass));
      for (let i = 0; i < n; i++) {
        const url = this.nodes[(start + i) % n];
        try {
          return await callJsonRpc(this.transport, url, envelope);
        } catch (err) {
          // (1) network/transport failure → next node.
          lastError = err;
          continue;
        }
      }
    }
    const err = new Error(
      `All ${n} nodes failed for ${method}: ${lastError ? lastError.message : "unknown error"}`,
    );
    err.lastError = lastError;
    if (lastError && lastError.rpcError) err.rpcError = lastError.rpcError;
    throw err;
  }

  // The same request to every node, one attempt each: [{ node, result } | { node, error }].
  async each(method, params) {
    return Promise.all(this.nodes.map(async (node) => {
      try {
        return { node, result: await callJsonRpc(this.transport, node, this.buildEnvelope(method, params)) };
      } catch (error) {
        return { node, error };
      }
    }));
  }

  // A read at least `quorum` nodes answer identically (compared after `project`); throws when
  // too few answer or any two answers differ. Cross-checks a read that decides money.
  async consensus(method, params, { quorum = Math.min(2, this.nodes.length), project = (value) => value } = {}) {
    const answers = (await this.each(method, params)).filter((a) => !("error" in a));
    if (answers.length < quorum) throw new Error(`${method}: ${answers.length} of ${this.nodes.length} nodes answered, ${quorum} required`);
    const canonical = JSON.stringify(project(answers[0].result));
    const dissent = answers.find((a) => JSON.stringify(project(a.result)) !== canonical);
    if (dissent) throw new Error(`${method}: ${answers[0].node} and ${dissent.node} disagree`);
    return answers[0].result;
  }
}
