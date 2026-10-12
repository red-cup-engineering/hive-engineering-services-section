import { slugify } from "@red-cup-engineering/computer-text-content-engineering-services-section/slugify-text";

/** Create a review-only post carrier. This function has no signing, network, or broadcast effect. */
export function createHivePostDraft({ account, title, body, tags, dateIso, imagePath }) {
  if (typeof account !== "string" || !/^[a-z][a-z0-9.-]{2,15}$/u.test(account)) throw new TypeError("Hive draft account is invalid");
  if (typeof title !== "string" || !title.trim() || typeof body !== "string") throw new TypeError("Hive draft title and body are required");
  if (!Array.isArray(tags) || tags.length === 0 || !tags.every((tag) => typeof tag === "string" && tag.trim())) throw new TypeError("Hive draft tags are required");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dateIso)) throw new TypeError("Hive draft date must be YYYY-MM-DD");
  const titleSlug = slugify(title);
  if (!titleSlug) throw new TypeError("Hive draft title has no permlink characters");
  const permlink = titleSlug.endsWith(dateIso) ? titleSlug : `${titleSlug}-${dateIso}`;
  const imageNote = imagePath ? `\n\n![today's illustration](TODO: upload ${imagePath} to https://images.hive.blog and paste the returned URL here)\n` : "";
  return Object.freeze({ status: "awaiting-manual-approval", account, title, body: `${imageNote}${body.trim()}\n`, tags: Object.freeze([...tags]), permlink, ...(imagePath ? { imagePath } : {}), imageUploadRequired: Boolean(imagePath) });
}
