// hive-engine-section — HE-specific section queries on a settled HiveEngineTopologyCarrier.
// Thin wrappers over the generic meme-topology section layer with HE term naming.
// There is no denial: an ended state is read at its contrary predicate's cell,
// never as a falsity polarity on the original cell.
import { financialAccountTerm, financialCommodityTerm, financialPositionTerm, holdsPositionPredicate, isLiquidPredicate, isStakedPredicate, } from "@red-cup-engineering/organizing/accounting/topology/financial";
import { hiveEngineTokenTerm, hiveEngineOrderTerm, hiveEngineDelegationTerm, hiveEngineNftTerm, hiveEngineDelegatedPredicate, hiveEngineUndelegatedPredicate, hiveEngineOpenOrderPredicate, hiveEngineClosedOrderPredicate, hiveEngineNftOwnedPredicate, hiveEngineNftReleasedPredicate, hiveEngineUnstakedPredicate, hiveEngineListedPredicate, } from "./hive-engine-topology.mjs";
import { about, evidenceIn, under } from "@red-cup-engineering/signcraft/settle";
import { financialKnowledgeSection } from "@red-cup-engineering/organizing/accounting/topology/financial";
/** The settled section of a HiveEngineTopologyCarrier. */
export const hiveEngineKnowledgeSection = financialKnowledgeSection;
/** The settled section of, read in the truth order: a HiveEngineTopologyCarrier. */
export const hiveEngineTruthSection = financialKnowledgeSection;
// ---------- single-cell evidence reads ----------
/** Evidence at "account holds token". */
export function hiveEngineHoldsEvidence(section, account, symbol) {
    return evidenceIn(section, financialAccountTerm(account), holdsPositionPredicate(), financialCommodityTerm(symbol));
}
/** Evidence at "account's token position is liquid". */
export function hiveEngineLiquidEvidence(section, account, symbol) {
    return evidenceIn(section, financialPositionTerm(account, symbol), isLiquidPredicate(), financialCommodityTerm(symbol));
}
/** Evidence at "account's token position is staked". */
export function hiveEngineStakeEvidence(section, account, symbol) {
    return evidenceIn(section, financialPositionTerm(account, symbol), isStakedPredicate(), financialCommodityTerm(symbol));
}
/** Evidence at "account's token position is unstaked" — the contrary predicate of is-staked. */
export function hiveEngineUnstakedEvidence(section, account, symbol) {
    return evidenceIn(section, financialPositionTerm(account, symbol), hiveEngineUnstakedPredicate(), financialCommodityTerm(symbol));
}
/** Evidence at "delegation from→to of token is in force". */
export function hiveEngineDelegationEvidence(section, from, to, symbol) {
    return evidenceIn(section, hiveEngineDelegationTerm(from, to, symbol), hiveEngineDelegatedPredicate(), hiveEngineTokenTerm(symbol));
}
/** Evidence at "delegation from→to of token ended" — the contrary predicate of delegated. */
export function hiveEngineUndelegationEvidence(section, from, to, symbol) {
    return evidenceIn(section, hiveEngineDelegationTerm(from, to, symbol), hiveEngineUndelegatedPredicate(), hiveEngineTokenTerm(symbol));
}
/** Evidence at "account has open order". */
export function hiveEngineOpenOrderEvidence(section, account, orderId) {
    return evidenceIn(section, financialAccountTerm(account), hiveEngineOpenOrderPredicate(), hiveEngineOrderTerm(orderId));
}
/** Evidence at "account's order closed" — the contrary predicate of open-order. */
export function hiveEngineOrderClosedEvidence(section, account, orderId) {
    return evidenceIn(section, financialAccountTerm(account), hiveEngineClosedOrderPredicate(), hiveEngineOrderTerm(orderId));
}
/** Evidence at "account owns NFT instance". */
export function hiveEngineNftEvidence(section, account, contract, nftId) {
    return evidenceIn(section, financialAccountTerm(account), hiveEngineNftOwnedPredicate(), hiveEngineNftTerm(contract, nftId));
}
/** Evidence at "account released NFT instance" — the contrary predicate of nft-owned. */
export function hiveEngineNftReleasedEvidence(section, account, contract, nftId) {
    return evidenceIn(section, financialAccountTerm(account), hiveEngineNftReleasedPredicate(), hiveEngineNftTerm(contract, nftId));
}
/** Evidence at "token is listed" — a diagonal cell on the token term. */
export function hiveEngineListedEvidence(section, symbol) {
    return evidenceIn(section, hiveEngineTokenTerm(symbol), hiveEngineListedPredicate());
}
// ---------- multi-entry section reads ----------
/** All predicates claimed about an account (financial-account subject). */
export function hiveEngineAccountEntries(section, account) {
    return about(section, financialAccountTerm(account));
}
/** All predicates claimed about a token as a chain object. */
export function hiveEngineTokenEntries(section, symbol) {
    return about(section, hiveEngineTokenTerm(symbol));
}
/** All holding entries (subjects of holds-position; spans HE tokens and any merged financial layer). */
export function hiveEngineAllHolderEntries(section) {
    return under(section, holdsPositionPredicate());
}
/** All in-force delegation entries. Ended delegations live at the undelegated predicate. */
export function hiveEngineAllDelegationEntries(section) {
    return under(section, hiveEngineDelegatedPredicate());
}
/** All ended-delegation entries — the contrary predicate's cells. */
export function hiveEngineAllUndelegationEntries(section) {
    return under(section, hiveEngineUndelegatedPredicate());
}
/** All open-order entries. Closed orders live at the closed-order predicate. */
export function hiveEngineAllOrderEntries(section) {
    return under(section, hiveEngineOpenOrderPredicate());
}
/** All NFT-ownership entries. Released NFTs live at the nft-released predicate. */
export function hiveEngineAllNftEntries(section) {
    return under(section, hiveEngineNftOwnedPredicate());
}
