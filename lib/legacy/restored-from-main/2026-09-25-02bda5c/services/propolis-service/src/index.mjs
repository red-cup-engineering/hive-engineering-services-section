import { loadHiveKey } from "@red-cup-engineering/key-management-services-section/hive-keystore";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { htmlRepr, jsonRepr } from "@red-cup-engineering/http-services-section/representation";
import { mergeApps } from "@red-cup-engineering/computer-web-server/compose";
import { mountAt } from "@red-cup-engineering/computer-web-server/mount-app";
import { serveScripts } from "@red-cup-engineering/computer-web-server/serve-scripts";
function expandHome(value) {
    return value === "~" ? os.homedir() : value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}
function readJsonFile(file) {
    return JSON.parse(readFileSync(file, "utf8"));
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
export function loadPropolisConfig(configPath, overrides = {}) {
    const raw = readJsonFile(configPath);
    const record = isRecord(raw) ? raw : {};
    const accounts = Array.isArray(record["accounts"])
        ? record["accounts"]
            .filter((item) => isRecord(item) && typeof item["account"] === "string")
            .map((item) => Object.freeze({ account: item.account }))
        : [];
    const configuredKeyRoot = typeof record["keyRoot"] === "string" ? record["keyRoot"] : "~/.config/blockchain/hive";
    const keyRoot = overrides.keyRoot ?? configuredKeyRoot;
    const nodes = Array.isArray(record["nodes"])
        ? record["nodes"].filter((node) => typeof node === "string")
        : undefined;
    return Object.freeze({
        name: typeof record["name"] === "string" ? record["name"] : path.basename(path.dirname(configPath)),
        accounts: Object.freeze(accounts),
        keyRoot: expandHome(keyRoot),
        ...(nodes === undefined ? {} : { nodes: Object.freeze(nodes) }),
    });
}
function readWif(keyRoot, account, role) {
    return loadHiveKey(account, role, { root: keyRoot });
}
async function loadHiveScripts() {
    try {
        const importRuntime = Function("specifier", "return import(specifier)");
        const imported = await importRuntime("@emsenn/computing-with-hive/scripts");
        const createHiveScripts = imported.createHiveScripts;
        if (typeof createHiveScripts !== "function")
            return { error: "@emsenn/computing-with-hive/scripts does not export createHiveScripts" };
        return { createHiveScripts: createHiveScripts };
    }
    catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
    }
}
function page(title, body) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body>
  <main>
${body}
  </main>
</body>
</html>`;
}
function unavailableApp(account, reason) {
    return {
        resources: [
            {
                match: "/",
                methods: ["GET"],
                produces: ["application/json"],
                handler: () => jsonRepr({ status: "unavailable", account, reason }, 503),
            },
            {
                match: "/health",
                methods: ["GET"],
                produces: ["application/json"],
                handler: () => jsonRepr({ status: "unavailable", account, reason }, 503),
            },
        ],
    };
}
export async function createPropolisApp(options) {
    const config = loadPropolisConfig(options.configPath, { keyRoot: options.keyRoot });
    const hive = await loadHiveScripts();
    const hiveStatus = "error" in hive ? "unavailable" : "ok";
    const hiveReason = "error" in hive ? hive.error : undefined;
    const baseApp = {
        resources: [
            {
                match: "/",
                methods: ["GET"],
                produces: ["text/html", "application/json"],
                handler: (ctx) => {
                    const body = {
                        kind: "propolis.instance",
                        name: config.name,
                        publicBaseUrl: options.publicBaseUrl.replace(/\/$/, ""),
                        status: hiveStatus,
                        accounts: config.accounts.map((entry) => entry.account),
                        stateDir: options.stateDir,
                        logDir: options.logDir,
                        ...(hiveReason === undefined ? {} : { reason: hiveReason }),
                    };
                    if (ctx.negotiatedType === "application/json")
                        return jsonRepr(body);
                    const items = config.accounts.map((entry) => `<li><a href="/agents/${entry.account}">${entry.account}</a></li>`).join("\n");
                    return htmlRepr(page(`${config.name} Propolis`, `    <h1>${config.name} Propolis</h1>
    <p>Status: ${hiveStatus}</p>
    <ul>
${items}
    </ul>`));
                },
            },
            {
                match: "/health",
                methods: ["GET"],
                produces: ["application/json"],
                handler: () => jsonRepr({
                    status: hiveStatus,
                    name: config.name,
                    accounts: config.accounts.length,
                    stateDir: options.stateDir,
                    logDir: options.logDir,
                    ...(hiveReason === undefined ? {} : { reason: hiveReason }),
                }, hiveStatus === "ok" ? 200 : 503),
            },
            {
                match: "/agents",
                methods: ["GET"],
                produces: ["application/json"],
                handler: () => jsonRepr({
                    agents: config.accounts.map((entry) => ({
                        account: entry.account,
                        postingKey: readWif(config.keyRoot, entry.account, "posting") !== undefined,
                        activeKey: readWif(config.keyRoot, entry.account, "active") !== undefined,
                    })),
                }),
            },
        ],
    };
    const agentApps = config.accounts.map((entry) => {
        if ("error" in hive)
            return mountAt(`/agents/${entry.account}`, unavailableApp(entry.account, hive.error));
        const scripts = hive.createHiveScripts({
            account: entry.account,
            postingKey: readWif(config.keyRoot, entry.account, "posting"),
            activeKey: readWif(config.keyRoot, entry.account, "active"),
            ...(config.nodes === undefined ? {} : { nodes: config.nodes }),
        });
        return mountAt(`/agents/${entry.account}`, serveScripts(scripts));
    });
    return mergeApps(baseApp, ...agentApps);
}
