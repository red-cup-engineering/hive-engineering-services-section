/** Hive social and account observations as portable data utterances. */
import { utterEvidence } from "@red-cup-engineering/signcell/utterance";
const account = name => `hive.account.${name}`;
const post = (author, permlink) => `hive.post.${author}/${permlink}`;
const tag = name => `hive.tag.${name}`;
const community = name => `hive.community.${name}`;
const relation = (subject, predicate, object) => utterEvidence({ subject, predicate, ...(object === undefined ? {} : { object }) });
export const hiveVoteUtterance = (voter, author, permlink) => relation(account(voter), "hive.voted-on", post(author, permlink));
export const hiveUnvoteUtterance = (voter, author, permlink) => relation(account(voter), "hive.unvoted", post(author, permlink));
export const hiveFollowUtterance = (follower, followed) => relation(account(follower), "hive.follows", account(followed));
export const hiveUnfollowUtterance = (follower, followed) => relation(account(follower), "hive.unfollowed", account(followed));
export const hivePostExistsUtterance = (author, permlink) => relation(account(author), "hive.posted", post(author, permlink));
export const hiveTagUtterance = (author, permlink, name) => relation(post(author, permlink), "hive.tagged-with", tag(name));
export const hiveCommunityUtterance = (author, permlink, name) => relation(post(author, permlink), "hive.member-of", community(name));
export const hiveAccountActiveUtterance = name => relation(account(name), "hive.active");
export const hiveBalanceUtterance = name => relation(account(name), "hive.holds", "hive.asset.HIVE");
export const hiveHBDUtterance = name => relation(account(name), "hive.holds", "hive.asset.HBD");
export const hiveHivePowerUtterance = name => relation(account(name), "hive.holds", "hive.asset.HP");
export const hiveChainReference = value => Object.freeze({ kind: "hive.chain-reference", blockNum: value.blockNum, ...(value.blockId ? { blockId: value.blockId } : {}), ...(value.transactionId ? { transactionId: value.transactionId } : {}), ...(value.operationIndex === undefined ? {} : { operationIndex: value.operationIndex }), ...(value.irreversible === undefined ? {} : { irreversible: value.irreversible }) });
