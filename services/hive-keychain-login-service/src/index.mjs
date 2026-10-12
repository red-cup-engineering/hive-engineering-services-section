import { verifyHiveSignedMessage } from "@red-cup-engineering/verify-hive-signed-message-service";
import { consumeHiveLoginNonce, mintHiveLoginNonce } from "./nonce.mjs";

const APP_NAME = "bare-cedar-fog.561.group";
const CHALLENGE_TTL_MS = 300_000;

// No external assets: window.hive_keychain is injected asynchronously after
// `load` (README cites hive-keychain/keychain-sdk-playground), so detection
// waits for `load` then polls rather than testing at parse time.
function hiveLoginPageHtml({ nonce, expiry, renderLoginPage, appName, paths }) {
  return renderLoginPage(`Sign in with Hive Keychain — ${appName}`, "<h1>Sign in with Hive Keychain</h1>"
    + "<p id=\"hive-login-status\" role=\"status\" aria-live=\"polite\">Checking for the Hive Keychain browser extension…</p>"
    + "<form id=\"hive-login-form\" style=\"display:none\">"
    + "<label for=\"hive-login-account\">Hive account</label> "
    + "<input id=\"hive-login-account\" name=\"account\" autocomplete=\"username\" required />"
    + " <button type=\"submit\" disabled>Sign in</button>"
    + "</form>"
    + `<p><a href="${paths.login}">Start a new sign-in attempt</a></p>`
    + `<p><a href="${paths.chooser}">Other sign-in methods</a></p>`
    + "<script>(function () {"
    + `var nonce = ${JSON.stringify(nonce)};`
    + `var expiry = ${JSON.stringify(expiry)};`
    + `var app = ${JSON.stringify(appName)};`
    + `var callback = ${JSON.stringify(paths.callback)};`
    + "var status = document.getElementById(\"hive-login-status\");"
    + "var form = document.getElementById(\"hive-login-form\");"
    + "var submitButton = form.querySelector(\"button[type=submit]\");"
    + "function fail(text) { status.textContent = text; }"
    + "var POLL_INTERVAL_MS = 100;"
    + "var POLL_TIMEOUT_MS = 3000;"
    + "function pollForKeychain(elapsedMs) {"
    + "if (window.hive_keychain) {"
    + "status.textContent = \"Enter your Hive account and approve the signature request in Keychain.\";"
    + "form.style.display = \"\";"
    + "submitButton.disabled = false;"
    + "return;"
    + "}"
    + "if (elapsedMs >= POLL_TIMEOUT_MS) {"
    + "fail(\"Hive Keychain extension not detected after 3 s. Install it from https://hive-keychain.com and reload this page.\");"
    + "return;"
    + "}"
    + "setTimeout(function () { pollForKeychain(elapsedMs + POLL_INTERVAL_MS); }, POLL_INTERVAL_MS);"
    + "}"
    + "if (document.readyState === \"complete\") { pollForKeychain(0); }"
    + "else { window.addEventListener(\"load\", function () { pollForKeychain(0); }); }"
    + "form.addEventListener(\"submit\", function (event) {"
    + "event.preventDefault();"
    + "if (submitButton.disabled) return;"
    + "if (!window.hive_keychain) { fail(\"Hive Keychain extension not detected after 3 s. Install it from https://hive-keychain.com and reload this page.\"); return; }"
    + "var account = document.getElementById(\"hive-login-account\").value.trim().toLowerCase();"
    + "if (!account) return;"
    + "if (Date.now() >= expiry * 1000) { fail(\"This challenge expired. Start a new sign-in attempt below.\"); submitButton.disabled = true; return; }"
    + "var message = JSON.stringify({ username: account, type: \"login\", app: app, expiry: expiry, nonce: nonce });"
    + "status.textContent = \"Waiting for Keychain…\";"
    + "submitButton.disabled = true;"
    + "try {"
    + "window.hive_keychain.requestSignBuffer(account, message, \"Posting\", function (response) {"
    + "if (!response || !response.success) {"
    + "fail(\"Keychain refused the signature request\" + (response && response.message ? (\": \" + response.message) : \".\"));"
    + "submitButton.disabled = false;"
    + "return;"
    + "}"
    + "status.textContent = \"Signature approved. Verifying your Hive account…\";"
    + "var controller = new AbortController();"
    + "var timeout = setTimeout(function () { controller.abort(); }, 25000);"
    + "fetch(callback, {"
    + "method: \"POST\","
    + "headers: { \"content-type\": \"application/json\", \"accept\": \"application/json\" },"
    + "credentials: \"same-origin\", signal: controller.signal,"
    + "body: JSON.stringify({ account: account, message: message, signature: response.result, publicKey: response.publicKey, nonce: nonce }),"
    + "}).then(function (res) {"
    + "return res.json().then(function (body) {"
    + "if (res.ok && body.authenticated === true && typeof body.redirect === \"string\" && body.redirect.charAt(0) === \"/\" && body.redirect.charAt(1) !== \"/\") { window.location = body.redirect; return; }"
    + "fail(((body && body.reason) || \"Sign-in was refused.\") + \" Start a new sign-in attempt below.\");"
    + "});"
    + "}).catch(function (error) {"
    + "fail((error.name === \"AbortError\" ? \"Account verification timed out.\" : \"Could not complete account verification.\") + \" Start a new sign-in attempt below.\");"
    + "}).finally(function () { clearTimeout(timeout); });"
    + "});"
    + "} catch (error) { fail(\"Keychain could not start the signature request. Try again.\"); submitButton.disabled = false; }"
    + "});"
    + "})();</script>"
    );
}

/**
 * The `/login/hive` and `/login/hive/callback` browser resources: a
 * server-rendered Keychain `signBuffer` challenge page, and the callback
 * that verifies the returned envelope and — for an admitted Hive
 * account — establishes the same browser session cookie the Google flow
 * establishes.
 *
 * @param {{
 *   stateDir: string,
 *   registry: { isHiveAdmitted: (account: string) => boolean },
 *   browser: { validSession: (headers: object) => object | null, establishHiveSession: (account: string) => { cookieHeader: string }, mintHiveChallengeCookie: (nonce: string, ttlMs: number) => string, hiveChallengeFrom: (headers: object) => string | null, clearHiveChallengeCookie: () => string },
 *   verify?: typeof verifyHiveSignedMessage,
 *   now?: () => number,
 *   mintNonce?: typeof mintHiveLoginNonce,
 *   consumeNonce?: typeof consumeHiveLoginNonce,
 * }} params
 * @returns {{ resources: object[] }}
 */
export function createHiveLoginApp({
  appName = APP_NAME,
  home = "/network",
  paths: offeredPaths = {},
  stateDir,
  registry,
  browser,
  verify = verifyHiveSignedMessage,
  now = Date.now,
  mintNonce = mintHiveLoginNonce,
  consumeNonce = consumeHiveLoginNonce,
  htmlRepr,
  jsonRepr,
  readJsonBody,
  renderLoginPage,
}) {
  if (typeof htmlRepr !== "function" || typeof jsonRepr !== "function" || typeof readJsonBody !== "function" || typeof renderLoginPage !== "function") {
    throw new TypeError("Hive Keychain login requires HTTP representation, body-reading, and page-rendering functions");
  }
  const paths = { login: "/login/hive", callback: "/login/hive/callback", chooser: "/login", ...offeredPaths };
  const returnTo = (headers) => browser.hiveReturnTo?.(headers) ?? home;
  return {
    resources: [
      {
        id: "ops-browser.login-hive",
        match: paths.login,
        methods: ["GET"],
        produces: ["text/html"],
        handler: (ctx) => {
          const offered = ctx.url?.searchParams.get("return_to");
          const target = typeof offered === "string" && offered.startsWith("/") && !offered.startsWith("//") ? offered : home;
          if (browser.validSession(ctx.req.headers)) return { status: 303, headers: { location: target }, cacheControl: { noStore: true } };
          const { nonce, expiresAt } = mintNonce({ stateDir, ttlMs: CHALLENGE_TTL_MS, now });
          return htmlRepr(hiveLoginPageHtml({ nonce, expiry: Math.floor(expiresAt / 1000), renderLoginPage, appName, paths }), {
            headers: { "set-cookie": browser.mintHiveChallengeCookie(nonce, CHALLENGE_TTL_MS, target) }, cacheControl: { noStore: true },
          });
        },
      },
      {
        id: "ops-browser.login-hive-callback",
        match: paths.callback,
        methods: ["POST"],
        produces: ["application/json"],
        handler: async (ctx) => {
          const refuse = (status, reason) => jsonRepr({ error: "authorization_refused", reason }, {
            status, headers: { "set-cookie": browser.clearHiveChallengeCookie() }, cacheControl: { noStore: true },
          });
          let body;
          try {
            body = await readJsonBody(ctx.req);
          } catch {
            return refuse(400, "malformed JSON body");
          }
          const { account, message, signature, publicKey, nonce } = body ?? {};
          const boundNonce = browser.hiveChallengeFrom(ctx.req.headers);
          if (typeof nonce !== "string" || boundNonce !== nonce || !consumeNonce({ stateDir, nonce, now })) {
            return refuse(403, "the login challenge is invalid, expired, or already used");
          }
          let challenge;
          try {
            challenge = JSON.parse(message);
          } catch {
            return refuse(403, "message is not the expected login challenge JSON");
          }
          if (
            challenge?.app !== appName
            || challenge?.type !== "login"
            || challenge?.nonce !== nonce
            || typeof challenge?.username !== "string"
            || challenge.username !== account
          ) {
            return refuse(403, "message does not match the minted login challenge");
          }
          let result;
          try {
            result = await verify({ account, message, signature, publicKey });
          } catch {
            return refuse(503, "Hive account verification is unavailable; start a new sign-in attempt");
          }
          if (!result.verified) return refuse(403, result.reason);
          if (!registry.isHiveAdmitted(result.account)) return refuse(403, "Hive account is not an admitted principal");
          const { cookieHeader } = browser.establishHiveSession(result.account);
          const destination = returnTo(ctx.req.headers);
          if (ctx.req.headers.accept?.split(",").some((type) => type.trim().split(";")[0] === "application/json")) {
            return jsonRepr({ authenticated: true, redirect: destination }, {
              headers: { "set-cookie": [cookieHeader, browser.clearHiveChallengeCookie()] }, cacheControl: { noStore: true },
            });
          }
          return { status: 303, headers: { location: destination, "set-cookie": [cookieHeader, browser.clearHiveChallengeCookie()] }, cacheControl: { noStore: true } };
        },
      },
    ],
  };
}
