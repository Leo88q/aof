/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/aof_core.json`.
 */
export type AofCore = {
  "address": "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq",
  "metadata": {
    "name": "aofCore",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "NeuroForge — Age of Intelligence core program"
  },
  "instructions": [
    {
      "name": "adjustPlayerCapacity",
      "discriminator": [
        207,
        232,
        48,
        248,
        66,
        147,
        154,
        158
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "player.owner",
                "account": "Player"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "delta",
          "type": "i32"
        },
        {
          "name": "hasTent",
          "type": "bool"
        }
      ]
    },
    {
      "name": "auctionBid",
      "discriminator": [
        83,
        236,
        86,
        75,
        173,
        170,
        235,
        201
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bidder",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "auction",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "previousBidder",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "auctionCreate",
      "discriminator": [
        127,
        58,
        10,
        94,
        55,
        185,
        42,
        51
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tool"
        },
        {
          "name": "sellerToken",
          "writable": true
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "auctionVault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "minBid",
          "type": "u64"
        },
        {
          "name": "durationSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "auctionSettle",
      "discriminator": [
        125,
        3,
        88,
        2,
        1,
        6,
        23,
        26
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "seller",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "auctionVault",
          "writable": true
        },
        {
          "name": "winnerToken",
          "writable": true
        },
        {
          "name": "tool",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "burnNft",
      "discriminator": [
        119,
        13,
        183,
        17,
        194,
        243,
        38,
        31
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "burnResource",
      "discriminator": [
        252,
        54,
        4,
        35,
        74,
        224,
        187,
        19
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "resourceKind"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "burnTool",
      "discriminator": [
        149,
        3,
        119,
        187,
        129,
        207,
        46,
        27
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "toolData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "buyLotteryTicket",
      "discriminator": [
        88,
        10,
        212,
        209,
        116,
        244,
        214,
        255
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "lotteryRound",
          "writable": true
        },
        {
          "name": "lotteryTicket",
          "writable": true
        },
        {
          "name": "ticketCounter",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "cancelBuyOrder",
      "discriminator": [
        168,
        199,
        175,
        242,
        230,
        250,
        27,
        100
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "maker",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "order",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "cancelSellOrder",
      "discriminator": [
        35,
        49,
        106,
        38,
        91,
        127,
        157,
        20
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "maker",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "order",
          "writable": true
        },
        {
          "name": "orderVault",
          "writable": true
        },
        {
          "name": "makerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claimLotteryPrize",
      "discriminator": [
        52,
        56,
        145,
        142,
        169,
        97,
        28,
        116
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "lotteryRound",
          "writable": true
        },
        {
          "name": "lotteryTicket"
        },
        {
          "name": "winner",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimSeasonReward",
      "discriminator": [
        129,
        96,
        145,
        129,
        154,
        203,
        29,
        150
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "materialMints"
        },
        {
          "name": "season"
        },
        {
          "name": "seasonPass",
          "writable": true
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "auth"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "level",
          "type": "u8"
        },
        {
          "name": "premiumTrack",
          "type": "bool"
        }
      ]
    },
    {
      "name": "collectBread",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u0421\u0431\u043e\u0440 \u0433\u043e\u0442\u043e\u0432\u043e\u0433\u043e \u0445\u043b\u0435\u0431\u0430 \u0441 \u043f\u0435\u0447\u0438"
      ],
      "discriminator": [
        34,
        18,
        53,
        67,
        153,
        220,
        4,
        61
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "ovenState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  118,
                  101,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "breadMint",
          "writable": true
        },
        {
          "name": "userBread",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "collectFlour",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u0421\u0431\u043e\u0440 \u0433\u043e\u0442\u043e\u0432\u043e\u0439 \u043c\u0443\u043a\u0438 \u0441 \u043c\u0435\u043b\u044c\u043d\u0438\u0446\u044b"
      ],
      "discriminator": [
        75,
        219,
        64,
        128,
        18,
        22,
        144,
        234
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "millState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  108,
                  108,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "flourMint",
          "writable": true
        },
        {
          "name": "userFlour",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "collectMining",
      "discriminator": [
        33,
        146,
        126,
        198,
        213,
        79,
        169,
        210
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "payoutMint",
          "writable": true
        },
        {
          "name": "payoutToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "collectWellWater",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u0421\u0431\u043e\u0440 \u0432\u043e\u0434\u044b \u0438\u0437 \u043a\u043e\u043b\u043e\u0434\u0446\u0430"
      ],
      "discriminator": [
        158,
        216,
        6,
        212,
        63,
        164,
        34,
        24
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "player"
        },
        {
          "name": "materialMints"
        },
        {
          "name": "wellState",
          "writable": true
        },
        {
          "name": "weatherState"
        },
        {
          "name": "auth"
        },
        {
          "name": "waterMint",
          "writable": true
        },
        {
          "name": "userWater",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "collectorStake",
      "discriminator": [
        186,
        188,
        29,
        252,
        163,
        190,
        68,
        70
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "userToken",
          "writable": true
        },
        {
          "name": "vault"
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "stakedCollector",
          "writable": true
        },
        {
          "name": "collectorAllow"
        },
        {
          "name": "player",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "collectorKind"
            }
          }
        }
      ]
    },
    {
      "name": "collectorUnstake",
      "discriminator": [
        121,
        45,
        226,
        172,
        27,
        180,
        45,
        254
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "userToken",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "stakedCollector",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  101,
                  99,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "gastank",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  115,
                  116,
                  97,
                  110,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "commitLotteryDraw",
      "discriminator": [
        33,
        145,
        155,
        216,
        175,
        15,
        179,
        138
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "lotteryRound",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  116,
                  116,
                  101,
                  114,
                  121,
                  95,
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "lottery_round.round_id",
                "account": "LotteryRound"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "commitHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "craft",
      "discriminator": [
        161,
        233,
        177,
        214,
        243,
        109,
        161,
        224
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "gastank",
          "writable": true
        },
        {
          "name": "prevTool",
          "writable": true
        },
        {
          "name": "prevMint",
          "writable": true
        },
        {
          "name": "prevToken",
          "writable": true
        },
        {
          "name": "newMint",
          "writable": true
        },
        {
          "name": "newToken",
          "writable": true
        },
        {
          "name": "newToolData",
          "writable": true
        },
        {
          "name": "auth"
        },
        {
          "name": "rarityCounter",
          "writable": true
        },
        {
          "name": "craftEconomy"
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "foodMint",
          "writable": true
        },
        {
          "name": "userFood",
          "writable": true
        },
        {
          "name": "seedsMint",
          "writable": true
        },
        {
          "name": "userSeeds",
          "writable": true
        },
        {
          "name": "waterMint",
          "writable": true
        },
        {
          "name": "userWater",
          "writable": true
        },
        {
          "name": "potatoMint",
          "writable": true
        },
        {
          "name": "userPotato",
          "writable": true
        },
        {
          "name": "skrMint",
          "writable": true
        },
        {
          "name": "userSkr",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "toolType",
          "type": "string"
        },
        {
          "name": "rarity",
          "type": {
            "defined": {
              "name": "rarity"
            }
          }
        }
      ]
    },
    {
      "name": "craftOrderCancel",
      "discriminator": [
        72,
        33,
        167,
        12,
        104,
        178,
        254,
        144
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "craftOrder",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "craftOrderCreate",
      "discriminator": [
        206,
        24,
        56,
        85,
        71,
        6,
        137,
        97
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "craftOrder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  97,
                  102,
                  116,
                  95,
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "woodNeeded",
          "type": "u64"
        },
        {
          "name": "stoneNeeded",
          "type": "u64"
        },
        {
          "name": "premiumLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "craftOrderFulfill",
      "discriminator": [
        251,
        90,
        95,
        48,
        249,
        94,
        145,
        204
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "fulfiller",
          "writable": true,
          "signer": true
        },
        {
          "name": "craftOrder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  97,
                  102,
                  116,
                  95,
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "craft_order.creator",
                "account": "CraftOrder"
              }
            ]
          }
        },
        {
          "name": "creatorRefund",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "woodMint"
        },
        {
          "name": "fulfillerWood",
          "writable": true
        },
        {
          "name": "creatorWood",
          "writable": true
        },
        {
          "name": "stoneMint"
        },
        {
          "name": "fulfillerStone",
          "writable": true
        },
        {
          "name": "creatorStone",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "craftRecipe",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u041c\u0433\u043d\u043e\u0432\u0435\u043d\u043d\u044b\u0439 \u043a\u0440\u0430\u0444\u0442 \u0433\u0435\u043c\u043e\u0432/\u0431\u0430\u043d\u043e\u0447\u0435\u043a (recipe_id 0-7)"
      ],
      "discriminator": [
        184,
        206,
        123,
        148,
        189,
        124,
        168,
        0
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "materialMints"
        },
        {
          "name": "auth"
        },
        {
          "name": "input1Mint",
          "writable": true
        },
        {
          "name": "input1Acc",
          "writable": true
        },
        {
          "name": "input2Mint",
          "writable": true
        },
        {
          "name": "input2Acc",
          "writable": true
        },
        {
          "name": "outputMint",
          "writable": true
        },
        {
          "name": "outputAcc",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "recipeId",
          "type": "u8"
        }
      ]
    },
    {
      "name": "depositGas",
      "discriminator": [
        164,
        223,
        20,
        23,
        50,
        107,
        168,
        108
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "gastank",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  115,
                  116,
                  97,
                  110,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "drawLottery",
      "discriminator": [
        17,
        188,
        124,
        77,
        90,
        34,
        97,
        19
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "lotteryRound",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  116,
                  116,
                  101,
                  114,
                  121,
                  95,
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "lottery_round.round_id",
                "account": "LotteryRound"
              }
            ]
          }
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "secret",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "exploreReveal",
      "discriminator": [
        16,
        121,
        80,
        56,
        125,
        254,
        216,
        215
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "explorationState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  112,
                  108,
                  111,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "exploration_commit.user",
                "account": "ExplorationCommit"
              }
            ]
          }
        },
        {
          "name": "explorationCommit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  112,
                  108,
                  111,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  99,
                  111,
                  109,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "exploration_commit.tool_mint",
                "account": "ExplorationCommit"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "secret",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "forgeAttemptCommit",
      "discriminator": [
        89,
        191,
        80,
        34,
        38,
        104,
        53,
        252
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "tool_mint"
              }
            ]
          }
        },
        {
          "name": "toolMint"
        },
        {
          "name": "enchantSlot",
          "writable": true
        },
        {
          "name": "forgeCommit",
          "writable": true
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "slotType",
          "type": "u8"
        },
        {
          "name": "commitHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "useProtector",
          "type": "bool"
        }
      ]
    },
    {
      "name": "forgeAttemptReveal",
      "discriminator": [
        6,
        210,
        51,
        190,
        121,
        55,
        64,
        35
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "enchantSlot",
          "writable": true
        },
        {
          "name": "forgeCommit",
          "writable": true
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "secret",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "forgeAttemptExpire",
      "docs": [
        "Refund an expired forge commit (re-mint burned wood/stone, return escrowed fee + rent)."
      ],
      "discriminator": [
        206,
        118,
        31,
        164,
        99,
        185,
        27,
        61
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "forgeCommit",
          "writable": true
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "grantSeasonXp",
      "discriminator": [
        164,
        174,
        57,
        51,
        25,
        50,
        194,
        250
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "user"
        },
        {
          "name": "season",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  115,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "season.season_id",
                "account": "Season"
              }
            ]
          }
        },
        {
          "name": "seasonPass",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  115,
                  111,
                  110,
                  95,
                  112,
                  97,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "season.season_id",
                "account": "Season"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u32"
        }
      ]
    },
    {
      "name": "harvestWheat",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u0421\u0431\u043e\u0440 \u043f\u0448\u0435\u043d\u0438\u0446\u044b \u0441 \u0433\u043e\u0442\u043e\u0432\u043e\u0433\u043e \u0442\u0430\u0439\u043b\u0430"
      ],
      "discriminator": [
        170,
        219,
        76,
        224,
        75,
        193,
        177,
        108
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "energyAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  101,
                  114,
                  103,
                  121,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "farmTile",
          "writable": true
        },
        {
          "name": "toolData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "tool_data.mint",
                "account": "ToolData"
              }
            ]
          }
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "wheatMint",
          "writable": true
        },
        {
          "name": "userWheat",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tileIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initCraftEconomy",
      "discriminator": [
        63,
        105,
        210,
        112,
        67,
        179,
        176,
        134
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "craftEconomy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  97,
                  102,
                  116,
                  95,
                  101,
                  99,
                  111,
                  110,
                  111,
                  109,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initLotteryRound",
      "discriminator": [
        208,
        250,
        71,
        151,
        138,
        77,
        160,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "lotteryRound",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  116,
                  116,
                  101,
                  114,
                  121,
                  95,
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "round_id"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initMaterialMints",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u0418\u043d\u0438\u0446\u0438\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f MaterialMints PDA \u0441 \u0430\u0434\u0440\u0435\u0441\u0430\u043c\u0438 23 \u043c\u0438\u043d\u0442\u043e\u0432"
      ],
      "discriminator": [
        29,
        246,
        87,
        231,
        232,
        36,
        192,
        169
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "materialMints",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "seeds",
          "type": "pubkey"
        },
        {
          "name": "wheat",
          "type": "pubkey"
        },
        {
          "name": "flour",
          "type": "pubkey"
        },
        {
          "name": "bread",
          "type": "pubkey"
        },
        {
          "name": "water",
          "type": "pubkey"
        },
        {
          "name": "coal",
          "type": "pubkey"
        },
        {
          "name": "meat",
          "type": "pubkey"
        },
        {
          "name": "stoneBlue",
          "type": "pubkey"
        },
        {
          "name": "stonePurple",
          "type": "pubkey"
        },
        {
          "name": "stoneRed",
          "type": "pubkey"
        },
        {
          "name": "sandWhite",
          "type": "pubkey"
        },
        {
          "name": "sandPink",
          "type": "pubkey"
        },
        {
          "name": "sandYellow",
          "type": "pubkey"
        },
        {
          "name": "gemBlue",
          "type": "pubkey"
        },
        {
          "name": "gemOrange",
          "type": "pubkey"
        },
        {
          "name": "gemWhite",
          "type": "pubkey"
        },
        {
          "name": "gemGreen",
          "type": "pubkey"
        },
        {
          "name": "flaskBlue",
          "type": "pubkey"
        },
        {
          "name": "flaskYellow",
          "type": "pubkey"
        },
        {
          "name": "flaskGreen",
          "type": "pubkey"
        },
        {
          "name": "flaskPink",
          "type": "pubkey"
        },
        {
          "name": "flaskPurple",
          "type": "pubkey"
        },
        {
          "name": "loveHeart",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initPackConfig",
      "discriminator": [
        12,
        9,
        194,
        89,
        200,
        200,
        243,
        84
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "packConfig",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "packType",
          "type": "u8"
        },
        {
          "name": "priceLamports",
          "type": "u64"
        },
        {
          "name": "oddsBps",
          "type": {
            "array": [
              "u16",
              5
            ]
          }
        }
      ]
    },
    {
      "name": "initRarityCounter",
      "discriminator": [
        129,
        105,
        6,
        249,
        164,
        72,
        113,
        47
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "rarityCounter",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "rarity",
          "type": {
            "defined": {
              "name": "rarity"
            }
          }
        }
      ]
    },
    {
      "name": "initRerollConfig",
      "discriminator": [
        39,
        188,
        128,
        78,
        177,
        35,
        254,
        2
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "rerollConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  114,
                  111,
                  108,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "oddsBps",
          "type": {
            "array": [
              "u16",
              5
            ]
          }
        }
      ]
    },
    {
      "name": "initSeason",
      "discriminator": [
        179,
        47,
        101,
        197,
        114,
        97,
        174,
        98
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "season",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  115,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "season_id"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "seasonId",
          "type": "u32"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "programData"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "marketplaceBuy",
      "discriminator": [
        92,
        247,
        50,
        140,
        72,
        120,
        69,
        249
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "seller",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tool",
          "writable": true
        },
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "listingVault",
          "writable": true
        },
        {
          "name": "buyerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "marketplaceCancel",
      "discriminator": [
        36,
        142,
        66,
        132,
        187,
        198,
        47,
        134
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "listingVault",
          "writable": true
        },
        {
          "name": "sellerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "marketplaceList",
      "discriminator": [
        126,
        197,
        146,
        219,
        11,
        249,
        104,
        168
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tool"
        },
        {
          "name": "sellerToken",
          "writable": true
        },
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "listingVault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "priceLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "matchResourceOrders",
      "discriminator": [
        159,
        91,
        215,
        168,
        28,
        187,
        235,
        211
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "buyOrder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  117,
                  114,
                  99,
                  101,
                  95,
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "buy_order.maker",
                "account": "ResourceOrder"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "sellOrder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  117,
                  114,
                  99,
                  101,
                  95,
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "sell_order.maker",
                "account": "ResourceOrder"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "seller",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "sellVault",
          "writable": true
        },
        {
          "name": "buyerToken",
          "docs": [
            "\u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c \u2014 \u0432\u043b\u0430\u0434\u0435\u043b\u0435\u0446 buy_order, \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442 \u0440\u0435\u0441\u0443\u0440\u0441"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "migrateTool",
      "discriminator": [
        178,
        226,
        104,
        122,
        30,
        161,
        143,
        250
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "migrationAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "toolData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "toolType",
          "type": "string"
        },
        {
          "name": "rarity",
          "type": {
            "defined": {
              "name": "rarity"
            }
          }
        },
        {
          "name": "durability",
          "type": "u8"
        }
      ]
    },
    {
      "name": "mintResource",
      "discriminator": [
        2,
        118,
        133,
        91,
        220,
        176,
        214,
        105
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "materialMints"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "auth"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "treasuryToken",
          "writable": true
        },
        {
          "name": "player",
          "writable": true
        },
        {
          "name": "issuanceCap",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "resourceKind"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mintTool",
      "discriminator": [
        9,
        202,
        31,
        77,
        56,
        227,
        14,
        40
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "auth"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "recipient",
          "writable": true
        },
        {
          "name": "toolData",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "toolType",
          "type": "string"
        },
        {
          "name": "rarity",
          "type": {
            "defined": {
              "name": "rarity"
            }
          }
        }
      ]
    },
    {
      "name": "offerAccept",
      "discriminator": [
        218,
        1,
        39,
        54,
        53,
        67,
        142,
        34
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "offer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "offer.buyer",
                "account": "Offer"
              }
            ]
          }
        },
        {
          "name": "buyerRefund",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "sellerToken",
          "writable": true
        },
        {
          "name": "buyerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "offerCancel",
      "discriminator": [
        243,
        115,
        206,
        248,
        38,
        241,
        122,
        53
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "mint"
        },
        {
          "name": "offer",
          "writable": true
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "offerCreate",
      "discriminator": [
        119,
        123,
        83,
        165,
        54,
        130,
        202,
        150
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "offer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "priceLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "packOpenCommit",
      "discriminator": [
        119,
        24,
        174,
        81,
        188,
        146,
        76,
        40
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "packConfig"
        },
        {
          "name": "auth"
        },
        {
          "name": "mint"
        },
        {
          "name": "packCommit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107,
                  95,
                  99,
                  111,
                  109,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "packType",
          "type": {
            "defined": {
              "name": "packType"
            }
          }
        },
        {
          "name": "commitHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "packOpenReveal",
      "discriminator": [
        220,
        51,
        163,
        236,
        133,
        22,
        85,
        61
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "packCommit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107,
                  95,
                  99,
                  111,
                  109,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "packConfig"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "userToken",
          "writable": true
        },
        {
          "name": "toolData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "secret",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "packOpenExpire",
      "docs": [
        "Refund an expired pack commit (escrow + rent back to the player)."
      ],
      "discriminator": [
        8,
        126,
        131,
        194,
        12,
        202,
        159,
        29
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "packCommit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  99,
                  107,
                  95,
                  99,
                  111,
                  109,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "mint"
        }
      ],
      "args": []
    },
    {
      "name": "payOut",
      "discriminator": [
        122,
        7,
        14,
        119,
        71,
        188,
        166,
        34
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "vault"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "userToken",
          "writable": true
        },
        {
          "name": "player"
        },
        {
          "name": "materialMints"
        },
        {
          "name": "vaultGuard",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payOutWithReferral",
      "discriminator": [
        250,
        198,
        134,
        140,
        32,
        8,
        48,
        5
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "vault"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "userToken",
          "writable": true
        },
        {
          "name": "referralLink"
        },
        {
          "name": "referrerToken",
          "writable": true
        },
        {
          "name": "player"
        },
        {
          "name": "materialMints"
        },
        {
          "name": "vaultGuard",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "placeBuyOrder",
      "discriminator": [
        47,
        253,
        241,
        214,
        167,
        204,
        11,
        39
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "maker",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  117,
                  114,
                  99,
                  101,
                  95,
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": "u8"
        },
        {
          "name": "priceLamportsPerUnit",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "placeSellOrder",
      "discriminator": [
        254,
        177,
        180,
        104,
        171,
        194,
        79,
        86
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "maker",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "makerToken",
          "writable": true
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  117,
                  114,
                  99,
                  101,
                  95,
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "orderVault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": "u8"
        },
        {
          "name": "priceLamportsPerUnit",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "plantSeeds",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u041f\u043e\u0441\u0430\u0434\u043a\u0430 \u0441\u0435\u043c\u044f\u043d \u043d\u0430 \u043f\u043e\u043b\u0435\u0432\u043e\u0439 \u0442\u0430\u0439\u043b"
      ],
      "discriminator": [
        157,
        33,
        113,
        208,
        164,
        49,
        10,
        229
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "energyAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  101,
                  114,
                  103,
                  121,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "farmTile",
          "writable": true
        },
        {
          "name": "seedsMint",
          "writable": true
        },
        {
          "name": "userSeeds",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tileIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "purchaseSeasonPass",
      "discriminator": [
        233,
        149,
        73,
        70,
        108,
        174,
        246,
        71
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "season",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  115,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "season.season_id",
                "account": "Season"
              }
            ]
          }
        },
        {
          "name": "seasonPass",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  115,
                  111,
                  110,
                  95,
                  112,
                  97,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "season.season_id",
                "account": "Season"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "referralBind",
      "discriminator": [
        94,
        97,
        178,
        7,
        104,
        89,
        66,
        85
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "referred",
          "writable": true,
          "signer": true
        },
        {
          "name": "referrer"
        },
        {
          "name": "referrerPlayer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "referrer"
              }
            ]
          }
        },
        {
          "name": "referrerStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  102,
                  101,
                  114,
                  114,
                  101,
                  114,
                  95,
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "referrer"
              }
            ]
          }
        },
        {
          "name": "referralLink",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  102,
                  101,
                  114,
                  114,
                  97,
                  108,
                  95,
                  108,
                  105,
                  110,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "referred"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "referralUpgrade",
      "discriminator": [
        13,
        103,
        189,
        82,
        214,
        68,
        106,
        15
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "referralLink",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  102,
                  101,
                  114,
                  114,
                  97,
                  108,
                  95,
                  108,
                  105,
                  110,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "foodMint",
          "writable": true
        },
        {
          "name": "userFood",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "rentalEnd",
      "discriminator": [
        164,
        124,
        203,
        70,
        52,
        129,
        186,
        66
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tool",
          "writable": true
        },
        {
          "name": "rentalAgreement",
          "writable": true
        },
        {
          "name": "renterRefund",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "rentalList",
      "discriminator": [
        117,
        211,
        91,
        46,
        123,
        180,
        139,
        146
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "rentalListing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  110,
                  116,
                  97,
                  108,
                  95,
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "rentalVault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "ownerSplitBps",
          "type": "u16"
        },
        {
          "name": "minDuration",
          "type": "i64"
        },
        {
          "name": "maxDuration",
          "type": "i64"
        },
        {
          "name": "pricePerHourLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "rentalRevoke",
      "discriminator": [
        102,
        156,
        111,
        193,
        139,
        106,
        44,
        46
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tool",
          "writable": true
        },
        {
          "name": "rentalAgreement",
          "writable": true
        },
        {
          "name": "renterRefund",
          "writable": true
        },
        {
          "name": "rentalListing",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  110,
                  116,
                  97,
                  108,
                  95,
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "rentalStart",
      "discriminator": [
        72,
        125,
        23,
        178,
        217,
        225,
        224,
        37
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "renter",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "rentalListing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  110,
                  116,
                  97,
                  108,
                  95,
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "rentalAgreement",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  110,
                  116,
                  97,
                  108,
                  95,
                  97,
                  103,
                  114,
                  101,
                  101,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "rentalVault"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "durationSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "repair",
      "discriminator": [
        97,
        230,
        48,
        23,
        128,
        133,
        201,
        192
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u8"
        }
      ]
    },
    {
      "name": "reroll",
      "discriminator": [
        19,
        251,
        26,
        108,
        113,
        68,
        194,
        142
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "gastank",
          "writable": true
        },
        {
          "name": "toolA",
          "writable": true
        },
        {
          "name": "mintA",
          "writable": true
        },
        {
          "name": "tokenA",
          "writable": true
        },
        {
          "name": "toolB",
          "writable": true
        },
        {
          "name": "mintB",
          "writable": true
        },
        {
          "name": "tokenB",
          "writable": true
        },
        {
          "name": "newMint",
          "writable": true
        },
        {
          "name": "newToken",
          "writable": true
        },
        {
          "name": "newToolData",
          "writable": true
        },
        {
          "name": "auth"
        },
        {
          "name": "rarityCounter",
          "writable": true
        },
        {
          "name": "craftEconomy"
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "foodMint",
          "writable": true
        },
        {
          "name": "userFood",
          "writable": true
        },
        {
          "name": "seedsMint",
          "writable": true
        },
        {
          "name": "userSeeds",
          "writable": true
        },
        {
          "name": "waterMint",
          "writable": true
        },
        {
          "name": "userWater",
          "writable": true
        },
        {
          "name": "potatoMint",
          "writable": true
        },
        {
          "name": "userPotato",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newType",
          "type": "string"
        }
      ]
    },
    {
      "name": "rerollRandomCommit",
      "discriminator": [
        116,
        32,
        24,
        82,
        9,
        94,
        122,
        236
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "gastank",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  115,
                  116,
                  97,
                  110,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "burnTool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "burn_mint"
              }
            ]
          }
        },
        {
          "name": "burnMint",
          "writable": true
        },
        {
          "name": "burnToken",
          "writable": true
        },
        {
          "name": "newMint"
        },
        {
          "name": "rerollCommit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  114,
                  111,
                  108,
                  108,
                  95,
                  99,
                  111,
                  109,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "new_mint"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "commitHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "rerollRandomReveal",
      "discriminator": [
        123,
        60,
        249,
        147,
        211,
        177,
        53,
        33
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "rerollConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  114,
                  111,
                  108,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "rerollCommit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  114,
                  111,
                  108,
                  108,
                  95,
                  99,
                  111,
                  109,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "new_mint"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "newMint",
          "writable": true
        },
        {
          "name": "newToken",
          "writable": true
        },
        {
          "name": "newToolData",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "new_mint"
              }
            ]
          }
        },
        {
          "name": "auth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "secret",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "setCraftEconomy",
      "discriminator": [
        120,
        212,
        205,
        243,
        202,
        47,
        137,
        226
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "craftEconomy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  97,
                  102,
                  116,
                  95,
                  101,
                  99,
                  111,
                  110,
                  111,
                  109,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "woodBase",
          "type": {
            "array": [
              "u64",
              4
            ]
          }
        },
        {
          "name": "stoneBase",
          "type": {
            "array": [
              "u64",
              4
            ]
          }
        },
        {
          "name": "woodMult",
          "type": {
            "array": [
              "u64",
              4
            ]
          }
        },
        {
          "name": "stoneMult",
          "type": {
            "array": [
              "u64",
              4
            ]
          }
        }
      ]
    },
    {
      "name": "setFees",
      "discriminator": [
        137,
        178,
        49,
        58,
        0,
        245,
        242,
        190
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "craftFee",
          "type": "u64"
        },
        {
          "name": "unstakeFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setPackConfig",
      "discriminator": [
        184,
        55,
        219,
        28,
        73,
        225,
        169,
        241
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "packConfig",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "priceLamports",
          "type": "u64"
        },
        {
          "name": "oddsBps",
          "type": {
            "array": [
              "u16",
              5
            ]
          }
        }
      ]
    },
    {
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setRerollConfig",
      "discriminator": [
        38,
        174,
        229,
        178,
        197,
        217,
        46,
        192
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "rerollConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  114,
                  111,
                  108,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "oddsBps",
          "type": {
            "array": [
              "u16",
              5
            ]
          }
        }
      ]
    },
    {
      "name": "setResourceMints",
      "discriminator": [
        111,
        179,
        202,
        97,
        194,
        50,
        136,
        19
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "foodMint",
          "type": "pubkey"
        },
        {
          "name": "woodMint",
          "type": "pubkey"
        },
        {
          "name": "stoneMint",
          "type": "pubkey"
        },
        {
          "name": "seedsMint",
          "type": "pubkey"
        },
        {
          "name": "waterMint",
          "type": "pubkey"
        },
        {
          "name": "potatoMint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "stake",
      "discriminator": [
        206,
        176,
        202,
        18,
        200,
        209,
        179,
        108
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "userToken",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "lockSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "startBaking",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u0417\u0430\u043f\u0443\u0441\u043a \u043f\u0430\u0440\u0442\u0438\u0438 \u0432\u044b\u043f\u0435\u0447\u043a\u0438 \u0432 \u043f\u0435\u0447\u0438 (0=\u0434\u0440\u043e\u0432\u0430, 1=\u0443\u0433\u043e\u043b\u044c)"
      ],
      "discriminator": [
        97,
        179,
        181,
        240,
        28,
        104,
        190,
        205
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "energyAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  101,
                  114,
                  103,
                  121,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "ovenState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  118,
                  101,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "flourMint",
          "writable": true
        },
        {
          "name": "waterMint",
          "writable": true
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "coalMint",
          "writable": true
        },
        {
          "name": "userFlour",
          "writable": true
        },
        {
          "name": "userWater",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "userCoal",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "batchSize",
          "type": "u8"
        },
        {
          "name": "fuelKind",
          "type": "u8"
        }
      ]
    },
    {
      "name": "startExplorationCommit",
      "discriminator": [
        58,
        145,
        149,
        221,
        209,
        9,
        12,
        173
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "explorationState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  112,
                  108,
                  111,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "toolMint"
        },
        {
          "name": "tool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "toolMint"
              }
            ]
          }
        },
        {
          "name": "explorationCommit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  112,
                  108,
                  111,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  99,
                  111,
                  109,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tool_mint"
              }
            ]
          }
        },
        {
          "name": "foodMint",
          "writable": true
        },
        {
          "name": "userFood",
          "writable": true
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "meatMint",
          "writable": true
        },
        {
          "name": "userMeat",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "commitHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "startMilling",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u0417\u0430\u043f\u0443\u0441\u043a \u043f\u0430\u0440\u0442\u0438\u0438 \u043f\u043e\u043c\u043e\u043b\u0430 \u043d\u0430 \u043c\u0435\u043b\u044c\u043d\u0438\u0446\u0435"
      ],
      "discriminator": [
        12,
        183,
        141,
        54,
        123,
        57,
        105,
        5
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "materialMints",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  101,
                  114,
                  105,
                  97,
                  108,
                  95,
                  109,
                  105,
                  110,
                  116,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "energyAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  101,
                  114,
                  103,
                  121,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "millState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  108,
                  108,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "wheatMint",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userWheat",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "batchSize",
          "type": "u8"
        }
      ]
    },
    {
      "name": "startMining",
      "discriminator": [
        108,
        28,
        69,
        67,
        54,
        120,
        245,
        196
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "hours",
          "type": "u8"
        }
      ]
    },
    {
      "name": "sweepGasFees",
      "discriminator": [
        114,
        3,
        27,
        208,
        121,
        220,
        139,
        7
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "gastank",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  115,
                  116,
                  97,
                  110,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "gastank.owner",
                "account": "GasTank"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "unstake",
      "discriminator": [
        90,
        95,
        107,
        42,
        205,
        124,
        50,
        225
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "userToken",
          "writable": true
        },
        {
          "name": "gastank",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  115,
                  116,
                  97,
                  110,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "upgradeExplorationTier",
      "discriminator": [
        36,
        77,
        217,
        211,
        252,
        176,
        30,
        108
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "explorationState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  112,
                  108,
                  111,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "woodMint",
          "writable": true
        },
        {
          "name": "userWood",
          "writable": true
        },
        {
          "name": "stoneMint",
          "writable": true
        },
        {
          "name": "userStone",
          "writable": true
        },
        {
          "name": "foodMint",
          "writable": true
        },
        {
          "name": "userFood",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "weatherCrank",
      "docs": [
        "[\u0411\u041b\u041e\u041a L] \u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u043f\u043e\u0433\u043e\u0434\u044b (permissionless, \u0440\u0430\u0437 \u0432 \u0441\u0443\u0442\u043a\u0438)"
      ],
      "discriminator": [
        116,
        31,
        101,
        128,
        172,
        213,
        119,
        144
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "cranker",
          "writable": true,
          "signer": true
        },
        {
          "name": "weatherState",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawGas",
      "discriminator": [
        35,
        60,
        150,
        196,
        226,
        110,
        54,
        45
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "gastank",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  115,
                  116,
                  97,
                  110,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mintResourceOnce",
      "discriminator": [
        112,
        16,
        85,
        114,
        236,
        4,
        67,
        139
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "materialMints"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "auth"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "treasuryToken",
          "writable": true
        },
        {
          "name": "player",
          "writable": true
        },
        {
          "name": "issuanceCap",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rewardReceipt",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "resourceKind"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "rewardId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "marketplaceBuyBounded",
      "discriminator": [
        219,
        1,
        7,
        251,
        90,
        189,
        167,
        48
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "seller",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "tool",
          "writable": true
        },
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "listingVault",
          "writable": true
        },
        {
          "name": "buyerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "maxPriceLamports",
          "type": "u64"
        },
        {
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "initIssuanceCap",
      "discriminator": [
        7,
        110,
        74,
        57,
        227,
        136,
        110,
        214
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "issuanceCap",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  97,
                  112
                ]
              },
              {
                "kind": "arg",
                "path": "kind"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "resourceKind"
            }
          }
        },
        {
          "name": "epochSlots",
          "type": "u64"
        },
        {
          "name": "capPerEpoch",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setIssuanceCap",
      "discriminator": [
        227,
        134,
        78,
        85,
        122,
        198,
        113,
        59
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "issuanceCap",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  97,
                  110,
                  99,
                  101,
                  95,
                  99,
                  97,
                  112
                ]
              },
              {
                "kind": "arg",
                "path": "kind"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "resourceKind"
            }
          }
        },
        {
          "name": "epochSlots",
          "type": "u64"
        },
        {
          "name": "capPerEpoch",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setPendingAuthority",
      "discriminator": [
        175,
        71,
        167,
        223,
        49,
        144,
        102,
        193
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "acceptAuthority",
      "discriminator": [
        107,
        86,
        198,
        91,
        33,
        12,
        107,
        160
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "newAuthority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "cancelPendingAuthority",
      "discriminator": [
        155,
        52,
        245,
        225,
        85,
        73,
        58,
        238
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "setMiningEnabled",
      "discriminator": [
        240,
        237,
        205,
        117,
        79,
        7,
        125,
        116
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "enabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initVaultGuard",
      "discriminator": [
        20,
        12,
        78,
        107,
        5,
        169,
        61,
        101
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "vaultGuard",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "epochSlots",
          "type": "u64"
        },
        {
          "name": "capPerEpoch",
          "type": "u64"
        },
        {
          "name": "maxPerTx",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setVaultGuard",
      "discriminator": [
        188,
        146,
        45,
        181,
        231,
        183,
        48,
        53
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "vaultGuard",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "epochSlots",
          "type": "u64"
        },
        {
          "name": "capPerEpoch",
          "type": "u64"
        },
        {
          "name": "maxPerTx",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setSupplyCap",
      "discriminator": [
        26,
        229,
        174,
        213,
        12,
        59,
        220,
        71
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "materialMints",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "resourceKind"
            }
          }
        },
        {
          "name": "maxSupply",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerCollectorMint",
      "discriminator": [
        230,
        133,
        88,
        35,
        115,
        148,
        172,
        128
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "entry",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "collectorKind"
            }
          }
        }
      ]
    },
    {
      "name": "revokeCollectorMint",
      "discriminator": [
        45,
        151,
        59,
        119,
        159,
        240,
        101,
        86
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "entry",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "refundLotteryRound",
      "discriminator": [
        134,
        87,
        211,
        115,
        122,
        237,
        217,
        204
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "round",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "migrateConfigV2",
      "discriminator": [
        21,
        39,
        88,
        172,
        254,
        205,
        30,
        141
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "setRoles",
      "discriminator": [
        119,
        86,
        129,
        161,
        55,
        23,
        250,
        12
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "operator",
          "type": "pubkey"
        },
        {
          "name": "guardian",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "emergencyStop",
      "discriminator": [
        179,
        143,
        200,
        137,
        108,
        245,
        248,
        35
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "caller",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "pauseGame",
          "type": "bool"
        },
        {
          "name": "freezeCashout",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setCashoutFrozen",
      "discriminator": [
        188,
        201,
        38,
        248,
        184,
        63,
        152,
        137
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "frozen",
          "type": "bool"
        }
      ]
    },
    {
      "name": "rentalStartBounded",
      "discriminator": [
        254,
        53,
        210,
        91,
        122,
        245,
        9,
        4
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "renter",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "rentalListing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  110,
                  116,
                  97,
                  108,
                  95,
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "rentalAgreement",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  110,
                  116,
                  97,
                  108,
                  95,
                  97,
                  103,
                  114,
                  101,
                  101,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "rentalVault"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "durationSeconds",
          "type": "i64"
        },
        {
          "name": "maxTotalFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "rentalDelist",
      "discriminator": [
        179,
        203,
        85,
        127,
        147,
        27,
        104,
        72
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "rentalListing",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  110,
                  116,
                  97,
                  108,
                  95,
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          },
          "writable": true
        },
        {
          "name": "lister",
          "writable": true
        },
        {
          "name": "rentalVault",
          "writable": true
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "auctionCancel",
      "discriminator": [
        252,
        86,
        251,
        18,
        251,
        20,
        71,
        115
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "auctionVault",
          "writable": true
        },
        {
          "name": "sellerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "auction",
      "discriminator": [
        218,
        94,
        247,
        242,
        126,
        233,
        131,
        81
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "craftEconomy",
      "discriminator": [
        98,
        22,
        174,
        143,
        145,
        13,
        167,
        189
      ]
    },
    {
      "name": "craftOrder",
      "discriminator": [
        13,
        150,
        31,
        102,
        17,
        75,
        116,
        94
      ]
    },
    {
      "name": "enchantSlot",
      "discriminator": [
        66,
        202,
        44,
        67,
        3,
        156,
        28,
        157
      ]
    },
    {
      "name": "energyAccount",
      "discriminator": [
        233,
        243,
        80,
        122,
        77,
        89,
        242,
        155
      ]
    },
    {
      "name": "explorationCommit",
      "discriminator": [
        172,
        26,
        178,
        220,
        13,
        242,
        9,
        159
      ]
    },
    {
      "name": "explorationState",
      "discriminator": [
        13,
        185,
        243,
        5,
        133,
        18,
        158,
        16
      ]
    },
    {
      "name": "farmTile",
      "discriminator": [
        214,
        122,
        58,
        96,
        247,
        48,
        172,
        29
      ]
    },
    {
      "name": "forgeCommit",
      "discriminator": [
        38,
        243,
        82,
        47,
        112,
        210,
        133,
        53
      ]
    },
    {
      "name": "gasTank",
      "discriminator": [
        130,
        160,
        112,
        156,
        37,
        128,
        62,
        80
      ]
    },
    {
      "name": "listing",
      "discriminator": [
        218,
        32,
        50,
        73,
        43,
        134,
        26,
        58
      ]
    },
    {
      "name": "lotteryRound",
      "discriminator": [
        35,
        19,
        255,
        226,
        193,
        47,
        229,
        149
      ]
    },
    {
      "name": "lotteryTicket",
      "discriminator": [
        228,
        213,
        125,
        39,
        104,
        149,
        18,
        39
      ]
    },
    {
      "name": "materialMints",
      "discriminator": [
        69,
        169,
        50,
        69,
        228,
        168,
        44,
        170
      ]
    },
    {
      "name": "millState",
      "discriminator": [
        22,
        37,
        239,
        176,
        53,
        147,
        157,
        215
      ]
    },
    {
      "name": "offer",
      "discriminator": [
        215,
        88,
        60,
        71,
        170,
        162,
        73,
        229
      ]
    },
    {
      "name": "ovenState",
      "discriminator": [
        204,
        31,
        229,
        84,
        230,
        157,
        205,
        139
      ]
    },
    {
      "name": "packCommit",
      "discriminator": [
        198,
        228,
        230,
        161,
        47,
        2,
        157,
        123
      ]
    },
    {
      "name": "packConfig",
      "discriminator": [
        124,
        1,
        129,
        61,
        25,
        216,
        84,
        173
      ]
    },
    {
      "name": "player",
      "discriminator": [
        205,
        222,
        112,
        7,
        165,
        155,
        206,
        218
      ]
    },
    {
      "name": "rarityCounter",
      "discriminator": [
        45,
        47,
        244,
        219,
        130,
        91,
        42,
        250
      ]
    },
    {
      "name": "referralLink",
      "discriminator": [
        30,
        231,
        159,
        98,
        189,
        47,
        48,
        5
      ]
    },
    {
      "name": "referrerStats",
      "discriminator": [
        181,
        235,
        242,
        229,
        103,
        242,
        144,
        118
      ]
    },
    {
      "name": "rentalAgreement",
      "discriminator": [
        84,
        206,
        204,
        146,
        240,
        218,
        19,
        14
      ]
    },
    {
      "name": "rentalListing",
      "discriminator": [
        76,
        239,
        227,
        36,
        98,
        137,
        187,
        158
      ]
    },
    {
      "name": "rerollCommit",
      "discriminator": [
        88,
        236,
        251,
        159,
        122,
        239,
        216,
        229
      ]
    },
    {
      "name": "rerollConfig",
      "discriminator": [
        115,
        207,
        104,
        7,
        163,
        36,
        188,
        3
      ]
    },
    {
      "name": "resourceOrder",
      "discriminator": [
        220,
        6,
        17,
        203,
        159,
        141,
        73,
        153
      ]
    },
    {
      "name": "season",
      "discriminator": [
        76,
        67,
        93,
        156,
        180,
        157,
        248,
        47
      ]
    },
    {
      "name": "seasonPass",
      "discriminator": [
        133,
        43,
        114,
        226,
        2,
        237,
        43,
        215
      ]
    },
    {
      "name": "stakedCollector",
      "discriminator": [
        56,
        7,
        181,
        177,
        142,
        38,
        73,
        42
      ]
    },
    {
      "name": "toolData",
      "discriminator": [
        81,
        51,
        197,
        184,
        107,
        102,
        26,
        71
      ]
    },
    {
      "name": "weatherState",
      "discriminator": [
        220,
        116,
        222,
        54,
        27,
        194,
        33,
        81
      ]
    },
    {
      "name": "wellState",
      "discriminator": [
        208,
        65,
        62,
        72,
        25,
        152,
        41,
        71
      ]
    },
    {
      "name": "rewardReceipt",
      "discriminator": [
        116,
        154,
        221,
        22,
        195,
        73,
        132,
        89
      ]
    },
    {
      "name": "issuanceCap",
      "discriminator": [
        112,
        197,
        118,
        158,
        65,
        80,
        180,
        96
      ]
    },
    {
      "name": "vaultGuard",
      "discriminator": [
        220,
        164,
        5,
        99,
        166,
        92,
        59,
        223
      ]
    },
    {
      "name": "collectorAllowEntry",
      "discriminator": [
        9,
        80,
        117,
        174,
        23,
        102,
        54,
        192
      ]
    },
    {
      "name": "lotteryTicketCounter",
      "discriminator": [
        126,
        104,
        207,
        207,
        130,
        79,
        224,
        114
      ]
    }
  ],
  "events": [
    {
      "name": "auctionBid",
      "discriminator": [
        113,
        186,
        124,
        132,
        210,
        152,
        98,
        191
      ]
    },
    {
      "name": "auctionCreated",
      "discriminator": [
        133,
        190,
        194,
        65,
        172,
        0,
        70,
        178
      ]
    },
    {
      "name": "auctionSettled",
      "discriminator": [
        61,
        151,
        131,
        170,
        95,
        203,
        219,
        147
      ]
    },
    {
      "name": "collectorStaked",
      "discriminator": [
        119,
        109,
        3,
        15,
        186,
        127,
        185,
        15
      ]
    },
    {
      "name": "collectorUnstaked",
      "discriminator": [
        110,
        6,
        128,
        255,
        116,
        95,
        103,
        167
      ]
    },
    {
      "name": "craftEvent",
      "discriminator": [
        157,
        113,
        231,
        112,
        84,
        151,
        190,
        130
      ]
    },
    {
      "name": "craftOrderFulfilled",
      "discriminator": [
        150,
        221,
        178,
        144,
        73,
        115,
        46,
        29
      ]
    },
    {
      "name": "explorationCompleted",
      "discriminator": [
        33,
        185,
        143,
        12,
        76,
        137,
        142,
        255
      ]
    },
    {
      "name": "forgeAttempted",
      "discriminator": [
        121,
        198,
        10,
        106,
        224,
        195,
        235,
        72
      ]
    },
    {
      "name": "gasFeesSwept",
      "discriminator": [
        29,
        224,
        233,
        42,
        150,
        4,
        124,
        136
      ]
    },
    {
      "name": "listingCreated",
      "discriminator": [
        94,
        164,
        167,
        255,
        246,
        186,
        12,
        96
      ]
    },
    {
      "name": "listingSold",
      "discriminator": [
        199,
        212,
        98,
        147,
        91,
        49,
        85,
        138
      ]
    },
    {
      "name": "lotteryClaimed",
      "discriminator": [
        4,
        123,
        87,
        190,
        39,
        9,
        228,
        222
      ]
    },
    {
      "name": "lotteryDrawn",
      "discriminator": [
        38,
        250,
        156,
        196,
        171,
        79,
        154,
        208
      ]
    },
    {
      "name": "lotteryTicketBought",
      "discriminator": [
        14,
        53,
        100,
        96,
        154,
        172,
        216,
        160
      ]
    },
    {
      "name": "miningCollected",
      "discriminator": [
        58,
        22,
        29,
        78,
        81,
        75,
        107,
        236
      ]
    },
    {
      "name": "offerAccepted",
      "discriminator": [
        81,
        238,
        238,
        115,
        140,
        18,
        8,
        20
      ]
    },
    {
      "name": "offerCreated",
      "discriminator": [
        31,
        236,
        215,
        144,
        75,
        45,
        157,
        87
      ]
    },
    {
      "name": "orderMatched",
      "discriminator": [
        211,
        0,
        178,
        174,
        61,
        245,
        45,
        250
      ]
    },
    {
      "name": "orderPlaced",
      "discriminator": [
        96,
        130,
        204,
        234,
        169,
        219,
        216,
        227
      ]
    },
    {
      "name": "packOpened",
      "discriminator": [
        107,
        111,
        64,
        235,
        140,
        166,
        46,
        201
      ]
    },
    {
      "name": "paidOut",
      "discriminator": [
        6,
        137,
        209,
        225,
        252,
        53,
        249,
        252
      ]
    },
    {
      "name": "referralBound",
      "discriminator": [
        12,
        28,
        152,
        148,
        55,
        210,
        102,
        190
      ]
    },
    {
      "name": "referralPayout",
      "discriminator": [
        29,
        218,
        27,
        119,
        39,
        243,
        67,
        246
      ]
    },
    {
      "name": "rentalEnded",
      "discriminator": [
        62,
        183,
        173,
        237,
        227,
        140,
        155,
        79
      ]
    },
    {
      "name": "rentalStarted",
      "discriminator": [
        61,
        99,
        20,
        232,
        73,
        33,
        40,
        252
      ]
    },
    {
      "name": "rerollResult",
      "discriminator": [
        37,
        127,
        71,
        182,
        110,
        95,
        44,
        91
      ]
    },
    {
      "name": "seasonPassPurchased",
      "discriminator": [
        206,
        98,
        238,
        42,
        1,
        49,
        235,
        26
      ]
    },
    {
      "name": "seasonRewardClaimed",
      "discriminator": [
        77,
        35,
        8,
        228,
        34,
        133,
        230,
        234
      ]
    },
    {
      "name": "staked",
      "discriminator": [
        11,
        146,
        45,
        205,
        230,
        58,
        213,
        240
      ]
    },
    {
      "name": "toolBurned",
      "discriminator": [
        194,
        234,
        2,
        127,
        177,
        196,
        175,
        184
      ]
    },
    {
      "name": "toolCrafted",
      "discriminator": [
        41,
        221,
        49,
        20,
        2,
        229,
        51,
        38
      ]
    },
    {
      "name": "toolMinted",
      "discriminator": [
        175,
        54,
        79,
        18,
        241,
        180,
        160,
        23
      ]
    },
    {
      "name": "toolRepaired",
      "discriminator": [
        243,
        97,
        245,
        252,
        35,
        198,
        109,
        222
      ]
    },
    {
      "name": "unstaked",
      "discriminator": [
        27,
        179,
        156,
        215,
        47,
        71,
        195,
        7
      ]
    },
    {
      "name": "packCommitExpired",
      "discriminator": [
        10,
        107,
        17,
        86,
        143,
        248,
        135,
        69
      ]
    },
    {
      "name": "forgeCommitExpired",
      "discriminator": [
        24,
        244,
        189,
        74,
        234,
        139,
        170,
        174
      ]
    },
    {
      "name": "resourceIssued",
      "discriminator": [
        8,
        244,
        117,
        191,
        235,
        4,
        216,
        184
      ]
    },
    {
      "name": "issuanceCapChanged",
      "discriminator": [
        120,
        48,
        51,
        149,
        131,
        28,
        145,
        152
      ]
    },
    {
      "name": "pausedToggled",
      "discriminator": [
        77,
        42,
        45,
        184,
        47,
        55,
        187,
        17
      ]
    },
    {
      "name": "feesUpdated",
      "discriminator": [
        65,
        34,
        234,
        59,
        248,
        242,
        101,
        118
      ]
    },
    {
      "name": "resourceMintsUpdated",
      "discriminator": [
        68,
        174,
        251,
        121,
        44,
        8,
        10,
        120
      ]
    },
    {
      "name": "craftEconomyUpdated",
      "discriminator": [
        143,
        160,
        24,
        236,
        225,
        207,
        14,
        80
      ]
    },
    {
      "name": "vaultWithdrawal",
      "discriminator": [
        168,
        109,
        95,
        252,
        76,
        240,
        237,
        56
      ]
    },
    {
      "name": "vaultGuardChanged",
      "discriminator": [
        148,
        53,
        106,
        37,
        249,
        53,
        129,
        8
      ]
    },
    {
      "name": "authorityRotationProposed",
      "discriminator": [
        76,
        59,
        57,
        23,
        22,
        166,
        253,
        33
      ]
    },
    {
      "name": "authorityChanged",
      "discriminator": [
        31,
        19,
        174,
        152,
        4,
        82,
        215,
        226
      ]
    },
    {
      "name": "miningToggled",
      "discriminator": [
        204,
        172,
        223,
        195,
        227,
        64,
        84,
        70
      ]
    },
    {
      "name": "supplyCapChanged",
      "discriminator": [
        21,
        238,
        14,
        188,
        169,
        140,
        177,
        255
      ]
    },
    {
      "name": "collectorMintRegistered",
      "discriminator": [
        239,
        48,
        54,
        51,
        192,
        8,
        98,
        193
      ]
    },
    {
      "name": "playerCapacityChanged",
      "discriminator": [
        75,
        199,
        132,
        60,
        25,
        243,
        242,
        249
      ]
    },
    {
      "name": "lotteryRoundRefunded",
      "discriminator": [
        102,
        158,
        253,
        89,
        139,
        160,
        166,
        61
      ]
    },
    {
      "name": "authorityRotationCancelled",
      "discriminator": [
        130,
        2,
        252,
        115,
        135,
        42,
        1,
        109
      ]
    },
    {
      "name": "packConfigChanged",
      "discriminator": [
        194,
        194,
        98,
        16,
        219,
        238,
        75,
        79
      ]
    },
    {
      "name": "rerollConfigChanged",
      "discriminator": [
        175,
        101,
        186,
        190,
        168,
        190,
        111,
        34
      ]
    },
    {
      "name": "seasonInitialized",
      "discriminator": [
        192,
        104,
        122,
        236,
        147,
        151,
        4,
        93
      ]
    },
    {
      "name": "seasonXpGranted",
      "discriminator": [
        9,
        27,
        4,
        8,
        191,
        108,
        233,
        73
      ]
    },
    {
      "name": "materialMintsInitialized",
      "discriminator": [
        220,
        142,
        120,
        50,
        96,
        184,
        47,
        187
      ]
    },
    {
      "name": "configMigrated",
      "discriminator": [
        115,
        69,
        99,
        100,
        192,
        77,
        40,
        50
      ]
    },
    {
      "name": "rolesChanged",
      "discriminator": [
        214,
        27,
        145,
        82,
        146,
        4,
        15,
        93
      ]
    },
    {
      "name": "emergencyStopActivated",
      "discriminator": [
        231,
        193,
        97,
        191,
        6,
        8,
        142,
        163
      ]
    },
    {
      "name": "cashoutFreezeChanged",
      "discriminator": [
        131,
        156,
        117,
        196,
        109,
        171,
        18,
        86
      ]
    },
    {
      "name": "auctionCancelled",
      "discriminator": [
        22,
        32,
        51,
        83,
        215,
        194,
        171,
        209
      ]
    },
    {
      "name": "rentalListed",
      "discriminator": [
        97,
        210,
        170,
        203,
        199,
        117,
        68,
        74
      ]
    },
    {
      "name": "rentalDelisted",
      "discriminator": [
        64,
        170,
        128,
        71,
        152,
        99,
        31,
        225
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized: signer does not match required authority"
    },
    {
      "code": 6001,
      "name": "mathOverflow",
      "msg": "Math overflow or underflow detected"
    },
    {
      "code": 6002,
      "name": "insufficientBalance",
      "msg": "Insufficient balance for operation"
    },
    {
      "code": 6003,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6004,
      "name": "paused",
      "msg": "Program is paused"
    },
    {
      "code": 6005,
      "name": "invalidResourceKind",
      "msg": "Invalid resource kind for mint"
    },
    {
      "code": 6006,
      "name": "invalidRarityForCraft",
      "msg": "Tool rarity must be above Common for craft"
    },
    {
      "code": 6007,
      "name": "notToolOwner",
      "msg": "Tool is not owned by user"
    },
    {
      "code": 6008,
      "name": "insufficientDurability",
      "msg": "Tool durability insufficient"
    },
    {
      "code": 6009,
      "name": "toolIsMining",
      "msg": "Tool is currently mining"
    },
    {
      "code": 6010,
      "name": "miningNotComplete",
      "msg": "Mining not yet complete"
    },
    {
      "code": 6011,
      "name": "invalidMiningHours",
      "msg": "Invalid mining hours for tool rarity"
    },
    {
      "code": 6012,
      "name": "durabilityExceedsMax",
      "msg": "Durability would exceed maximum"
    },
    {
      "code": 6013,
      "name": "invalidStakeState",
      "msg": "Tool is already staked or not staked"
    },
    {
      "code": 6014,
      "name": "notStaked",
      "msg": "Tool is not staked"
    },
    {
      "code": 6015,
      "name": "alreadyStaked",
      "msg": "Tool is already staked"
    },
    {
      "code": 6016,
      "name": "alreadyMining",
      "msg": "Tool is already mining"
    },
    {
      "code": 6017,
      "name": "notMining",
      "msg": "Tool is not mining"
    },
    {
      "code": 6018,
      "name": "lockNotExpired",
      "msg": "Lock period not yet expired"
    },
    {
      "code": 6019,
      "name": "cooldownNotExpired",
      "msg": "Cooldown period not yet expired"
    },
    {
      "code": 6020,
      "name": "cannotRerollLegendary",
      "msg": "Legendary tools cannot be rerolled"
    },
    {
      "code": 6021,
      "name": "rerollMismatchedRarity",
      "msg": "Reroll requires two tools of same rarity"
    },
    {
      "code": 6022,
      "name": "alreadyInitialized",
      "msg": "Program already initialized"
    },
    {
      "code": 6023,
      "name": "invalidMigrationAuthority",
      "msg": "Invalid migration authority"
    },
    {
      "code": 6024,
      "name": "vaultInsufficient",
      "msg": "Vault balance insufficient for payout"
    },
    {
      "code": 6025,
      "name": "invalidLockSeconds",
      "msg": "Invalid lock seconds for stake"
    },
    {
      "code": 6026,
      "name": "toolTypeTooLong",
      "msg": "Tool type string too long"
    },
    {
      "code": 6027,
      "name": "rentExemptionFailed",
      "msg": "Rent exemption check failed"
    },
    {
      "code": 6028,
      "name": "rarityCounterMismatch",
      "msg": "Rarity counter account does not match the tool's target rarity"
    },
    {
      "code": 6029,
      "name": "noExcessToSweep",
      "msg": "No excess lamports available to sweep from gas tank"
    },
    {
      "code": 6030,
      "name": "invalidMint",
      "msg": "Invalid mint address"
    },
    {
      "code": 6031,
      "name": "noIdleVillagers",
      "msg": "No idle villagers available for mining"
    },
    {
      "code": 6032,
      "name": "hoursExceedRarityCap",
      "msg": "Requested mining hours exceed max hours for this tool rarity"
    },
    {
      "code": 6033,
      "name": "notCollectorOwner",
      "msg": "Signer does not own this staked collector"
    },
    {
      "code": 6034,
      "name": "collectorNotConfigured",
      "msg": "Collector mint registry is not configured"
    },
    {
      "code": 6035,
      "name": "commitMismatch",
      "msg": "Commit hash does not match revealed secret"
    },
    {
      "code": 6036,
      "name": "commitExpired",
      "msg": "Commit has expired (SlotHashes window passed) \u2014 abort and refund"
    },
    {
      "code": 6037,
      "name": "invalidOddsWeights",
      "msg": "Odds weights must sum to 10000 basis points"
    },
    {
      "code": 6038,
      "name": "explorationCooldown",
      "msg": "Exploration cooldown has not expired"
    },
    {
      "code": 6039,
      "name": "explorationDailyLimitReached",
      "msg": "Daily exploration trip limit reached"
    },
    {
      "code": 6040,
      "name": "explorationMaxTier",
      "msg": "Exploration tier is already at maximum"
    },
    {
      "code": 6041,
      "name": "referralAlreadyBound",
      "msg": "Referral link already exists for this user"
    },
    {
      "code": 6042,
      "name": "referralCapReached",
      "msg": "Referrer has reached their active referral cap"
    },
    {
      "code": 6043,
      "name": "invalidReferral",
      "msg": "A wallet cannot refer itself"
    },
    {
      "code": 6044,
      "name": "referralMaxTier",
      "msg": "Referral tier is already at maximum"
    },
    {
      "code": 6045,
      "name": "enchantMaxLevel",
      "msg": "Enchant slot is already at maximum level"
    },
    {
      "code": 6046,
      "name": "auctionEnded",
      "msg": "Auction has already ended"
    },
    {
      "code": 6047,
      "name": "auctionNotEnded",
      "msg": "Auction has not ended yet"
    },
    {
      "code": 6048,
      "name": "bidTooLow",
      "msg": "Bid must exceed current highest bid"
    },
    {
      "code": 6049,
      "name": "notActive",
      "msg": "Listing/Offer/Auction is not active"
    },
    {
      "code": 6050,
      "name": "invalidRentalDuration",
      "msg": "Rental period out of allowed range"
    },
    {
      "code": 6051,
      "name": "rentalGraceNotExpired",
      "msg": "Rental is still active \u2014 cannot revoke without grace period"
    },
    {
      "code": 6052,
      "name": "notToolOperator",
      "msg": "Signer is not the current operator of this tool"
    },
    {
      "code": 6053,
      "name": "ordersDoNotCross",
      "msg": "Order kinds/side do not cross (price/side mismatch)"
    },
    {
      "code": 6054,
      "name": "orderExhausted",
      "msg": "Order has no remaining amount"
    },
    {
      "code": 6055,
      "name": "lotteryRoundClosed",
      "msg": "Lottery round is already drawn or closed"
    },
    {
      "code": 6056,
      "name": "lotteryNotDrawn",
      "msg": "Lottery round is not drawn yet"
    },
    {
      "code": 6057,
      "name": "notWinningTicket",
      "msg": "Not the winning ticket for this round"
    },
    {
      "code": 6058,
      "name": "lotteryDailyLimitReached",
      "msg": "Daily lottery ticket limit reached"
    },
    {
      "code": 6059,
      "name": "seasonRewardAlreadyClaimed",
      "msg": "Season reward level already claimed"
    },
    {
      "code": 6060,
      "name": "seasonPremiumRequired",
      "msg": "Season reward requires premium pass"
    },
    {
      "code": 6061,
      "name": "seasonInsufficientXp",
      "msg": "Not enough XP for this season level"
    },
    {
      "code": 6062,
      "name": "seasonEnded",
      "msg": "Season has ended"
    },
    {
      "code": 6063,
      "name": "lotteryDrawNotCommitted",
      "msg": "Lottery draw has not been committed yet"
    },
    {
      "code": 6064,
      "name": "lotteryDrawAlreadyCommitted",
      "msg": "Lottery draw is already committed"
    },
    {
      "code": 6065,
      "name": "invalidHash",
      "msg": "Revealed secret does not match committed hash"
    },
    {
      "code": 6066,
      "name": "energyDepleted",
      "msg": "Energy account depleted"
    },
    {
      "code": 6067,
      "name": "insufficientEnergy",
      "msg": "Energy cost exceeds available balance"
    },
    {
      "code": 6068,
      "name": "farmTileBusy",
      "msg": "Farm tile is busy (growing)"
    },
    {
      "code": 6069,
      "name": "farmTileNotReady",
      "msg": "Farm tile is not ready for harvest"
    },
    {
      "code": 6070,
      "name": "farmTileEmpty",
      "msg": "Farm tile is empty (nothing planted)"
    },
    {
      "code": 6071,
      "name": "toolBusy",
      "msg": "Tool is busy (mining), cannot harvest"
    },
    {
      "code": 6072,
      "name": "millInProgress",
      "msg": "Mill has active batch in progress"
    },
    {
      "code": 6073,
      "name": "millNotReady",
      "msg": "Mill batch is not ready yet"
    },
    {
      "code": 6074,
      "name": "ovenInProgress",
      "msg": "Oven has active batch in progress"
    },
    {
      "code": 6075,
      "name": "ovenNotReady",
      "msg": "Oven batch is not ready yet"
    },
    {
      "code": 6076,
      "name": "invalidBatchSize",
      "msg": "Invalid batch size (must be 1, 2, or 3)"
    },
    {
      "code": 6077,
      "name": "invalidFuelKind",
      "msg": "Invalid fuel kind (must be 0=wood or 1=coal)"
    },
    {
      "code": 6078,
      "name": "materialNotRegistered",
      "msg": "Material mint is not registered in MaterialMints PDA"
    },
    {
      "code": 6079,
      "name": "weatherAlreadyUpdated",
      "msg": "Weather state already updated for this day"
    },
    {
      "code": 6080,
      "name": "wellEmpty",
      "msg": "Well has no water to collect"
    },
    {
      "code": 6081,
      "name": "recipeNotFound",
      "msg": "Recipe not found in RecipeConfig"
    },
    {
      "code": 6082,
      "name": "fortuneBoostExpired",
      "msg": "Fortune boost has expired"
    },
    {
      "code": 6083,
      "name": "fortuneBoostAlreadyActive",
      "msg": "Fortune boost is already active"
    },
    {
      "code": 6084,
      "name": "loveHeartNotTransferable",
      "msg": "Love heart is not transferable"
    },
    {
      "code": 6085,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6086,
      "name": "durabilityOverflow",
      "msg": "Durability overflow"
    },
    {
      "code": 6087,
      "name": "invalidWeatherSeed",
      "msg": "Invalid weather seed (must be derived from slot hash)"
    },
    {
      "code": 6088,
      "name": "invalidReveal",
      "msg": "Invalid reveal: hash mismatch"
    },
    {
      "code": 6089,
      "name": "alreadyRevealed",
      "msg": "Commit already revealed"
    },
    {
      "code": 6090,
      "name": "invalidFlaskType",
      "msg": "Invalid flask type"
    },
    {
      "code": 6091,
      "name": "energyCapExceeded",
      "msg": "Energy cap exceeded"
    },
    {
      "code": 6092,
      "name": "invalidToolType",
      "msg": "Tool type is not valid for this instruction"
    },
    {
      "code": 6093,
      "name": "invalidProgramData",
      "msg": "Program data does not contain a valid upgrade authority"
    },
    {
      "code": 6094,
      "name": "featureDisabled",
      "msg": "Feature is disabled until its on-chain economic and recovery path is complete"
    },
    {
      "code": 6095,
      "name": "commitNotExpired",
      "msg": "Commit is still inside its reveal window; it cannot be expired yet"
    },
    {
      "code": 6096,
      "name": "priceLimitExceeded",
      "msg": "Listing price exceeds the signed maximum"
    },
    {
      "code": 6097,
      "name": "quoteExpired",
      "msg": "Quote expired or its lifetime exceeds 300 seconds"
    },
    {
      "code": 6098,
      "name": "issuanceCapNotConfigured",
      "msg": "Issuance cap for this resource is not configured"
    },
    {
      "code": 6099,
      "name": "issuanceCapExceeded",
      "msg": "Issuance cap for this resource exceeded in the current epoch"
    },
    {
      "code": 6100,
      "name": "invalidIssuanceCapParams",
      "msg": "Issuance cap parameters out of bounds"
    },
    {
      "code": 6101,
      "name": "supplyCapExceeded",
      "msg": "Global supply cap for this resource would be exceeded"
    },
    {
      "code": 6102,
      "name": "vaultGuardNotConfigured",
      "msg": "Vault withdrawal guard for this mint is not configured"
    },
    {
      "code": 6103,
      "name": "vaultGuardLimitExceeded",
      "msg": "Vault withdrawal exceeds the per-transaction or per-epoch limit"
    },
    {
      "code": 6104,
      "name": "notAResourceMint",
      "msg": "Mint is not a configured resource mint; pay_out cannot move it"
    },
    {
      "code": 6105,
      "name": "invalidVaultGuardParams",
      "msg": "Vault withdrawal guard parameters out of bounds"
    },
    {
      "code": 6106,
      "name": "noPendingAuthority",
      "msg": "No authority rotation is pending"
    },
    {
      "code": 6107,
      "name": "notPendingAuthority",
      "msg": "Signer is not the pending authority"
    },
    {
      "code": 6108,
      "name": "miningDisabled",
      "msg": "Mining is disabled by the on-chain config"
    },
    {
      "code": 6109,
      "name": "collectorMintNotAllowed",
      "msg": "This NFT mint is not registered as a collector perk"
    },
    {
      "code": 6110,
      "name": "invalidCapacityDelta",
      "msg": "Capacity delta is out of bounds"
    },
    {
      "code": 6111,
      "name": "stillActive",
      "msg": "Listing or auction is still active"
    },
    {
      "code": 6112,
      "name": "lotteryAlreadyDrawn",
      "msg": "Lottery round has already been drawn"
    },
    {
      "code": 6113,
      "name": "lotteryRoundNotExpired",
      "msg": "Lottery round refund timeout has not elapsed yet"
    },
    {
      "code": 6114,
      "name": "randomnessDisabled",
      "msg": "Randomness-dependent instruction is disabled until a VRF is integrated"
    },
    {
      "code": 6115,
      "name": "emptyCraftOrder",
      "msg": "Craft order must require at least one resource"
    },
    {
      "code": 6116,
      "name": "invalidExplorationTier",
      "msg": "Exploration tier is out of range"
    },
    {
      "code": 6117,
      "name": "feeTooHigh",
      "msg": "Fee exceeds the hard ceiling"
    },
    {
      "code": 6118,
      "name": "seasonNotStarted",
      "msg": "Season has not started yet"
    },
    {
      "code": 6119,
      "name": "seasonPassAlreadyPremium",
      "msg": "Premium season pass already purchased"
    },
    {
      "code": 6120,
      "name": "cashoutFrozen",
      "msg": "Cash-out is frozen: value cannot leave the game right now"
    },
    {
      "code": 6121,
      "name": "invalidRole",
      "msg": "Role key must be set"
    }
  ],
  "types": [
    {
      "name": "auction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "minBid",
            "type": "u64"
          },
          {
            "name": "currentBid",
            "type": "u64"
          },
          {
            "name": "currentBidder",
            "type": "pubkey"
          },
          {
            "name": "endTime",
            "type": "i64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "auctionBid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "bidder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "auctionCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "minBid",
            "type": "u64"
          },
          {
            "name": "endTime",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "auctionSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "collectorKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "historian"
          },
          {
            "name": "medallion"
          }
        ]
      }
    },
    {
      "name": "collectorStaked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "collectorKind"
              }
            }
          },
          {
            "name": "unlockAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "collectorUnstaked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "collectorKind"
              }
            }
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "foodMint",
            "type": "pubkey"
          },
          {
            "name": "woodMint",
            "type": "pubkey"
          },
          {
            "name": "stoneMint",
            "type": "pubkey"
          },
          {
            "name": "seedsMint",
            "type": "pubkey"
          },
          {
            "name": "waterMint",
            "type": "pubkey"
          },
          {
            "name": "potatoMint",
            "type": "pubkey"
          },
          {
            "name": "craftFee",
            "type": "u64"
          },
          {
            "name": "unstakeFee",
            "type": "u64"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "miningEnabled",
            "type": "bool"
          },
          {
            "name": "pendingAuthority",
            "type": "pubkey"
          },
          {
            "name": "authorityUpdatedAt",
            "type": "i64"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "type": "pubkey"
          },
          {
            "name": "cashoutFrozen",
            "type": "bool"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "craftEconomy",
      "docs": [
        "\u041d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u043c\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b bonding-curve \u043a\u0440\u0430\u0444\u0442\u0430 (\u0431\u0430\u0437\u044b \u0438 \u043c\u043d\u043e\u0436\u0438\u0442\u0435\u043b\u0438 \u043f\u043e",
        "\u0440\u0435\u0434\u043a\u043e\u0441\u0442\u0438), \u043c\u0435\u043d\u044f\u044e\u0442\u0441\u044f \u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0435\u043c \u0447\u0435\u0440\u0435\u0437 set_craft_economy \u0431\u0435\u0437 \u0440\u0435\u0434\u0435\u043f\u043b\u043e\u044f."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "woodBase",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "stoneBase",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "foodBase",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "seedsBase",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "waterBase",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "potatoBase",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "woodMult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "stoneMult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "foodMult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "seedsMult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "waterMult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "potatoMult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "craftEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "toolType",
            "type": "string"
          },
          {
            "name": "rarity",
            "type": "u8"
          },
          {
            "name": "woodCost",
            "type": "u64"
          },
          {
            "name": "stoneCost",
            "type": "u64"
          },
          {
            "name": "foodCost",
            "type": "u64"
          },
          {
            "name": "seedsCost",
            "type": "u64"
          },
          {
            "name": "waterCost",
            "type": "u64"
          },
          {
            "name": "potatoCost",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "craftOrder",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "woodNeeded",
            "type": "u64"
          },
          {
            "name": "stoneNeeded",
            "type": "u64"
          },
          {
            "name": "premiumLamports",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "craftOrderFulfilled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "fulfiller",
            "type": "pubkey"
          },
          {
            "name": "premiumLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "enchantSlot",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "toolMint",
            "type": "pubkey"
          },
          {
            "name": "slotType",
            "type": "u8"
          },
          {
            "name": "level",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "energyAccount",
      "docs": [
        "EnergyAccount \u2014 \u043b\u0435\u043d\u0438\u0432\u0430\u044f \u044d\u043d\u0435\u0440\u0433\u0438\u044f \u0438\u0433\u0440\u043e\u043a\u0430 (\u0440\u0435\u0433\u0435\u043d +1 \u0437\u0430 30 \u043c\u0438\u043d \u0434\u043e \u043a\u0430\u043f\u0430 20)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "current",
            "type": "u8"
          },
          {
            "name": "lastRegenAt",
            "type": "i64"
          },
          {
            "name": "cap",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "explorationCommit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "toolMint",
            "type": "pubkey"
          },
          {
            "name": "commitHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "commitSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "explorationCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "toolMint",
            "type": "pubkey"
          },
          {
            "name": "success",
            "type": "bool"
          },
          {
            "name": "woodReward",
            "type": "u64"
          },
          {
            "name": "stoneReward",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "explorationState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "tier",
            "type": "u8"
          },
          {
            "name": "lastTripAt",
            "type": "i64"
          },
          {
            "name": "tripsToday",
            "type": "u8"
          },
          {
            "name": "dayStart",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "farmTile",
      "docs": [
        "FarmTile \u2014 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u043f\u043e\u043b\u0435\u0432\u043e\u0433\u043e \u0442\u0430\u0439\u043b\u0430 (\u043f\u0443\u0441\u0442\u043e/\u0440\u0430\u0441\u0442\u0451\u0442/\u0433\u043e\u0442\u043e\u0432\u043e)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "state",
            "type": "u8"
          },
          {
            "name": "plantedAt",
            "type": "i64"
          },
          {
            "name": "readyAt",
            "type": "i64"
          },
          {
            "name": "seedsAmount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "forgeAttempted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "toolMint",
            "type": "pubkey"
          },
          {
            "name": "slotType",
            "type": "u8"
          },
          {
            "name": "levelBefore",
            "type": "u8"
          },
          {
            "name": "levelAfter",
            "type": "u8"
          },
          {
            "name": "outcome",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "forgeCommit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "toolMint",
            "type": "pubkey"
          },
          {
            "name": "slotType",
            "type": "u8"
          },
          {
            "name": "commitHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "commitSlot",
            "type": "u64"
          },
          {
            "name": "useProtector",
            "type": "bool"
          },
          {
            "name": "paidLamports",
            "type": "u64"
          },
          {
            "name": "woodBurned",
            "type": "u64"
          },
          {
            "name": "stoneBurned",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "gasFeesSwept",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amountLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "gasTank",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "balanceMicros",
            "type": "u64"
          },
          {
            "name": "cooldownUntil",
            "type": "i64"
          },
          {
            "name": "dustLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "listing",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "listingCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "listingSold",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "lotteryClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "lotteryDrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "winningTicket",
            "type": "u64"
          },
          {
            "name": "poolLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "lotteryRound",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "poolLamports",
            "type": "u64"
          },
          {
            "name": "ticketsSold",
            "type": "u64"
          },
          {
            "name": "drawSlot",
            "type": "u64"
          },
          {
            "name": "drawn",
            "type": "bool"
          },
          {
            "name": "winningTicket",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "drawCommitted",
            "type": "bool"
          },
          {
            "name": "drawCommitSlot",
            "type": "u64"
          },
          {
            "name": "drawCommitHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "lotteryTicket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "ticketNumber",
            "type": "u64"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "lotteryTicketBought",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "ticketNumber",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "materialMints",
      "docs": [
        "MaterialMints \u2014 singleton PDA, \u0445\u0440\u0430\u043d\u0438\u0442 \u0430\u0434\u0440\u0435\u0441\u0430 \u0432\u0441\u0435\u0445 23 \u043c\u0438\u043d\u0442\u043e\u0432 \u0440\u0435\u0441\u0443\u0440\u0441\u043e\u0432"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seeds",
            "type": "pubkey"
          },
          {
            "name": "wheat",
            "type": "pubkey"
          },
          {
            "name": "flour",
            "type": "pubkey"
          },
          {
            "name": "bread",
            "type": "pubkey"
          },
          {
            "name": "water",
            "type": "pubkey"
          },
          {
            "name": "coal",
            "type": "pubkey"
          },
          {
            "name": "meat",
            "type": "pubkey"
          },
          {
            "name": "stoneBlue",
            "type": "pubkey"
          },
          {
            "name": "stonePurple",
            "type": "pubkey"
          },
          {
            "name": "stoneRed",
            "type": "pubkey"
          },
          {
            "name": "sandWhite",
            "type": "pubkey"
          },
          {
            "name": "sandPink",
            "type": "pubkey"
          },
          {
            "name": "sandYellow",
            "type": "pubkey"
          },
          {
            "name": "gemBlue",
            "type": "pubkey"
          },
          {
            "name": "gemOrange",
            "type": "pubkey"
          },
          {
            "name": "gemWhite",
            "type": "pubkey"
          },
          {
            "name": "gemGreen",
            "type": "pubkey"
          },
          {
            "name": "flaskBlue",
            "type": "pubkey"
          },
          {
            "name": "flaskYellow",
            "type": "pubkey"
          },
          {
            "name": "flaskGreen",
            "type": "pubkey"
          },
          {
            "name": "flaskPink",
            "type": "pubkey"
          },
          {
            "name": "flaskPurple",
            "type": "pubkey"
          },
          {
            "name": "loveHeart",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "maxSupply",
            "type": {
              "array": [
                "u64",
                27
              ]
            }
          }
        ]
      }
    },
    {
      "name": "millState",
      "docs": [
        "MillState \u2014 \u043c\u0435\u043b\u044c\u043d\u0438\u0446\u0430 \u0438\u0433\u0440\u043e\u043a\u0430 (\u043e\u0434\u043d\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u0430\u044f \u043f\u0430\u0440\u0442\u0438\u044f \u043e\u0434\u043d\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "inProgress",
            "type": "bool"
          },
          {
            "name": "readyAt",
            "type": "i64"
          },
          {
            "name": "outputFlour",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "miningCollected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "toolMint",
            "type": "pubkey"
          },
          {
            "name": "resourceMint",
            "type": "pubkey"
          },
          {
            "name": "hours",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "durabilityAfter",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "offer",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "offerAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "offerCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "orderMatched",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyOrder",
            "type": "pubkey"
          },
          {
            "name": "sellOrder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "priceLamportsPerUnit",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "orderPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "isBuy",
            "type": "bool"
          },
          {
            "name": "priceLamportsPerUnit",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ovenState",
      "docs": [
        "OvenState \u2014 \u043f\u0435\u0447\u044c \u0438\u0433\u0440\u043e\u043a\u0430 (\u043e\u0434\u043d\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u0430\u044f \u043f\u0430\u0440\u0442\u0438\u044f \u043e\u0434\u043d\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "inProgress",
            "type": "bool"
          },
          {
            "name": "readyAt",
            "type": "i64"
          },
          {
            "name": "outputBread",
            "type": "u64"
          },
          {
            "name": "fuelKind",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "packCommit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "packType",
            "type": "u8"
          },
          {
            "name": "commitHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "commitSlot",
            "type": "u64"
          },
          {
            "name": "revealed",
            "type": "bool"
          },
          {
            "name": "paidLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "packConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "packType",
            "type": "u8"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "oddsBps",
            "type": {
              "array": [
                "u16",
                5
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "packOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "packType",
            "type": "u8"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "rarity"
              }
            }
          },
          {
            "name": "toolType",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "packType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "small"
          },
          {
            "name": "medium"
          },
          {
            "name": "big"
          }
        ]
      }
    },
    {
      "name": "paidOut",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "vaultBalanceAfter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "player",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "cooldownUntil",
            "type": "i64"
          },
          {
            "name": "hasTent",
            "type": "bool"
          },
          {
            "name": "villagers",
            "type": "u32"
          },
          {
            "name": "villagersAvailable",
            "type": "u32"
          },
          {
            "name": "historianCount",
            "type": "u8"
          },
          {
            "name": "medallionCount",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "rarity",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "common"
          },
          {
            "name": "uncommon"
          },
          {
            "name": "rare"
          },
          {
            "name": "epic"
          },
          {
            "name": "legendary"
          }
        ]
      }
    },
    {
      "name": "rarityCounter",
      "docs": [
        "\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u044b\u0439 \u0441\u0447\u0451\u0442\u0447\u0438\u043a \u0437\u0430\u043c\u0438\u043d\u0447\u0435\u043d\u043d\u044b\u0445 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u043e\u0432 \u043f\u043e \u0440\u0435\u0434\u043a\u043e\u0441\u0442\u0438 \u2014 bonding-curve",
        "\u044d\u0441\u043a\u0430\u043b\u0430\u0446\u0438\u044f \u0446\u0435\u043d\u044b \u043a\u0440\u0430\u0444\u0442\u0430. [\u0424\u0410\u041a\u0422, \u0438\u0437 \u0430\u0443\u0434\u0438\u0442\u0430 index.js \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u0433\u043e Ronin-\u0431\u044d\u043a\u0435\u043d\u0434\u0430]:",
        "\u0442\u0430\u043c \u0446\u0435\u043d\u0430 \u043a\u0440\u0430\u0444\u0442\u0430 \u0440\u043e\u0441\u043b\u0430 \u043a\u0430\u043a `cost.wood + mintedCount * mult`; \u0432 \u043f\u0440\u0438\u0441\u043b\u0430\u043d\u043d\u044b\u0445",
        "\u0444\u0430\u0439\u043b\u0430\u0445 \u044d\u0442\u043e\u0439 \u043c\u0435\u0445\u0430\u043d\u0438\u043a\u0438 \u043d\u0435 \u0431\u044b\u043b\u043e \u0432\u043e\u0432\u0441\u0435 (craft \u043d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u0442\u0440\u0430\u0442\u0438\u043b, \u043a\u0440\u043e\u043c\u0435",
        "\u0444\u0438\u043a\u0441. SOL-\u043a\u043e\u043c\u0438\u0441\u0441\u0438\u0438) \u2014 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u044e \u043d\u0430 Solana."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rarity",
            "type": "u8"
          },
          {
            "name": "mintedCount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "referralBound",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "referrer",
            "type": "pubkey"
          },
          {
            "name": "referred",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "referralLink",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "referred",
            "type": "pubkey"
          },
          {
            "name": "referrer",
            "type": "pubkey"
          },
          {
            "name": "tier",
            "type": "u8"
          },
          {
            "name": "boundAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "referralPayout",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "referrer",
            "type": "pubkey"
          },
          {
            "name": "referred",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "referrerStats",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "referrer",
            "type": "pubkey"
          },
          {
            "name": "activeCount",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "rentalAgreement",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "renter",
            "type": "pubkey"
          },
          {
            "name": "start",
            "type": "i64"
          },
          {
            "name": "end",
            "type": "i64"
          },
          {
            "name": "revokeRequestedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "rentalEnded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "rentalListing",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "ownerSplitBps",
            "docs": [
              "[\u0424\u0418\u041a\u0421] \u0414\u043e\u043b\u044f \u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0430 \u043e\u0442 \u043f\u043b\u0430\u0442\u044b \u0437\u0430 \u0430\u0440\u0435\u043d\u0434\u0443 (0..=10000 bps), \u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u0432 start_handler"
            ],
            "type": "u16"
          },
          {
            "name": "minDuration",
            "type": "i64"
          },
          {
            "name": "maxDuration",
            "type": "i64"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "pricePerHourLamports",
            "docs": [
              "[\u0424\u0418\u041a\u0421] \u0426\u0435\u043d\u0430 \u0430\u0440\u0435\u043d\u0434\u044b \u0437\u0430 \u0447\u0430\u0441 \u0432 lamports (\u0440\u0430\u043d\u044c\u0448\u0435 \u0430\u0440\u0435\u043d\u0434\u0430 \u0431\u044b\u043b\u0430 \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e\u0439)"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rentalStarted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "renter",
            "type": "pubkey"
          },
          {
            "name": "endTime",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "rerollCommit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "burnMint",
            "type": "pubkey"
          },
          {
            "name": "newMint",
            "type": "pubkey"
          },
          {
            "name": "commitHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "commitSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rerollConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oddsBps",
            "type": {
              "array": [
                "u16",
                5
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "rerollResult",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "burnedMint",
            "type": "pubkey"
          },
          {
            "name": "newMint",
            "type": "pubkey"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "rarity"
              }
            }
          },
          {
            "name": "toolType",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "resourceKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "food"
          },
          {
            "name": "wood"
          },
          {
            "name": "stone"
          },
          {
            "name": "seeds"
          },
          {
            "name": "wheat"
          },
          {
            "name": "flour"
          },
          {
            "name": "bread"
          },
          {
            "name": "water"
          },
          {
            "name": "coal"
          },
          {
            "name": "meat"
          },
          {
            "name": "stoneBlue"
          },
          {
            "name": "stonePurple"
          },
          {
            "name": "stoneRed"
          },
          {
            "name": "sandWhite"
          },
          {
            "name": "sandPink"
          },
          {
            "name": "sandYellow"
          },
          {
            "name": "gemBlue"
          },
          {
            "name": "gemOrange"
          },
          {
            "name": "gemWhite"
          },
          {
            "name": "gemGreen"
          },
          {
            "name": "flaskBlue"
          },
          {
            "name": "flaskYellow"
          },
          {
            "name": "flaskGreen"
          },
          {
            "name": "flaskPink"
          },
          {
            "name": "flaskPurple"
          },
          {
            "name": "loveHeart"
          },
          {
            "name": "potato"
          }
        ]
      }
    },
    {
      "name": "resourceOrder",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "isBuy",
            "type": "bool"
          },
          {
            "name": "priceLamportsPerUnit",
            "type": "u64"
          },
          {
            "name": "amountRemaining",
            "type": "u64"
          },
          {
            "name": "mint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "season",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seasonId",
            "type": "u32"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "seasonPass",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "seasonId",
            "type": "u32"
          },
          {
            "name": "xp",
            "type": "u32"
          },
          {
            "name": "premium",
            "type": "bool"
          },
          {
            "name": "claimedBitmap",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "seasonPassPurchased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "seasonId",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "seasonRewardClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "level",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "staked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "stakedCollector",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "collectorKind"
              }
            }
          },
          {
            "name": "unlockAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "toolBurned",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "toolCrafted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "burnedMint",
            "type": "pubkey"
          },
          {
            "name": "mintedMint",
            "type": "pubkey"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "rarity"
              }
            }
          },
          {
            "name": "woodCost",
            "type": "u64"
          },
          {
            "name": "stoneCost",
            "type": "u64"
          },
          {
            "name": "mintedCountAfter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "toolData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "toolType",
            "type": "string"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "rarity"
              }
            }
          },
          {
            "name": "durability",
            "type": "u8"
          },
          {
            "name": "isMining",
            "type": "bool"
          },
          {
            "name": "miningEnd",
            "type": "i64"
          },
          {
            "name": "lastMinedHours",
            "type": "u8"
          },
          {
            "name": "staked",
            "type": "bool"
          },
          {
            "name": "unlockAt",
            "type": "i64"
          },
          {
            "name": "operator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "toolMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "toolType",
            "type": "string"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "rarity"
              }
            }
          }
        ]
      }
    },
    {
      "name": "toolRepaired",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "toolMint",
            "type": "pubkey"
          },
          {
            "name": "repairedAmount",
            "type": "u8"
          },
          {
            "name": "stoneCost",
            "type": "u64"
          },
          {
            "name": "woodCost",
            "type": "u64"
          },
          {
            "name": "newDurability",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "unstaked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "weatherState",
      "docs": [
        "WeatherState \u2014 \u0433\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u0430\u044f \u043f\u043e\u0433\u043e\u0434\u0430 (\u043e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u0442\u0441\u044f permissionless-\u043a\u0440\u0430\u043d\u043a\u043e\u043c \u0440\u0430\u0437 \u0432 \u0441\u0443\u0442\u043a\u0438)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dayId",
            "type": "u32"
          },
          {
            "name": "weather",
            "type": "u8"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "wellState",
      "docs": [
        "WellState \u2014 \u043a\u043e\u043b\u043e\u0434\u0435\u0446 \u0438\u0433\u0440\u043e\u043a\u0430 (\u043a\u043e\u043f\u0438\u0442 \u0432\u043e\u0434\u0443 \u0438\u0437 \u043f\u043e\u0433\u043e\u0434\u044b)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "waterBuffer",
            "type": "u64"
          },
          {
            "name": "lastCollectedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "packCommitExpired",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "packType",
            "type": "u8"
          },
          {
            "name": "refundedLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "forgeCommitExpired",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "toolMint",
            "type": "pubkey"
          },
          {
            "name": "slotType",
            "type": "u8"
          },
          {
            "name": "refundedLamports",
            "type": "u64"
          },
          {
            "name": "woodRefunded",
            "type": "u64"
          },
          {
            "name": "stoneRefunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rewardReceipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rewardId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "grossAmount",
            "type": "u64"
          },
          {
            "name": "claimedSlot",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "issuanceCap",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "epochSlots",
            "type": "u64"
          },
          {
            "name": "capPerEpoch",
            "type": "u64"
          },
          {
            "name": "epochStartSlot",
            "type": "u64"
          },
          {
            "name": "mintedInEpoch",
            "type": "u64"
          },
          {
            "name": "lifetimeMinted",
            "type": "u128"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "resourceIssued",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "gross",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "mintedInEpoch",
            "type": "u64"
          },
          {
            "name": "capPerEpoch",
            "type": "u64"
          },
          {
            "name": "epochStartSlot",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "issuanceCapChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "epochSlots",
            "type": "u64"
          },
          {
            "name": "capPerEpoch",
            "type": "u64"
          },
          {
            "name": "mintedInEpoch",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pausedToggled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "feesUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "craftFee",
            "type": "u64"
          },
          {
            "name": "unstakeFee",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "resourceMintsUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previous",
            "type": {
              "array": [
                "pubkey",
                6
              ]
            }
          },
          {
            "name": "current",
            "type": {
              "array": [
                "pubkey",
                6
              ]
            }
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "craftEconomyUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "woodBase",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "stoneBase",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "woodMult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "stoneMult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultGuard",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "epochSlots",
            "type": "u64"
          },
          {
            "name": "capPerEpoch",
            "type": "u64"
          },
          {
            "name": "maxPerTx",
            "type": "u64"
          },
          {
            "name": "epochStartSlot",
            "type": "u64"
          },
          {
            "name": "withdrawnInEpoch",
            "type": "u64"
          },
          {
            "name": "lifetimeWithdrawn",
            "type": "u128"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "collectorAllowEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "collectorKind"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "lotteryTicketCounter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "count",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultWithdrawal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "withdrawnInEpoch",
            "type": "u64"
          },
          {
            "name": "capPerEpoch",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultGuardChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "epochSlots",
            "type": "u64"
          },
          {
            "name": "capPerEpoch",
            "type": "u64"
          },
          {
            "name": "maxPerTx",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "authorityRotationProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previous",
            "type": "pubkey"
          },
          {
            "name": "next",
            "type": "pubkey"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "authorityChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previous",
            "type": "pubkey"
          },
          {
            "name": "next",
            "type": "pubkey"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "miningToggled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "enabled",
            "type": "bool"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "supplyCapChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "maxSupply",
            "type": "u64"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "collectorMintRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "registered",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "playerCapacityChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "previousVillagers",
            "type": "u32"
          },
          {
            "name": "nextVillagers",
            "type": "u32"
          },
          {
            "name": "delta",
            "type": "i32"
          },
          {
            "name": "hasTent",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "lotteryRoundRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "lamports",
            "type": "u64"
          },
          {
            "name": "ticketsSold",
            "type": "u64"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "authorityRotationCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "cancelled",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "packConfigChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "packType",
            "type": "u8"
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "oddsBps",
            "type": {
              "array": [
                "u16",
                5
              ]
            }
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rerollConfigChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oddsBps",
            "type": {
              "array": [
                "u16",
                5
              ]
            }
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "seasonInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seasonId",
            "type": "u32"
          },
          {
            "name": "startTime",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "seasonXpGranted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "seasonId",
            "type": "u32"
          },
          {
            "name": "amount",
            "type": "u32"
          },
          {
            "name": "totalXp",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "materialMintsInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "configMigrated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rolesChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "operator",
            "type": "pubkey"
          },
          {
            "name": "guardian",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "emergencyStopActivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "caller",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "cashoutFrozen",
            "type": "bool"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "cashoutFreezeChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "frozen",
            "type": "bool"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "auctionCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "rentalListed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "pricePerHourLamports",
            "type": "u64"
          },
          {
            "name": "ownerSplitBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "rentalDelisted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
