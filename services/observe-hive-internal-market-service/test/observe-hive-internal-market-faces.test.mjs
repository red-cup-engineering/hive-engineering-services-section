import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { observeHiveInternalMarket } from "../scripts/observe-hive-internal-market.mjs";

const examples = [
  {
    "type": "JavascriptNodeOperationExample",
    "name": "cross-checks two agreeing fixture nodes and reports a $0.06 haircut against the external HBD spot",
    "input": {
      "accounts": ["emsenn0", "michael561"],
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
    },
    "output": {
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
  }
];

for (const example of examples) {
  test(example.name, async () => {
    const importedOutput = await observeHiveInternalMarket(example.input);
    assert.deepEqual(importedOutput, example.output);
    const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/observe-hive-internal-market.mjs", import.meta.url))], {
      input: JSON.stringify(example.input) + "\n",
      encoding: "utf8",
    });
    assert.equal(command.status, 0, command.stderr);
    const commandOutput = JSON.parse(command.stdout.trim());
    assert.deepEqual(commandOutput, example.output);
    assert.deepEqual(commandOutput, importedOutput);
  });
}
