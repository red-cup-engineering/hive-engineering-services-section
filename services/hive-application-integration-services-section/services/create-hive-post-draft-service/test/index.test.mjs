import assert from "node:assert/strict";
import test from "node:test";
import { createHivePostDraft } from "../src/index.mjs";

test("creates a review-only post with an image-upload marker", () => {
  const draft = createHivePostDraft({ account: "cassia-lorne", title: "Routine Read — 2026-07-17", body: "A reading.", tags: ["divination", "hive"], dateIso: "2026-07-17", imagePath: "/tmp/read.jpg" });
  assert.equal(draft.status, "awaiting-manual-approval");
  assert.equal(draft.permlink, "routine-read-2026-07-17");
  assert.match(draft.body, /TODO: upload \/tmp\/read\.jpg/u);
});
