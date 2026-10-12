// analysis/reward — the reward-route read: where curation reward ACTUALLY flows
// (Voting v2 #23). A post being under-priced (a sink) is necessary but not
// sufficient; what we capture by voting it depends on the plumbing the raw data
// exposes but nobody scores:
//
//   • beneficiaries — a post can route 0–100% of its payout to other accounts
//     via the beneficiary mechanism. The author/curators split only the
//     remainder. A 90%-beneficiary post is a near-dead end for curation reward
//     no matter how under-priced it looks.
//   • curation saturation — curation reward on a post is split pro-rata by vote
//     weight (after the reverse-auction adjustment). If the post is already
//     thick with rshares, our marginal vote earns a small slice; if it is thin,
//     our vote dominates the split. net_rshares is the raw saturation signal.
//
// The capture efficiency combines these into a 0..1 multiplier on a sink's
// deficit: expected captured alpha ≈ deficit × captureEfficiency × timingScore.
// This is what turns "looks under-priced" into "is worth our mana".

    

const numOf = (s) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

function beneficiaryFractionOf(post) {
  const weight = post.beneficiaries.reduce((s, b) => s + (Number.isFinite(b.weight) ? b.weight : 0), 0);
  // Beneficiary weights are in hundredths of a percent (10000 = 100%).
  return Math.max(0, Math.min(1, weight / 10000));
}

/** Read the reward route over a cohort of candidate posts (saturation is
 *  cohort-relative, so the whole set is needed at once). */
export function readRewardRoutes(posts) {
  const out = new Map();
  let maxR = 0;
  const rshares = new Map();
  for (const p of posts) {
    const r = Math.max(0, numOf(p.netRshares));
    rshares.set(`${p.author}/${p.permlink}`, r);
    if (r > maxR) maxR = r;
  }
  for (const p of posts) {
    const key = `${p.author}/${p.permlink}`;
    const r = rshares.get(key) ?? 0;
    const saturation = maxR > 0 ? r / maxR : 0;
    const beneficiaryFraction = beneficiaryFractionOf(p);
    // Marginal vote lands more reward where the post is unsaturated and unskimmed.
    const captureEfficiency = (1 - beneficiaryFraction) * (1 - 0.7 * saturation);
    out.set(key, Object.freeze({
      author: p.author,
      permlink: p.permlink,
      beneficiaryFraction,
      netRshares: r,
      saturation,
      captureEfficiency: Math.max(0, Math.min(1, captureEfficiency)),
    }));
  }
  return out;
}
