// rpc — JSON-RPC 2.0 transport + node failover for Hive.
// Envelope: { jsonrpc:"2.0", method:"<api>.<method>", params:<array|object>, id:<number> }.
// Retries across all nodes up to two full passes before giving up.
import https from "node:https";

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

export type RpcTransport = (url: string, body: unknown) => Promise<{ status: number; body: string }>;

function httpsTransport(timeout: number | undefined): RpcTransport {
  return (url, bodyObject) =>
    new Promise((resolve, reject) => {
      const payload = Buffer.from(JSON.stringify(bodyObject), "utf8");
      const u = new URL(url);
      const req = https.request(
        {
          hostname: u.hostname,
          port: u.port || 443,
          path: u.pathname + u.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": payload.length,
          },
          timeout,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("request timeout")); });
      req.write(payload);
      req.end();
    });
}

export interface RpcClientOptions {
  readonly nodes?: readonly string[] | undefined;
  readonly timeout?: number | undefined;
  readonly transport?: RpcTransport | undefined;
}

export class RpcClient {
  private readonly nodes: readonly string[];
  private readonly transport: RpcTransport;
  private _id = 0;

  constructor({ nodes = DEFAULT_NODES, timeout, transport }: RpcClientOptions = {}) {
    this.nodes = nodes;
    this.transport = transport ?? httpsTransport(timeout);
  }

  async call<T = unknown>(method: string, params: unknown[] | Record<string, unknown>): Promise<T> {
    const id = ++this._id;
    const envelope = { jsonrpc: "2.0", method, params, id };
    const maxAttempts = this.nodes.length * 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const nodeIndex = attempt % this.nodes.length;
      const url = this.nodes[nodeIndex]!;
      try {
        const { status, body } = await this.transport(url, envelope);
        if (status < 200 || status >= 300) {
          lastError = new Error(`HTTP ${status} from ${url}`);
          continue;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(body) as unknown;
        } catch {
          lastError = new Error(`unparseable response from ${url}`);
          continue;
        }
        const resp = parsed as Record<string, unknown>;
        if (resp["error"] != null) {
          const err = resp["error"] as Record<string, unknown>;
          lastError = new Error(`RPC error ${err["code"] ?? ""}: ${err["message"] ?? JSON.stringify(err)}`);
          continue;
        }
        return resp["result"] as T;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastError ?? new Error("all RPC nodes failed");
  }
}
