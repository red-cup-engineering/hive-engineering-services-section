# Hive fleet observation method

`projectHiveFleetObservation(tick, tickDigest)` preserves source tick identity,
account-level observations, exact HIVE/HBD totals and interpretation limits.
Missing balances remain unknown. This method does not establish custody title,
authenticate an Actor, hire a provider, or execute wallet operations.

The source must explicitly provide an `accounts` array. An empty array is an
observed empty scope; an absent or malformed scope is refused. Missing execution
counts, operating flags and enabled lanes remain `null`, distinct from observed
zero, `false` and an empty lane list. Counts must be nonnegative safe integers;
malformed counts and totals beyond that range remain unknown. A fleet execution
total is known only when every account supplies that count. Receivers must not
interpret these unknowns as successful inactivity, income or complete coverage.
Every account record must name a nonempty string identity without surrounding
whitespace, and each identity may occur only once. Duplicate records are refused
before aggregation rather than counting the same account twice. Names are kept
as supplied; this observation method does not infer account aliases or ownership.

Red Cup supplies the method; Coesite binds provider identity, caller admission,
source reading and evidence custody. Consumers of this projection do not install
the resident fleet server, credential vault, signers, game integrations or legacy
Aagaard receiving protocols. Those other capabilities remain migration material
in the machine snapshot; this recovery does not claim their retirement.

The exact-number supplier is version 0.1.0 in Red Cup's computer-data source.
Both packages can be packed and supplied together to a consumer before registry
publication. A machine checkout and its folder ancestry are not dependencies.
