---
title: Hive Package Reconnaissance and Consolidation Recipe
description: Per-package reconnaissance of the @emsenn/hive-* family (exports, coupling, reuse-duplication candidates, consumer sites) plus the mechanical recipe for collapsing the siblings into one @emsenn/hive package.
date: 2026-06-15
status: salvaged-from-tmp
source: "/tmp/claude-1001/-home-emsenn-561-group/f9b4d882-e6da-479b-aa4f-95c34910a7ac/tasks/wofx27nv0.output"
---


Reconnaissance over the HIVE package family: per-package exports, internal coupling, reuse-duplication candidates, consumer sites, plus the games/relating consolidation recipe.

---

## Per-package reconnaissance

### `@emsenn/hive-codecs` → proposed subpath `./codecs`

**Public exports:** `sha256`, `sha256d`, `hmacSha256`, `ripemd160`, `PrivateKey`, `PublicKey`, `P`, `N`, `getPublicKey`, `sign`, `verify`, `recover`, `hashMessage`, `ByteWriter`, `serializeAsset`, `serializeOperation`, `serializeTransaction`, `AssetInput`, `Operation`, `TransactionInput`, `vote`, `comment`, `post`, `commentOptions`, `transfer`, `transferToVesting`, `deleteComment`, `claimRewardBalance`, `withdrawVesting`, `limitOrderCreate`, `limitOrderCancel`, `convert`, `collateralizedConvert`, `setWithdrawVestingRoute`, `transferToSavings`, `transferFromSavings`, `cancelTransferFromSavings`, `delegateVestingShares`, `recurrentTransfer`, `customJson`, `follow`, `unfollow`, `reblog`, `slugify`, `commentPermlink`, `VoteInput`, `CommentInput`, `PostInput`, `CommentOptionsInput`, `TransferInput`, `ClaimRewardInput`, `CustomJsonInput`, `WithdrawVestingInput`, `LimitOrderCreateInput`, `LimitOrderCancelInput`, `ConvertInput`, `SetWithdrawVestingRouteInput`, `TransferToSavingsInput`, `TransferFromSavingsInput`, `CancelTransferFromSavingsInput`, `DelegateVestingSharesInput`, `RecurrentTransferInput`, `HIVE_MAINNET_CHAIN_ID`, `transactionDigest`, `signTransaction`, `transactionId`, `deriveReferenceBlock`, `SignedTransaction`.

**Internal hive imports:** none. **External dep usage:** none. **Reuse opportunities:** none.

**Notes:** `@emsenn/hive-codecs` has ZERO `@emsenn` dependencies (package.json lists only devDependencies: `@eslint/js`, `@types/node`, `eslint`, `typescript`, `typescript-eslint`).
Every import in `src/` is either an intra-package sibling (`.mjs` relative import) or `node:crypto`.
Confirmed via `grep -rn "@emsenn" src/` — the only hits are self-referential doc comments in `index.mts` and `engine.mts`.
Because there are no dependencies, there is no dependency capability available to reuse, so reuseOpportunities is empty by construction; the schema requires `couldReuseFrom` to name a dependency capability, and none exists.

Two public surfaces exist:

- The root `index.mts` (`lib/hive-codecs/src/index.mts`) re-exports the L1 codec layer: hash, keys, secp256k1, serialize, ops, transaction.
  These are the publicExports listed above.
- The `package.json` ALSO declares subpath exports not surfaced in `index.mts`: `./hash`, `./keys`, `./ops`, `./serialize`, `./transaction` (deep imports of the same modules) and the Hive Engine sidechain layer `./engine`, `./engine/tokens`, `./engine/market`, `./engine/nft`, `./engine/pools`.
  The engine layer (`engine-core.mts`, `tokens.mts`, `market.mts`, `nft.mts`, `pools.mts`) exports: `SSC_MAINNET_HIVE`, `enginePayload`, `engineCustomJson`, `formatAmount`, `EngineAction`, `EngineActions`, and per-contract builder namespaces (tokens/market/nft/pools).
  `base58.mts` (encode/decode) is internal-only — not exported from `index.mts`.
  When merging into `@emsenn/hive` under `./codecs`, the merge owner should preserve these finer-grained subpaths (e.g. `./codecs/engine`, `./codecs/engine/tokens`) since they correspond to distinct consumption surfaces.

On the "delete re-implemented logic" goal: this package is deliberately zero-dependency crypto/serialization.
The hand-rolled pieces — secp256k1 BigInt curve math (`secp256k1.mts`), pure-JS RIPEMD-160 fallback (`hash.mts` `ripemd160Pure`, lines 28-113), base58 big-integer codec (`base58.mts`), graphene LEB128/asset binary serialization (`serialize.mts`), bigint decimal scaling (`serialize.mts` `scaleDecimal` line 94, `engine-core.mts` `formatAmount` line 58) — are domain-specific Hive/graphene wire-format and curve implementations.
The audit brief asked to look for math/arithmetic that ledger-algebra/relating provides or valuation/decision math that decision-topology/relating provides, but this package does not depend on any of those, and the arithmetic here (modular curve math, fixed-precision asset scaling, base58) is not the kind of valuation/ledger arithmetic those packages expose; it is byte-exact protocol encoding that must match the Hive blockchain.
No defensible deletion-via-inheritance opportunities were found.
If the consolidated `@emsenn/hive` package brings in a relationality/ledger dependency, a SEPARATE future audit could revisit whether `formatAmount`/`scaleDecimal` duplicate a fixed-precision decimal helper there — but as scoped (zero deps), there is nothing to inherit.

Proposed subpath `./codecs` follows the stated pattern (`./codecs`, `./topology`, `./content`, `./curation`, `./market`) and the `@emsenn/games` / `@emsenn/relating` precedent; the package name's "-codecs" suffix maps directly to `./codecs`.

---

### `@emsenn/hive-topology` → proposed subpath `./topology`

**Public exports:** `FinancialTopologyCarrier`, `financialAccountTerm`, `financialCommodityTerm`, `financialPositionTerm`, `holdingUtterance`, `holdingClosedUtterance`, `liquidPositionUtterance`, `stakedPositionUtterance`, `denominationUtterance`, `transferUtterance`, `hiveAccountTerm`, `hivePostTerm`, `hiveCommunityTerm`, `hiveTagTerm`, `hiveVotedOnPredicate`, `hiveUnvotedPredicate`, `hiveFollowsPredicate`, `hiveUnfollowedPredicate`, `hiveTaggedWithPredicate`, `hivePostedPredicate`, `hiveDeletedPredicate`, `hiveRebloggedPredicate`, `hiveMemberOfPredicate`, `hiveDelegatedToPredicate`, `hiveExistsPredicate`, `hiveActivePredicate`, `hiveVoteUtterance`, `hiveUnvoteUtterance`, `hiveFollowUtterance`, `hiveUnfollowUtterance`, `hivePostExistsUtterance`, `hivePostDeletedUtterance`, `hiveReblogUtterance`, `hiveTagUtterance`, `hiveCommunityUtterance`, `hiveAccountActiveUtterance`, `hiveDelegationUtterance`, `hiveBalanceUtterance`, `hiveLiquidBalanceUtterance`, `hiveHBDUtterance`, `hiveLiquidHBDUtterance`, `hiveHivePowerUtterance`, `hiveHivePowerStakedUtterance`, `hiveResourceCreditUtterance`, `induceHiveTopology`, `extendHiveTopology`, `HiveTopologyCarrier`, `UtteranceCarrier`, `hiveKnowledgeSection`, `hiveTruthSection`, `hiveVoteCharge`, `hiveUnvoteCharge`, `hiveFollowCharge`, `hiveUnfollowCharge`, `hivePostCharge`, `hivePostDeletedCharge`, `hiveReblogCharge`, `hiveTagCharge`, `hiveCommunityCharge`, `hiveDelegationCharge`, `hiveActiveCharge`, `hiveAccountEntries`, `hivePostEntries`, `hiveAllVoterEntries`, `hiveAllFollowerEntries`, `hiveAllAuthorEntries`, `hiveAllTaggedEntries`, `SectionCarrier`, `SectionEntry`, `ChargeCarrier`, `financialKnowledgeSection`, `financialTruthSection`, `holdingCharge`, `denominationCharge`, `liquidCharge`, `stakedCharge`, `ASSET_PLACES`, `parseLegacyAsset`, `formatLegacyAsset`, `expectCommodity`, `HIVE_100_PERCENT`, `VOTING_MANA_REGENERATION_SECONDS`, `VOTE_DUST_THRESHOLD`, `DEFAULT_VOTE_POWER_RESERVE_RATE`, `maxManaFromVests`, `regeneratedMana`, `voteRshares`, `manaAfterVote`, `voteValueHive`, `hiveToHbd`, `parseMedianPrice`, `assembleRewardPoolState`, `ManaState`, `VoteCost`, `MedianPrice`, `RewardFund`, `LegacyPrice`, `FeedHistory`, `DynamicGlobalPropertiesState`, `RewardPoolState`, `vestingRate`, `vestsToHp`, `hpToVests`, `createVestingRateCache`, `VestingPoolState`, `VestingRate`, `VestingRateCache`, `REVERSE_AUCTION_SECONDS`, `EARLY_VOTING_SECONDS`, `MID_VOTING_SECONDS`, `MID_WINDOW_PENALTY`, `LATE_WINDOW_PENALTY`, `CASHOUT_WINDOW_SECONDS`, `UPVOTE_LOCKOUT_SECONDS`, `curationWindow`, `curationPenaltyDivisor`, `isCurationEligible`, `voteCurationWeight`, `curationShares`, `curationPool`, `CurationWindow`.

**Internal hive imports:** none.

**External dep usage:**

- `@emsenn/relating` — `utterance`, `mark`, `induce`, `extend`, `sectionOf`, `predicationsFor`, `subjectsFor`, `chargeAtValues`, `UtteranceCarrier`, `MemeTopologyCarrier`, `TermInput`, `SectionCarrier`, `SectionEntry`, `ChargeCarrier`.
- `@emsenn/financial-topology` — `financialAccountTerm`, `financialCommodityTerm`, `financialPositionTerm`, `holdingUtterance`, `holdingClosedUtterance`, `liquidPositionUtterance`, `stakedPositionUtterance`, `denominationUtterance`, `transferUtterance`, `holdsPositionPredicate`, `isLiquidPredicate`, `isStakedPredicate`, `FinancialTopologyCarrier`, `financialKnowledgeSection`, `financialTruthSection`, `holdingCharge`, `closedPositionCharge`, `denominationCharge`, `liquidCharge`, `stakedCharge`.
- `@emsenn/ledger-algebra` — `Amount`, `amount`, `rational`, `zero`.
- `@emsenn/ledger-codecs` — `format`, `parseDecimal`.

**Reuse opportunities:**

1. **(high, ~1 line)** Hand-rolled rational division of one Amount by a bigint/bigint ratio: `amount(curationPool.num * w, curationPool.den * total, curationPool.commodity)`. ledger-algebra exports `scale(a, {num,den})` which does exactly `amount(a.num*r.num, a.den*r.den, a.commodity)` — same commodity, same reduce.
  Replace with `scale(curationPool, rational(w, total))`.
  Location `lib/hive-topology/src/curation.mts:117`; could reuse from `@emsenn/ledger-algebra scale (+ rational)`.
2. **(high, ~1 line)** `curationPool` computes payout × pct/10000 via `amount(commentPayout.num * BigInt(pct), commentPayout.den * 10_000n, commentPayout.commodity)`.
  This is `scale(commentPayout, rational(BigInt(percentCurationRewards), 10_000n))` — the same-commodity scale ledger-algebra already provides.
  Location `lib/hive-topology/src/curation.mts:125`; could reuse from `@emsenn/ledger-algebra scale (+ rational)`.
3. **(high, ~1 line)** `voteValueHive` builds `amount(rewardBalance.num * rshares, rewardBalance.den * recentClaims, rewardBalance.commodity)` — a same-commodity scaling of an Amount by the rational rshares/recentClaims.
  Identical to `scale(rewardBalance, rational(rshares, recentClaims))` in ledger-algebra.
  Location `lib/hive-topology/src/vote-value.mts:112`; could reuse from `@emsenn/ledger-algebra scale (+ rational)`.
4. **(medium, ~3 lines)** `hiveToHbd` multiplies a HIVE Amount by a HBD/HIVE price ratio by hand (`amount(hive.num*base.num*quote.den, hive.den*base.den*quote.num, base.commodity)`). ledger-algebra's `times(a,b,commodity)` is the cost/price multiplication primitive (its doc comment is literally `(10 STOCK) × (5 USD per unit) = 50 USD`); the MedianPrice `{base,quote}` pair could be expressed via `times`/`scale` rather than re-deriving the cross-multiply.
  Medium because the base/quote denominator division means it is `times(hive, base, ...)
  ` then `scale` by `rational(quote.den, quote.num)`, not a single call, so the win is partial.
  Location `lib/hive-topology/src/vote-value.mts:125`; could reuse from `@emsenn/ledger-algebra times / scale`.
5. **(low, ~2 lines)** Vesting conversions `vestsToHp`/`hpToVests` hand-build `amount(v.num*rate.num, v.den*rate.den, "HIVE")` (and the inverse).
  The magnitude arithmetic matches `scale(v, rate)`, but the operation also CHANGES the commodity (VESTS→HIVE / HIVE→VESTS), which `scale` deliberately does not do (it keeps a.commodity).
  So the reuse is only the rational-multiply core; the commodity relabel still needs a wrapper.
  Low confidence — not a clean drop-in, and `times` expects two Amounts not an Amount×rate.
  Location `lib/hive-topology/src/vesting.mts:37`; could reuse from `@emsenn/ledger-algebra scale (partial — no commodity change)`.

**Notes:** Subpath: this package is the Hive *topology* carrier (social graph + financial layer + the HE sidechain at `./engine`, plus quantitative-law subpaths `./rewards`, `./vesting`, `./curation`).
It is the topology member of the hive domain, so it should become `@emsenn/hive/topology`, mirroring how relationality made each former meme-* package a module subpath.
The existing fine-grained subpaths (`./rewards`, `./vesting`, `./curation`, `./engine`) would nest under it (e.g. `./topology`, or `hive/topology/rewards`) per the merge owner's layout; the prompt's `./codecs`/`./content`/`./curation`/`./market` list suggests sibling subpaths from OTHER hive-* packages, this one supplies `./topology` (and its math/engine).

Imports: there are NO imports from sibling `@emsenn/hive-*` packages — `index.mts` and all `.mts` files import only from the four declared external deps (relationality, financial-topology, ledger-algebra, ledger-codecs).
So internalHiveImports is empty.

Bulk of the file count (`hive-topology.mts`, `hive-section.mts`, `hive-engine-topology.mts`, `hive-engine-section.mts`) is legitimately thin Hive-idiomatic naming over relationality/topology (utterance/mark/induce/extend/sectionOf/chargeAtValues) and financial-topology — these are domain wrappers, NOT reimplementations, and should stay.
The section files correctly re-export financial section helpers straight from `@emsenn/financial-topology` rather than reimplementing them (good), and hive-engine-section imports the financial predicates directly.
No duplicated section/topology scaffolding found.

The defensible code-reduction is concentrated in the money math: `curation.mts`, `vote-value.mts`, and `vesting.mts` repeatedly inline `amount(x.num * a, x.den * b, commodity)` which is precisely ledger-algebra's `scale(amount, rational)` (and, for the price conversion, `times`).
`curation.mts:117` and `:125`, and `vote-value.mts:112`, are clean same-commodity `scale` substitutions (high confidence).
`hiveToHbd` and the vesting conversions are weaker fits because of the cross-commodity relabel that `scale` intentionally does not perform.

Two design-smell items NOT listed as reuse opportunities because they are not defensible drop-ins: (1) `ASSET_PLACES` (`asset.mts:10`) is a hardcoded precision table that duplicates what ledger-algebra's commodity Registry / `precisionOf` could hold, but switching to a registry is a design change, not a re-implemented capability.
(2) `parseLegacyAsset`/`formatLegacyAsset` already correctly delegate to ledger-codecs `parseDecimal`/`format` — they are thin Hive-asset-string adapters, not reimplementations, and should stay.
Nothing here re-implements decision/valuation math from a decision-topology dependency (this package does not depend on decision-topology), and nothing re-implements relationality's algebra arithmetic (all money math goes through ledger-algebra, which is the correct layer).

---

### `@emsenn/hive-content-topology` → proposed subpath `./content`

**Public exports:** `contentObservation`, `contentFitnessValuation`, `ContentObservation`, `RawHiveContent`, `ContentGate`, `ContentFitnessValuation`, `ContentFitnessPolicy`.

**Internal hive imports:** none.

**External dep usage:**

- `@561-group/content-topology` — `wordCount`, `extractLinks`, `prophecyFindings`, `repetitionFindings`, `proseLintErrors`.

**Reuse opportunities:**

1. **(high, ~3 lines)** The local helper `firstProse()` re-implements the heading-stripping pass that the dependency already exports as `proseLines()`.
  `content.mts:55-63` does `body.split("\n").filter(line => !/^#{1,6}\s/.test(line)).join("\n")` which is byte-identical to content-topology's `proseLines()` (`gates.mts:22-24`, also exported from the package root `index.mts:79`).
  `firstProse` could be rewritten as `proseLines(body).split(/\n\s*\n/).map(b=>b.trim()).find(b=>b!=="") ??
  ""`, deleting the duplicated heading regex/filter/join.
  Only the heading-strip step is duplicated; the blank-line-block selection is unique to `firstProse`, so this is a partial (a few lines) reduction, not a full deletion.
  Location `/home/emsenn/561-group/lib/hive-content-topology/src/content.mts:55`; could reuse from `@561-group/content-topology proseLines() (exported from /gates and from root index)`.

**Notes:** Dependency note: the package's only `@emsenn`-family dependency is `@561-group/content-topology` (`workspace:*`), imported via its `/gates` subpath.
The audit prompt's "(zero @emsenn deps)" is accurate in the literal `@emsenn`-scope sense; the real cross-package dependency is the `@561-group`-scoped content-topology.
No sibling hive-* imports exist (internalHiveImports empty).

The package is already well-factored: it delegates all five heavy content-fitness primitives (`wordCount`, `extractLinks`, `prophecyFindings`, `repetitionFindings`, `proseLintErrors`) to content-topology/gates and keeps only Hive-specific policy on top (thresholds, evidence strings, the four/five-gate composite, the 0-400 bigint score).
That delegation is correct and should be preserved; the gate-evidence formatting and scoring are genuine consumer policy, not duplication.

Cases considered and rejected as NOT defensible reuse:

- `ContentGate` / the inline `judge()` pass-fail loop vs content-topology's `GateVerdict` type + `gateVerdict()` (`content-section.mts:70-94`).
  Different shapes: `gateVerdict` reads gate charges off a settled SectionCarrier on the meme floor; the hive gates are a flat ad-hoc pass/fail+evidence list computed directly from primitives.
  Not the same capability; no clean substitution.
- `score = BigInt(Math.round((passingCount/totalGates)*400))` (`content.mts:214`) is trivial arithmetic.
  There is NO ledger-algebra / relationality / decision-topology dependency in this package's graph to delegate valuation/decision math to, so there is nothing to inherit here.
  Do not flag.
- `looksEnglish` (`content.mts:68-71`) and `parsePrimaryTag` (`content.mts:73-86`) are Hive-specific heuristics / json_metadata parsing with no equivalent in content-topology.
- The external-link filter `/^https?:\/\//i` (`content.mts:174`) is a one-liner with no dependency equivalent (`extractLinks` returns all link URLs, not http-filtered).

Proposed subpath `./content` matches the merge owner's explicitly-listed target subpaths and the package's distinguishing concern (the content-fitness axis), consistent with the `@emsenn/games` and `@emsenn/relating` consolidation pattern.

---

### `@emsenn/hive-curation-topology` → proposed subpath `./curation`

**Public exports:** `reputationScore`, `downvoteRshares`, `toPostObservation`, `PostObservation`, `BridgePost`, `EXHIBITS`, `INVESTMENT_MERIT`, `INVESTMENT_RISK`, `MERIT_TRAITS`, `RISK_TRAITS`, `DEFAULT_THRESHOLDS`, `postSubject`, `witnessedMeritTraits`, `witnessedRiskTraits`, `ontologyEdges`, `postUtterances`, `MeritTrait`, `RiskTrait`, `WitnessingThresholds`, `valuatePost`, `dominates`, `incomparable`, `scoreBasisPoints`, `CurationValuation`, `ContentFitnessValuation`, `ContentObservation`, `ContentFitnessPolicy`, `ContentGate`, `RawHiveContent`, `contentObservation`, `contentFitnessValuation`, `curationProposal`, `curationProposals`, `admittedProposals`, `VoteAction`, `CurationProposal`, `ManaState`, `CurationInputs`.

**Internal hive imports:**

- from `@emsenn/hive-topology` — `voteRshares`, `voteCurationWeight`, `curationWindow`, `isCurationEligible`, `CurationWindow`.
- from `@emsenn/hive-content-topology` — `contentObservation`, `contentFitnessValuation`, `ContentFitnessValuation`, `ContentObservation`, `ContentFitnessPolicy`, `ContentGate`, `RawHiveContent`.

**External dep usage:**

- `@emsenn/decision-topology` — `Proposal`.
- `@emsenn/relating/topology` — `mark`, `specializationClaimValue`, `utterance`, `UtteranceCarrier`, `induce`, `sectionOf`, `chargeAtValues`, `chargeValue`, `ChargeValue`, `ChargeCarrier`.
- `@emsenn/relating/analysis` — `chargeDistribution`, `evidenceCoordinates`.
- `@emsenn/relating/algebra` — `ratSubtract`, `ratSign`, `toNumber`, `Rational`.

**Reuse opportunities:**

1. **(low, ~8 lines)** `hbdMicro()` hand-parses a legacy Hive asset string (regex match on '`<num> HBD`', split on '.', pad to 6 places, multiply by `1_000_000n`) to produce a micro-unit bigint. hive-topology already exports `parseLegacyAsset()` / `ASSET_PLACES`, which exactly parse legacy condenser asset strings (including the HBD 3-place precision) into an exact rational Amount via ledger-codecs.
  The local copy re-derives the same boundary-decoding logic.
  Note: shapes differ (local returns micro-unit bigint for threshold comparisons; `parseLegacyAsset` returns a rational Amount), so reuse would require an Amount->micro-bigint conversion at the call sites and is therefore not a drop-in delete.
  Location `/home/emsenn/561-group/lib/hive-curation-topology/src/observation.mts:95`; could reuse from `@emsenn/hive-topology parseLegacyAsset / ASSET_PLACES (from ./rewards, folded asset.mts)`.
2. **(low, ~6 lines)** `toBigInt()` is a local `string|number|bigint -> bigint` coercion used to decode condenser fields (net_rshares, abs_rshares, author_reputation, vote rshares).
  This is generic wire-decoding; hive-topology / relationality codecs handle similar boundary coercion, but no single exported helper has this exact permissive signature (returns `0n` on any parse failure), so it is only a partial overlap rather than a clean replacement.
  Location `/home/emsenn/561-group/lib/hive-curation-topology/src/observation.mts:87`; could reuse from `@emsenn/hive-topology / @emsenn/relating codecs boundary decoders`.

**Notes:** This package is already well-factored against its dependencies and does NOT re-implement the heavy math its deps provide.
The cardinal valuation (`evidenceCoordinates`/`chargeDistribution`), all exact rational arithmetic (`ratSubtract`/`ratSign`/`toNumber`/`Rational`), the curation reward kernel (`voteRshares`/`voteCurationWeight`/`curationWindow`/`isCurationEligible`), the linear-budget allocation (decision-topology `Proposal`/`decide`), and the content-fitness axis (hive-content-topology) are all delegated upstream rather than copied.
The bulk of the local `.mts` code is legitimate domain logic with no upstream equivalent: (1) the trait ontology and witnessing-threshold predicate logic in `ontology.mts` (which traits the chain witnesses — boolean domain facts, not math); (2) the bridge/condenser -> PostObservation boundary translation in `observation.mts`; (3) the dominance partial order and curation-proposal composition.
Only two mild, shape-mismatched overlaps exist (the two reuseOpportunities above), both at the chain-read boundary in `observation.mts`; neither is a clean delete.

Proposed subpath `./curation`: chosen to match the package's domain noun and the prompt's enumerated subpaths (`./codecs ./topology ./content ./curation ./market`).
One naming consideration for the merge owner: `@emsenn/hive-content-topology` will presumably become `@emsenn/hive ./content`, and this package re-exports several content symbols (`contentObservation`, `contentFitnessValuation`, `ContentFitnessValuation`, etc.) for convenience; after consolidation those re-exports become same-package and could be dropped from `./curation`'s surface (consumers can import from `./content`), shaving the `index.mts` re-export block.

Non-dependency simplification (not a reuse case, so excluded from reuseOpportunities): `incomparable()` at `valuation.mts:109-115` recomputes the three-axis equality tie-check inline; it duplicates the per-axis `ratSign(ratSubtract(...))
` comparisons already done in `dominates()`.
This is an internal dedup, not an inherited-capability deletion.

verify check (audit-only, did not edit): `admittedProposals` returns the proposals fed to decision-topology's `decide()`; decision-topology's `Proposal<A>` shape (id, action, cost, merit, justification: ChargeCarrier) matches CurationProposal's base fields, and `justification` is correctly set to `valuation.headline` (a settled ChargeCarrier), so the composition is sound.

Key files (absolute): `/home/emsenn/561-group/lib/hive-curation-topology/src/index.mts`, `observation.mts`, `ontology.mts`, `valuation.mts`, `curation.mts`.

---

### `@emsenn/hive-market-topology` → proposed subpath `./market`

**Public exports:** `HIVE_INTERNAL_VENUE`, `HIVE_ENGINE_VENUE`, `HIVE_ENGINE_QUOTE_SYMBOL`, `hiveInternalBookTerm`, `hiveEngineBookTerm`, `hiveInternalListedUtterance`, `hiveInternalBidUtterance`, `hiveInternalBidEndedUtterance`, `hiveInternalAskUtterance`, `hiveInternalAskEndedUtterance`, `hiveInternalOrderPlacedUtterance`, `hiveInternalFillUtterance`, `hiveInternalQuoteUtterance`, `hiveEngineMarketListedUtterance`, `hiveEngineMarketBidUtterance`, `hiveEngineMarketBidEndedUtterance`, `hiveEngineMarketAskUtterance`, `hiveEngineMarketAskEndedUtterance`, `hiveEngineMarketOrderPlacedUtterance`, `hiveEngineMarketFillUtterance`, `hiveEngineMarketQuoteUtterance`, `induceHiveMarketTopology`, `extendHiveMarketTopology`, `HiveMarketTopologyCarrier`, `MarketTopologyCarrier`, `UtteranceCarrier`, `hiveMarketKnowledgeSection`, `hiveMarketTruthSection`, `hiveInternalListedCharge`, `hiveInternalBidCharge`, `hiveInternalAskCharge`, `hiveInternalPlacedCharge`, `hiveInternalFillCharge`, `hiveInternalQuoteCharge`, `hiveEngineMarketListedCharge`, `hiveEngineMarketBidCharge`, `hiveEngineMarketAskCharge`, `hiveEngineMarketPlacedCharge`, `hiveEngineMarketFillCharge`, `hiveEngineMarketQuoteCharge`, `SectionCarrier`, `SectionEntry`, `ChargeCarrier`, `bestBid`, `bestAsk`, `spread`, `midpoint`, `relativeSpread`, `marketBuyWalk`, `marketSellWalk`, `BookLevel`, `OrderBook`, `BookWalk`.

**Internal hive imports:** none.

**External dep usage:**

- `@emsenn/market-topology` — `marketBookTerm`, `marketListedUtterance`, `marketBidUtterance`, `marketBidEndedUtterance`, `marketAskUtterance`, `marketAskEndedUtterance`, `marketOrderPlacedUtterance`, `marketFillUtterance`, `marketQuoteUtterance`, `MarketTopologyCarrier`, `marketKnowledgeSection`, `marketTruthSection`, `marketListedCharge`, `marketBidCharge`, `marketAskCharge`, `marketPlacedCharge`, `marketFillCharge`, `marketQuoteCharge`, `SectionCarrier`, `SectionEntry`, `ChargeCarrier`, `bestBid`, `bestAsk`, `spread`, `midpoint`, `relativeSpread`, `marketBuyWalk`, `marketSellWalk`, `BookLevel`, `OrderBook`, `BookWalk`.
- `@emsenn/relating` — `induce`, `extend`, `UtteranceCarrier`, `MemeTopologyCarrier`, `TermInput`.

**Reuse opportunities:** none.

**Notes:** `@emsenn/hive-market-topology` is a pure venue-specialization layer over `@emsenn/market-topology`, with carrier settlement delegated to `@emsenn/relating/topology`.
It contains NO hand-rolled logic that duplicates a dependency capability — there is no arithmetic/ledger math, no codec/serialize code, no section-scaffolding, and no valuation/decision math to delete.
Every function is a thin binding wrapper.

Source files (2, no math):

1. `src/hive-market-topology.mts` — venue/symbol constants (`HIVE_INTERNAL_VENUE`, `HIVE_ENGINE_VENUE`, `HIVE_ENGINE_QUOTE_SYMBOL`), book-term and utterance constructors that each just call the corresponding market-topology constructor with venue/symbol args bound (e.g. line 49 `marketBookTerm(...)
  `, lines 61-138 `marketXUtterance(...)
  `).
  `induceHiveMarketTopology` (line 148-150) and `extendHiveMarketTopology` (line 153-158) call relationality `induce`/`extend` with a brand cast — this brand-cast wrapper is the SAME idiom market-topology itself uses (`induceMarketTopology`/`extendMarketTopology`) and the established monorepo pattern, so it is intentional specialization, not re-implementation.
  Not a deletion candidate.
2. `src/hive-market-section.mts` — section/charge reads that each just call the matching market-topology `marketXCharge` / `marketKnowledgeSection` / `marketTruthSection` with venues bound.
  No re-implemented section logic.

The microstructure math (`bestBid`/`bestAsk`/`spread`/`midpoint`/`relativeSpread`/`marketBuyWalk`/`marketSellWalk`) is NOT re-implemented here — `index.mts` lines 68-73 re-export it directly from `@emsenn/market-topology`.
This is the correct (non-duplicating) move.

IMPORTANT — already-applied import rewrites (intentional, per system reminder): both source files have been edited to import market symbols from `"@emsenn/markets/market"` instead of `"@emsenn/market-topology"`.
This signals market-topology is itself being consolidated into an `@emsenn/markets` package at subpath `./market`.
The package.json dependency still lists `@emsenn/market-topology workspace:*` and was NOT updated, so post-merge the manifest dep must point at `@emsenn/markets` (or the new internal hive subpath) — flag for the merge owner. relationality import is still `"@emsenn/relating/topology"` (unchanged).

Subpath rationale: package is explicitly 'Hive's market field' per its own header (hive-`<domain>`-`<field>` convention); `./market` is the natural subpath under the consolidated `@emsenn/hive`, parallel to `./topology` (hive-topology = social/financial field).
No reuse-deletion work is warranted before the merge; the merge is a straight relocation.

---

## Consumer map — Hive import rewiring

I have everything.
Note: `@emsenn/hive-computer` (the app) is itself one of the consumers but is also the package imported by waggle/hive-server.
Per the task, hive-computer is the app and not in the collapse list, so imports *of* `@emsenn/hive-computer` stay as-is (or become `@emsenn/hive` if folded).
I report all imports and flag this distinction.

Subpath collapse target:

- `@emsenn/hive-codecs` → `@emsenn/hive/codecs`
- `@emsenn/hive-topology` → `@emsenn/hive/topology`
- `@emsenn/hive-content-topology` → `@emsenn/hive/content`
- `@emsenn/hive-curation-topology` → `@emsenn/hive/curation`
- `@emsenn/hive-market-topology` → `@emsenn/hive/market`
- `@emsenn/hive-computer` → the app itself (folded in or kept; not in the subpath list — flagged below where imported)

### 1. apps/market-computer

Only imports `@emsenn/hive-market-topology` (→ `@emsenn/hive/market`).
No imports of any other hive-* package.

| file:line | old specifier | symbols |
|---|---|---|
| `apps/market-computer/src/index.test.mts:8-15` | `@emsenn/hive-market-topology` | `hiveMarketKnowledgeSection`, `hiveInternalListedCharge`, `hiveInternalQuoteCharge`, `hiveEngineMarketListedCharge`, `hiveEngineMarketQuoteCharge`, `type ChargeCarrier` |
| `apps/market-computer/src/analyze.mts:25-31` | `@emsenn/hive-market-topology` | `HIVE_ENGINE_VENUE`, `HIVE_INTERNAL_VENUE`, `induceHiveMarketTopology`, `type HiveMarketTopologyCarrier`, `type UtteranceCarrier` |
| `apps/market-computer/src/observe.mts:22-28` | `@emsenn/hive-market-topology` | `hiveEngineMarketListedUtterance`, `hiveEngineMarketQuoteUtterance`, `hiveInternalListedUtterance`, `hiveInternalQuoteUtterance`, `type UtteranceCarrier` |

### 2. apps/waggle

Imports `@emsenn/hive-computer` (the app/aggregate — NOT in the subpath list) and `@emsenn/hive-codecs` (→ `@emsenn/hive/codecs`).

| file:line | old specifier | symbols |
|---|---|---|
| `apps/waggle/src/cli.mts:22` | `@emsenn/hive-computer` | `HiveComputer`, `deriveRoleKey`, `fetchAuthorities` |
| `apps/waggle/src/cli.mts:23` | `@emsenn/hive-codecs` | `PrivateKey` |
| `apps/waggle/src/index.test.mts:9` | `@emsenn/hive-computer` | `HiveComputer` |
| `apps/waggle/src/index.test.mts:10` | `@emsenn/hive-computer` | `type RpcTransport` |
| `apps/waggle/src/index.test.mts:11` | `@emsenn/hive-codecs` | `PrivateKey`, `sha256` |
| `apps/waggle/src/sync.mts:21` | `@emsenn/hive-computer` | `type HiveComputer` |
| `apps/waggle/src/sync.mts:22` | `@emsenn/hive-computer` | `type HiveAccount` |
| `apps/waggle/src/keystore.mts:23` | `@emsenn/hive-codecs` | `PrivateKey` |

Note: `apps/waggle/src/index.mts:6` is a JSDoc comment mentioning `@emsenn/hive-computer`, not an import.
All exports in `waggle/index.mts` re-export from local `./` modules — no hive-* re-exports.

### 3. services/hive-server

Imports `@emsenn/hive-computer` (app/aggregate), `@emsenn/hive-curation-topology` (→ `@emsenn/hive/curation`), `@emsenn/hive-topology` (→ `@emsenn/hive/topology`), and `@emsenn/hive-codecs` with deep `/engine`, `/engine/market`, `/engine/pools` subpaths (→ `@emsenn/hive/codecs/engine`, etc.).

| file:line | old specifier | symbols |
|---|---|---|
| `services/hive-server/src/curate.mts:2` | `@emsenn/hive-computer` | `HiveComputer` |
| `services/hive-server/src/curate.mts:3-7` | `@emsenn/hive-curation-topology` | `curationProposals`, `admittedProposals`, `contentObservation`, `contentFitnessValuation`, `type CurationProposal`, `type CurationInputs`, `type PostObservation`, `type ContentFitnessValuation`, `type RawHiveContent`, `type WitnessingThresholds` |
| `services/hive-server/src/curate.mts:9` | `@emsenn/hive-topology` | `maxManaFromVests`, `regeneratedMana` |
| `services/hive-server/src/curate.mts:13` | `@emsenn/hive-curation-topology` | `export type { VoteAction }` (re-export) |
| `services/hive-server/src/curate.mts:25` | `@emsenn/hive-curation-topology` | `import("@emsenn/hive-curation-topology").VoteAction` (inline import type in a `Decision<...>` annotation) |
| `services/hive-server/src/render.mts:2` | `@emsenn/hive-curation-topology` | `type CurationProposal`, `type CurationValuation`, `type ContentFitnessValuation` |
| `services/hive-server/src/render.mts:3` | `@emsenn/hive-curation-topology` | `scoreBasisPoints` |
| `services/hive-server/src/browse.mts:3` | `@emsenn/hive-computer` | `type HiveComputer` |
| `services/hive-server/src/observe.mts:2` | `@emsenn/hive-curation-topology` | `export { toPostObservation }` (re-export) |
| `services/hive-server/src/observe.mts:3` | `@emsenn/hive-curation-topology` | `export type { BridgePost, PostObservation }` (re-export) |
| `services/hive-server/src/market.mts:3` | `@emsenn/hive-computer` | `type HiveComputer` |
| `services/hive-server/src/trade.mts:5` | `@emsenn/hive-codecs/engine` | `engineCustomJson`, `formatAmount` |
| `services/hive-server/src/trade.mts:6` | `@emsenn/hive-codecs/engine/market` | `marketSell as heSell` |
| `services/hive-server/src/trade.mts:7` | `@emsenn/hive-codecs/engine/pools` | `addLiquidity` |
| `services/hive-server/src/trade.mts:8` | `@emsenn/hive-computer` | `type HiveComputer` |
| `services/hive-server/src/index.mts:5` | `@emsenn/hive-computer` | `HiveComputer` |
| `services/hive-server/src/index.mts:6` | `@emsenn/hive-curation-topology` | `type VoteAction`, `type WitnessingThresholds` |

Deep-subpath caveat for `trade.mts`: the three `@emsenn/hive-codecs/engine*` specifiers map to `@emsenn/hive/codecs/engine`, `@emsenn/hive/codecs/engine/market`, `@emsenn/hive/codecs/engine/pools` — the collapsed package's `exports` map must preserve these nested codec subpaths.

### 4. apps/hive-computer (the hive app itself)

Imports `@emsenn/hive-codecs` (→ `@emsenn/hive/codecs`) and re-exports `@emsenn/hive-topology` (→ `@emsenn/hive/topology`).
If this app is folded into `@emsenn/hive`, these become internal/relative imports; if kept as the app, they become `@emsenn/hive/codecs` and `@emsenn/hive/topology`.

| file:line | old specifier | symbols |
|---|---|---|
| `apps/hive-computer/src/wallet.test.mts:6` | `@emsenn/hive-codecs` | `PrivateKey`, `sha256` |
| `apps/hive-computer/src/client.mts:5-9` | `@emsenn/hive-codecs` | `PrivateKey`, `signTransaction`, `transactionId`, `type Operation`, `type SignedTransaction` |
| `apps/hive-computer/src/client.mts:10` | `@emsenn/hive-codecs` | `* as ops` (namespace import) |
| `apps/hive-computer/src/client.mts:11` | `@emsenn/hive-codecs` | `HIVE_MAINNET_CHAIN_ID` |
| `apps/hive-computer/src/wallet.mts:29` | `@emsenn/hive-codecs` | `PrivateKey`, `PublicKey`, `sha256` |
| `apps/hive-computer/src/cli.mts:11` | `@emsenn/hive-codecs` | `PrivateKey` |
| `apps/hive-computer/src/topology.mts:3` | `@emsenn/hive-topology` | `export *` (re-exports entire topology lib as the app's `topology` subpath) |

Non-import matches (comments only, no rewiring needed): `apps/hive-computer/src/client.mts:399`, `apps/hive-computer/src/index.mts:2,6,7`.

### Cross-cutting notes

- `@emsenn/hive-content-topology` (→ `@emsenn/hive/content`): no direct `src/` imports in any of the four consumers.
  Likely consumed only transitively (e.g. via hive-curation-topology).
  No rewiring entries here.
- `@emsenn/hive-computer` appears as an import target in waggle and hive-server but is the app, not a collapsed lib.
  Decide whether it folds into `@emsenn/hive` (root export) or stays standalone before rewiring those lines.
- Two non-standard `@emsenn/hive-curation-topology` usages in `curate.mts` need attention beyond simple `from "..."
  ` find/replace: a re-export (line 13) and an inline `import("...")
  ` type expression (line 25).
- `trade.mts` uses three nested `@emsenn/hive-codecs/engine*` subpaths that must be preserved in the collapsed package's exports map.

---

## RECIPE: Merge sibling `hive-*` packages into one `@emsenn/hive`

Confirmed.
Here is the complete build sheet.

This is the exact mechanical recipe used for `@emsenn/games` (flat subpaths) and `@emsenn/relating` (which additionally has nested subpaths like `./topology/dynamics`).
Substitute your real subpath names for the placeholders `<sub>` (e.g. `algebra`, `topology`, ...).

### 0. Preconditions (no extra wiring needed)

- `pnpm-workspace.yaml` already globs `lib/*`, so creating `lib/hive/` auto-registers the package. **Do NOT edit `pnpm-workspace.yaml` or any root file.** No root `workspaces` field exists.
- The shared build helper already exists at `/home/emsenn/561-group/scripts/package-boundary/copy-dmts-to-dts.mjs` (referenced as `../../scripts/...
  ` from `lib/hive/`).
  Do not recreate it.

### 1. Directory layout

For each former package `lib/hive-<sub>/`, move its `src/*` into `lib/hive/src/<sub>/` **using `git mv`** (history preserved):

```
git mv lib/hive-<sub>/src/<file>.mts lib/hive/src/<sub>/<file>.mts
```

Result:

```
lib/hive/
  .gitignore
  package.json
  tsconfig.json
  tsconfig.build.json
  tsconfig.test.json        # ONLY if there are *.test.mts files (see §7)
  src/
    index.mts               # NEW root barrel (re-exports subpaths as namespaces)
    <sub>/                   # former hive-<sub>/src/, including its own index.mts
      index.mts             # former package's index.mts becomes this subpath barrel
      *.mts
```

- Each former package's own `src/index.mts` becomes `src/<sub>/index.mts` unchanged (its internal `export * from "./foo.mjs"` lines still work — same-module relative imports are untouched).
- Nested-subpath variant (relationality's `./topology/dynamics`): a single file `src/topology/dynamics.mts` (not a directory) compiles to `dist/topology/dynamics.mjs` and gets its own exports entry.
  No barrel needed for a single-file subpath.

### 2. `lib/hive/.gitignore`

```
dist
.tmp
node_modules
```

### 3. `lib/hive/package.json`

Flat-subpath shape (games style).
The root `import` maps to `./dist/index.mjs`; each subpath `<sub>` maps to `./dist/<sub>/index.mjs`:

```json
{
  "name": "@emsenn/hive",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Hive — <one-paragraph synopsis>. Each former hive-* package is now a module subpath (./<sub>, ...).",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "clean": "rm -rf dist .tmp/test-dist",
    "check": "tsc --noEmit",
    "build": "pnpm run clean && tsc -p tsconfig.build.json && node ../../scripts/package-boundary/copy-dmts-to-dts.mjs dist",
    "test": "pnpm run build && node --test \".tmp/test-dist/**/*.test.mjs\"",
    "verify": "pnpm run check && pnpm run build"
  },
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "package.json"
  ],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs"
    },
    "./<sub>": {
      "types": "./dist/<sub>/index.d.ts",
      "import": "./dist/<sub>/index.mjs"
    },
    "./package.json": "./package.json"
  },
  "dependencies": {
    "<external workspace deps the former packages needed, e.g. \"@emsenn/relating\": \"workspace:*\">"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.8.0"
  },
  "sideEffects": false
}
```

Notes:

- Repeat the `"./<sub>": { types, import }` block once per former package.
- **Always** include `"./package.json": "./package.json"` as the last exports entry.
- Carry over (deduplicated, as the union) the external `dependencies`/`devDependencies` of all former `hive-*` packages.
  Drop any `@emsenn/hive-<sub>` cross-deps among the merged set — those become internal relative imports (§4).
  Add `fast-check` to devDependencies only if a former package used it.

Nested-subpath entries (relationality style), when a subpath is a single file `src/topology/dynamics.mts`:

```json
    "./topology/dynamics": {
      "types": "./dist/topology/dynamics.d.ts",
      "import": "./dist/topology/dynamics.mjs"
    },
```

### 4. Intra-package import rewriting (the critical step)

Three categories, handled differently:

1. **Same-module relative imports** (within one `<sub>/`): leave untouched.
  They already read `from "./foo.mjs"`.
2. **Cross-subpath imports** that were previously cross-package `@emsenn/hive-<other>`: rewrite to a **relative path into the sibling subpath's barrel**, not a self-subpath specifier.
  Example from games `src/analysis/cascade.mts`:
   ```ts
   } from "../algebra/index.mjs";
   } from "../topology/index.mjs";
   ```
So `@emsenn/hive-algebra` → `../algebra/index.mjs`, `@emsenn/hive-topology` → `../topology/index.mjs`.
(For a nested single-file subpath: `../topology/dynamics.mjs`.) **Never** use a `@emsenn/hive/<sub>` self-specifier internally.
3. **External package imports** (e.g. `@emsenn/relating/algebra`): leave untouched — they stay as subpath specifiers to the *other* package.

Also update any `thisPackage: "@emsenn/hive-<sub>"` string literals (e.g. games had one in `algebra/shadow.mts`) to `"@emsenn/hive/<sub>"`.

### 5. `lib/hive/src/index.mts` (root barrel)

Re-export each subpath as a **namespace** (avoids symbol collisions across former packages):

```ts
/**
 * @emsenn/hive — <synopsis>.
 *
 * This package merges the former hive-* library packages into one, each now a
 * module subpath:
 *   - `@emsenn/hive/<sub>` — <desc>
 *   ...
 *
 * The root re-exports each module under its own namespace for discoverability;
 * import the subpaths directly for the flat symbol surface of each module.
 */
export * as <sub> from "./<sub>/index.mjs";
// ...one line per subpath
```

(`export * as <sub>` is what avoids name collisions — the whole reason the merge is safe.
For a nested single-file subpath you generally do not re-export it from root; relationality re-exports only the directory-level barrels.)

### 6. tsconfig files

`lib/hive/tsconfig.json` (verbatim):

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["es2023"],
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.mts"]
}
```

`lib/hive/tsconfig.build.json` (verbatim):

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.mts"],
  "exclude": ["src/**/*.test.mts"]
}
```

The `rootDir: "src"` + `outDir: "dist"` mapping is what turns `src/<sub>/index.mts` into `dist/<sub>/index.mjs` (matching the exports map).
`tsc` under `nodenext` emits `.mjs` + `.d.mts`; the `copy-dmts-to-dts.mjs` build step then duplicates every `.d.mts` → `.d.ts` (and `.d.mts.map` → `.d.ts.map`, rewriting `sourceMappingURL` and the map `file` field) so the `"types": ".../index.d.ts"` resolutions exist.

### 7. Test config — conditional

- **Games has NO test files and NO `tsconfig.test.json`.** Its `"test"` script is vestigial (points at `.tmp/test-dist` that is never produced).
  If the merged `hive-*` packages have **no** `*.test.mts`, copy games exactly: use the games `"test"` line and create no `tsconfig.test.json`.
- **Relationality HAS test files**, so it adds `tsconfig.test.json` and a two-step test script.
  If any former `hive-*` package ships `*.test.mts`, use the relationality variant:

`"test"` script:
  ```
  "test": "pnpm run build && tsc -p tsconfig.test.json && node --test \".tmp/test-dist/**/*.test.mjs\"",
  ```
`lib/hive/tsconfig.test.json` (verbatim):
  ```json
  {
    "extends": "./tsconfig.json",
    "compilerOptions": {
      "noEmit": false,
      "declaration": false,
      "declarationMap": false,
      "sourceMap": true,
      "rootDir": "src",
      "outDir": ".tmp/test-dist"
    },
    "include": ["src/**/*.mts"]
  }
  ```
(Note this `include` does NOT exclude test files — it compiles them into `.tmp/test-dist`, where `node --test` then runs `**/*.test.mjs`.)

### 8. Delete old package dirs + swap consumer deps

- The former `lib/hive-<sub>/` directories are **fully removed** (`git mv` empties `src/`; then delete each leftover `package.json`, `tsconfig.json`, `tsconfig.build.json`, `.gitignore`).
  Confirmed for games: `lib/game-*` no longer exists in the tree or in git.
- For **every consumer** (apps/services/sites) that depended on any `@emsenn/hive-<sub>`:
  - In its `package.json` `dependencies`, replace all `"@emsenn/hive-<sub>": "workspace:*"` entries with a single `"@emsenn/hive": "workspace:*"`.
  - In its source, rewrite imports `@emsenn/hive-<sub>` → `@emsenn/hive/<sub>` (subpath specifier — consumers DO use the subpath form; only internal code uses relative paths).
- A separately-named computer app (games left `apps/game-computer` aside, but a hive analog like `apps/hive-computer` is just a consumer) — treat it as a normal consumer and swap its deps the same way.

### 9. Wiring up & verifying

```
pnpm install            # relinks workspace graph after the dep swaps
pnpm --filter @emsenn/hive run verify      # check (tsc --noEmit) + build
pnpm --filter @emsenn/hive run test        # only if §7 test variant
# then verify each consumer:
pnpm --filter <consumer> run verify
```

### Key files referenced (absolute paths)

- `/home/emsenn/561-group/lib/games/package.json` — flat-subpath package.json template
- `/home/emsenn/561-group/lib/games/src/index.mts` — root namespace barrel template
- `/home/emsenn/561-group/lib/games/tsconfig.json`, `/home/emsenn/561-group/lib/games/tsconfig.build.json` — tsconfig templates
- `/home/emsenn/561-group/lib/relating/package.json` — nested-subpath (`./topology/dynamics`) exports + test-bearing `"test"` script template
- `/home/emsenn/561-group/lib/relating/tsconfig.test.json` — test tsconfig template
- `/home/emsenn/561-group/scripts/package-boundary/copy-dmts-to-dts.mjs` — the `.d.mts`→`.d.ts` build step (shared, do not recreate)
- `/home/emsenn/561-group/pnpm-workspace.yaml` — globs `lib/*`; no edit needed
