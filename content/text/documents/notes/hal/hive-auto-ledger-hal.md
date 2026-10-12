---
title: "Overview"
aliases:
  - Hive Auto Ledger (HAL)
---
## Overview

Hive Auto-Ledger (HAL) is a comprehensive platform designed to manage Hive blockchain wallets with a focus on transparency, usability, and automation. The app will provide tools to track wallet contents, manage transactions, and analyze market data, all while maintaining an accurate Beancount ledger. Future iterations will integrate advanced features such as trade bots, post analytics, CMS capabilities, and tokenomics.

## Roadmap
### HIVE/HBD Market Analyzer

- A view of the current metrics around HIVE/HBD trade and book details, on the chain's internal market.
- Include trade analysis information, VWAP, etc.
### Subscription
- Users can subscribe to HAL by delegating 10 (or more) HP to `@hiveautoledger` (Tier 1 Subscriber)
- Subscription lasts as long as the delegator
- Validated by logging in with Hive Keychain
- Subscribers gain access to, at first, a synthesis of trade analysis into signals: buy/sell, discounted/elevated value, etc.
- Subscribers will be curated by `@hiveautoledger` proportional to delegation.
### Market History Analyzer
- Keep market data in a database
- Include longer-term trade analysis information
- Subscribers can see longer-term analysis synthesis/signals.
- Subscribers who delegate >50HP (Tier 2 subscriber) can export this data
### Wallet Analyzer
- A view of a wallet's HIVE/HBD holdings, staked and liquid
- Tier 2 subscribers get their account history turned into a double-booked ledger, where holdings have cost basis
- Tier 3 subscribers can use that, and info from the Market History Analyzer, to show like, what the wallet's market value and at cost for its holdings were, over time, convert all value to HIVE on a given day, or HBD
- Tier 3 can export of wallet history as Beancount file
### Hive Engine Token Pair Analyzer
- A view on the market between tokens paired on TribalDex
- Same subscription stuff as mainchain
### Wallet Engine Analyzer
- Same as the other wallet analyzer, but for the Engine tokens
- same subscription stuff as mainchain
### Synthesized Wallet Analyzer
- Wallet analyzer that takes both parts into account
- same subscription stuff as mainchain
### HIVE/HBD Trade Interface
- Allow trading from the trade analysis interface
- Free
### HIVE/HBD Trade Automation
- Interface for creating and managing trade bots
- bot designer available to tier 4
	- trade cycle frequency, buy/sell conditions
- pay-to-deploy, pay-per-cycle, pay-per-trade
	- users bots prioritized by subscription delegation amount
### HAL Token Launch
- 100,000 HAL are minted and distributed based on all-time curation returns.
- HAL/SWAP.HBD liquidity-pool established
### Engine DEX
- Set up frontend for the Engine DEX
### Content Analytics
- Look at the curation rewards and all available analytics for a given Hive post/comment.
### Wallet Post Analytics
- Look at the metrics for all of a wallets posts
### Wallet curation analytics
- Look at a the metrics for a wallet's curation
### Content Management
- Allow users to draft, edit, publish posts
- allow for post templating and scheduling
### AI content analytics
- use AI to do more analysis of content
### AI content writing
- use AI to do help folk write content

## Tokens

HAL is designed to support a robust token-based economy, with its own set of tokens to help provide that support.

### Layer 1
#### HAL
HAL is the governance and utility token at the core of the Hive Auto Ledger (HAL) platform, designed to integrate all aspects of its economy into a single, cohesive system. HAL facilitates decentralized decision-making, with governance weighted by staked tokens. Users propose changes, allocate resources, and guide development by staking and spending HAL, creating a self-sustaining cycle of demand.

Revenue from the platform—whether from pay-to-use features like market analytics, trading fees, or contributions like Hive Power delegation—is collected in various tokens and converted into HAL through market buybacks. This ensures HAL remains the sole internal currency, directly tying its value to the platform’s success. Early liquidity providers register their contributions manually, earning proportional rewards in HAL, with plans to evolve into tokenized liquidity pool models as the system scales.

As the platform grows, HAL’s utility extends to funding proposals, incentivizing community engagement, and supporting key infrastructure like Resource Credit management. Its economy is built to align incentives, ensuring every participant—from app users to liquidity providers to governance contributors—can shape and benefit from the platform’s success. HAL is not just a token; it is the foundation of a circular, utility-driven economy designed to evolve alongside the Hive Auto Ledger.



### Layer 2
#### Liquidity Deriviatives
##### HLDSHBD
HLDSHBD is a liquid token derived from pooled staked HBD. The token is managed by a smart contract that stakes all deposited HBD, earning rewards that are automatically compounded back into the pool. HLDSHBD represents a proportional claim on the pool, including both the staked principal and accrued rewards. The token can be traded or integrated into DeFi protocols, offering holders liquidity and yield simultaneously. Redemption is facilitated by sending HLDSHBD to the contract, which unstakes and returns the corresponding share of the pool’s value to the sender.

##### HLDSHP
HLDSHP (HAL Liquidity Derivative, Staked Hive Power) is a straightforward financial tool representing pooled staked Hive Power. Users stake HIVE through a smart contract, receiving HLDSHP tokens that denote their proportional share of the pool. Staking rewards are compounded automatically, and redemption involves returning HLDSHP to the contract, which unstakes the corresponding HIVE and distributes it after the standard on-chain unstaking period.
#### Liquidity Pools
##### HLPSWAPHBD
- Pairing of HAL and SWAPHBD
##### HLPSWAPHIVE
- Pairing of HAL and SWAPHIVE
### Layer 3
#### Liquidity Pools
Each of the tokens in layer 1 can be paired with each of the tokens in layer 2, for Layer 3 LPs.

For example, HAL and HLDSHAL can be paired to make HLPHLDSHAL (when a HLP token is starting with HAL, we don't bother putting that in the name. it's the only thing we can do to keep them shorter)

### Layer 4
#### Liquidity Pools

Every token in Layer 1 and Layer 2 can be paired with every token in Layer 3, for 84 Layer 4 LPs.

Here'd be a potential token and its breakdown:

- HLP
	- HLP
		- HLD
			- SHAL
		- HLD
			- SHP
	- HLP
		- HLD
			- SHAL
		- HLD
			- SHBD

For a token name of $HLPHLPHLDSHALHLDSHPHLPHLDSHALHLDSHBD

Where HLP stands for HAL Liquid Derivative and HLP for HAL Liquidity Pair, SHAL for Staked HAL, SHP for Staked Hive Power, SHBD for Staked Hive Backed Dollar

