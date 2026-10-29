# @red-cup-engineering/observe-hive-internal-market-service

Observes the Hive base-layer internal HIVE/HBD market book, spread, and depth cross-checked across two public nodes, the recent ticker and volume, the feed's median price, the external HIVE and HBD USD prices, the resulting haircut, and the HBD conversion queue, read-only.

## Operation

~~~js
export async function observeHiveInternalMarket(request = {})
~~~

### Parameters

- request (@param {readonly string[]} [request.nodes] Two public Hive JSON-RPC node base URLs to
 *   cross-check (default `["https://api.hive.blog","https://api.openhive.network"]`).
 * @param {number} [request.orderBookDepth] `condenser_api.get_order_book` depth per side (default 20).
 * @param {number} [request.bandBasisPoints] Price band around mid, in basis points, for the reported depth sums (default 200).
 * @param {number} [request.toleranceBasisPoints] Max allowed best-bid/best-ask disagreement between the two nodes, in basis points, before refusal (default 50).
 * @param {number} [request.maxBlockGap] Max allowed head-block-number disagreement between the two nodes before refusal (default 3).
 * @param {readonly string[]} [request.accounts] Accounts to read the HBD conversion queue for (default `["emsenn0","michael561"]`).
 * @param {typeof fetch} [request.fetchImpl] Injectable fetch implementation, for tests.
 * @param {object} [request.fixtures] Literal pre-recorded results (`dynamicGlobalProperties`, `orderBook` keyed by node; `ticker`, `volume`, `feedHistory` for the primary node; `conversionQueue` keyed by account; `coingecko` keyed by CoinGecko id) that stand in for the live read they name, for deterministic replay.
 * @param {string} [request.now] An injectable ISO instant for `observedAt`, for deterministic replay (default the real current time).
 * ): 

### Returns

Promise<object>: A `HiveInternalMarketObservationRecord`: `{type,version,observedAt,witnesses,book,bestBid,bestAsk,spread,depthWithinBand,ticker,volume,feed,externalPrices,internalHbdPriceUsd,haircut,conversionQueue}`.

### Refusals

- TypeError: When `request.nodes` names fewer than two nodes.
- Error: `HIVE_INTERNAL_MARKET_NODE_DISAGREEMENT` when the two nodes' head-block-number or best-bid/best-ask readings disagree beyond the declared tolerance.
- Error: `HIVE_INTERNAL_MARKET_EXTERNAL_PRICE_UNAVAILABLE` when CoinGecko does not price HIVE and/or HBD.

## Command

observe-hive-internal-market reads one JSON value per input line and writes one JSON value per output line.

## Examples

### cross-checks two agreeing fixture nodes and reports a $0.06 haircut against the external HBD spot

Input:

~~~json
{
  "nodes": [
    "https://api.hive.blog",
    "https://api.openhive.network"
  ],
  "now": "2026-09-05T00:00:00.000Z",
  "fixtures": {
    "dynamicGlobalProperties": {
      "https://api.hive.blog": {
        "head_block_number": 100000
      },
      "https://api.openhive.network": {
        "head_block_number": 100001
      }
    },
    "orderBook": {
      "https://api.hive.blog": {
        "bids": [
          {
            "real_price": "0.0549",
            "hive": 100000,
            "hbd": 5490,
            "created": "2026-09-05T00:00:00"
          },
          {
            "real_price": "0.03",
            "hive": 200000,
            "hbd": 6000,
            "created": "2026-09-05T00:00:01"
          }
        ],
        "asks": [
          {
            "real_price": "0.0551",
            "hive": 50000,
            "hbd": 2755,
            "created": "2026-09-05T00:00:02"
          },
          {
            "real_price": "0.09",
            "hive": 80000,
            "hbd": 7200,
            "created": "2026-09-05T00:00:03"
          }
        ]
      },
      "https://api.openhive.network": {
        "bids": [
          {
            "real_price": "0.0549",
            "hive": 100000,
            "hbd": 5490,
            "created": "2026-09-05T00:00:00"
          },
          {
            "real_price": "0.03",
            "hive": 200000,
            "hbd": 6000,
            "created": "2026-09-05T00:00:01"
          }
        ],
        "asks": [
          {
            "real_price": "0.0551",
            "hive": 50000,
            "hbd": 2755,
            "created": "2026-09-05T00:00:02"
          },
          {
            "real_price": "0.09",
            "hive": 80000,
            "hbd": 7200,
            "created": "2026-09-05T00:00:03"
          }
        ]
      }
    },
    "ticker": {
      "latest": "0.055",
      "lowest_ask": "0.0551",
      "highest_bid": "0.0549",
      "percent_change": "0",
      "hive_volume": {
        "amount": "1000000",
        "precision": 3,
        "nai": "@@000000021"
      },
      "hbd_volume": {
        "amount": "50000",
        "precision": 3,
        "nai": "@@000000013"
      }
    },
    "volume": {
      "hive_volume": {
        "amount": "1000000",
        "precision": 3,
        "nai": "@@000000021"
      },
      "hbd_volume": {
        "amount": "50000",
        "precision": 3,
        "nai": "@@000000013"
      }
    },
    "feedHistory": {
      "current_median_history": {
        "base": "0.05 HBD",
        "quote": "1.000 HIVE"
      }
    },
    "conversionQueue": {
      "emsenn0": {
        "conversions": [
          {
            "id": 1,
            "owner": "emsenn0",
            "requestid": 1,
            "amount": "10.000 HBD",
            "conversion_date": "2026-09-10T00:00:00"
          }
        ],
        "collateralizedConversions": []
      },
      "michael561": {
        "conversions": [],
        "collateralizedConversions": []
      }
    },
    "coingecko": {
      "hive": 0.05,
      "hive_dollar": 0.94
    }
  }
}
~~~

Output:

~~~json
{
  "type": "HiveInternalMarketObservationRecord",
  "version": 1,
  "observedAt": "2026-09-05T00:00:00.000Z",
  "witnesses": [
    {
      "node": "https://api.hive.blog",
      "headBlockNumber": 100000
    },
    {
      "node": "https://api.openhive.network",
      "headBlockNumber": 100001
    }
  ],
  "book": {
    "depth": 20,
    "bids": [
      {
        "priceHbdPerHive": "0.0549",
        "hive": "100",
        "hbd": "5.49",
        "created": "2026-09-05T00:00:00"
      },
      {
        "priceHbdPerHive": "0.03",
        "hive": "200",
        "hbd": "6",
        "created": "2026-09-05T00:00:01"
      }
    ],
    "asks": [
      {
        "priceHbdPerHive": "0.0551",
        "hive": "50",
        "hbd": "2.755",
        "created": "2026-09-05T00:00:02"
      },
      {
        "priceHbdPerHive": "0.09",
        "hive": "80",
        "hbd": "7.2",
        "created": "2026-09-05T00:00:03"
      }
    ]
  },
  "bestBid": "0.0549",
  "bestAsk": "0.0551",
  "spread": {
    "hbdPerHive": "0.0002",
    "basisPoints": "36.363636"
  },
  "depthWithinBand": {
    "bandBasisPoints": 200,
    "bid": {
      "hive": "100",
      "hbd": "5.49",
      "orders": 1
    },
    "ask": {
      "hive": "50",
      "hbd": "2.755",
      "orders": 1
    }
  },
  "ticker": {
    "latest": "0.055",
    "lowestAsk": "0.0551",
    "highestBid": "0.0549",
    "percentChange": "0",
    "hiveVolume": "1000",
    "hbdVolume": "50"
  },
  "volume": {
    "hiveVolume": "1000",
    "hbdVolume": "50"
  },
  "feed": {
    "currentMedianHistory": {
      "base": "0.05 HBD",
      "quote": "1.000 HIVE"
    },
    "impliedHbdPerHive": "0.05"
  },
  "externalPrices": {
    "source": "coingecko",
    "coingeckoIds": {
      "hive": "hive",
      "hbd": "hive_dollar"
    },
    "hiveUsd": "0.05",
    "hbdUsd": "0.94"
  },
  "internalHbdPriceUsd": "1",
  "haircut": {
    "vsExternalHbdUsd": {
      "absoluteUsd": "0.06",
      "basisPoints": "638.297872"
    },
    "vsOneDollarPar": {
      "absoluteUsd": "0",
      "basisPoints": "0"
    }
  },
  "conversionQueue": {
    "emsenn0": {
      "conversions": [
        {
          "id": 1,
          "owner": "emsenn0",
          "requestid": 1,
          "amount": "10.000 HBD",
          "conversion_date": "2026-09-10T00:00:00"
        }
      ],
      "collateralizedConversions": []
    },
    "michael561": {
      "conversions": [],
      "collateralizedConversions": []
    }
  }
}
~~~
