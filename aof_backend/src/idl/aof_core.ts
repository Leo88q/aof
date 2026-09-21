/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/aof_core.json`.
 */
export type AofCore = {
  "address": "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq",
  "metadata": {
    "name": "aof_core",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Age of Farming core program"
  },
  "instructions": [
    {
      "name": "adjust_player_capacity",
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
          "signer": true,
          "relations": [
            "config"
          ]
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
          "name": "has_tent",
          "type": "bool"
        }
      ]
    },
    {
      "name": "auction_bid",
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
          "name": "previous_bidder",
          "writable": true
        },
        {
          "name": "system_program",
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
      "name": "auction_create",
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
          "name": "seller_token",
          "writable": true
        },
        {
          "name": "auction",
          "writable": true
        },
        {
          "name": "auction_vault",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "min_bid",
          "type": "u64"
        },
        {
          "name": "duration_seconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "auction_settle",
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
          "name": "auction_vault",
          "writable": true
        },
        {
          "name": "winner_token",
          "writable": true
        },
        {
          "name": "tool",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "burn_nft",
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
          "name": "token_account",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "burn_resource",
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
          "name": "material_mints",
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
          "name": "token_account",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "ResourceKind"
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
      "name": "burn_tool",
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
          "name": "token_account",
          "writable": true
        },
        {
          "name": "tool_data",
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
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "buy_lottery_ticket",
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
          "name": "lottery_round",
          "writable": true
        },
        {
          "name": "lottery_ticket",
          "writable": true
        },
        {
          "name": "ticket_counter",
          "writable": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "cancel_buy_order",
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
      "name": "cancel_sell_order",
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
          "name": "order_vault",
          "writable": true
        },
        {
          "name": "maker_token",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claim_lottery_prize",
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
          "name": "lottery_round",
          "writable": true
        },
        {
          "name": "lottery_ticket"
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
      "name": "claim_season_reward",
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
          "name": "material_mints"
        },
        {
          "name": "season"
        },
        {
          "name": "season_pass",
          "writable": true
        },
        {
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "auth"
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "level",
          "type": "u8"
        },
        {
          "name": "premium_track",
          "type": "bool"
        }
      ]
    },
    {
      "name": "collect_bread",
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
          "name": "material_mints",
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
          "name": "oven_state",
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
          "name": "bread_mint",
          "writable": true
        },
        {
          "name": "user_bread",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "collect_flour",
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
          "name": "material_mints",
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
          "name": "mill_state",
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
          "name": "flour_mint",
          "writable": true
        },
        {
          "name": "user_flour",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "collect_mining",
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
          "name": "material_mints",
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
          "name": "payout_mint",
          "writable": true
        },
        {
          "name": "payout_token",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "collect_well_water",
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
          "name": "material_mints"
        },
        {
          "name": "well_state",
          "writable": true
        },
        {
          "name": "weather_state"
        },
        {
          "name": "auth"
        },
        {
          "name": "water_mint",
          "writable": true
        },
        {
          "name": "user_water",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "collector_stake",
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
          "name": "user_token",
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
          "name": "vault_token",
          "writable": true
        },
        {
          "name": "staked_collector",
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
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "CollectorKind"
            }
          }
        }
      ]
    },
    {
      "name": "collector_unstake",
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
          "name": "user_token",
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
          "name": "vault_token",
          "writable": true
        },
        {
          "name": "staked_collector",
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
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "commit_lottery_draw",
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
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "lottery_round",
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
          "name": "commit_hash",
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
          "name": "prev_tool",
          "writable": true
        },
        {
          "name": "prev_mint",
          "writable": true
        },
        {
          "name": "prev_token",
          "writable": true
        },
        {
          "name": "new_mint",
          "writable": true
        },
        {
          "name": "new_token",
          "writable": true
        },
        {
          "name": "new_tool_data",
          "writable": true
        },
        {
          "name": "auth"
        },
        {
          "name": "rarity_counter",
          "writable": true
        },
        {
          "name": "craft_economy"
        },
        {
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_stone",
          "writable": true
        },
        {
          "name": "food_mint",
          "writable": true
        },
        {
          "name": "user_food",
          "writable": true
        },
        {
          "name": "seeds_mint",
          "writable": true
        },
        {
          "name": "user_seeds",
          "writable": true
        },
        {
          "name": "water_mint",
          "writable": true
        },
        {
          "name": "user_water",
          "writable": true
        },
        {
          "name": "potato_mint",
          "writable": true
        },
        {
          "name": "user_potato",
          "writable": true
        },
        {
          "name": "skr_mint",
          "writable": true
        },
        {
          "name": "user_skr",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tool_type",
          "type": "string"
        },
        {
          "name": "rarity",
          "type": {
            "defined": {
              "name": "Rarity"
            }
          }
        }
      ]
    },
    {
      "name": "craft_order_cancel",
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
          "name": "craft_order",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "craft_order_create",
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
          "name": "craft_order",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "wood_needed",
          "type": "u64"
        },
        {
          "name": "stone_needed",
          "type": "u64"
        },
        {
          "name": "premium_lamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "craft_order_fulfill",
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
          "name": "craft_order",
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
          "name": "creator_refund",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "wood_mint"
        },
        {
          "name": "fulfiller_wood",
          "writable": true
        },
        {
          "name": "creator_wood",
          "writable": true
        },
        {
          "name": "stone_mint"
        },
        {
          "name": "fulfiller_stone",
          "writable": true
        },
        {
          "name": "creator_stone",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "craft_recipe",
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
          "name": "material_mints"
        },
        {
          "name": "auth"
        },
        {
          "name": "input_1_mint",
          "writable": true
        },
        {
          "name": "input_1_acc",
          "writable": true
        },
        {
          "name": "input_2_mint",
          "writable": true
        },
        {
          "name": "input_2_acc",
          "writable": true
        },
        {
          "name": "output_mint",
          "writable": true
        },
        {
          "name": "output_acc",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "recipe_id",
          "type": "u8"
        }
      ]
    },
    {
      "name": "deposit_gas",
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
          "name": "system_program",
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
      "name": "draw_lottery",
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
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "lottery_round",
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
          "name": "slot_hashes",
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
      "name": "explore_reveal",
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
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "exploration_state",
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
          "name": "exploration_commit",
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
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_stone",
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
          "name": "slot_hashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "token_program",
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
      "name": "forge_attempt_commit",
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
          "name": "tool_mint"
        },
        {
          "name": "enchant_slot",
          "writable": true
        },
        {
          "name": "forge_commit",
          "writable": true
        },
        {
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_stone",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "slot_type",
          "type": "u8"
        },
        {
          "name": "commit_hash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "use_protector",
          "type": "bool"
        }
      ]
    },
    {
      "name": "forge_attempt_reveal",
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
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "enchant_slot",
          "writable": true
        },
        {
          "name": "forge_commit",
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
          "name": "slot_hashes",
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
      "name": "forge_attempt_expire",
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
          "name": "forge_commit",
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
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_stone",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "grant_season_xp",
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
          "signer": true,
          "relations": [
            "config"
          ]
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
          "name": "season_pass",
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
          "name": "system_program",
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
      "name": "harvest_wheat",
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
          "name": "material_mints",
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
          "name": "energy_account",
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
          "name": "farm_tile",
          "writable": true
        },
        {
          "name": "tool_data",
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
          "name": "wheat_mint",
          "writable": true
        },
        {
          "name": "user_wheat",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tile_index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "init_craft_economy",
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
          "name": "craft_economy",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "init_lottery_round",
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
          "name": "lottery_round",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "round_id",
          "type": "u64"
        }
      ]
    },
    {
      "name": "init_material_mints",
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
          "name": "material_mints",
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
          "name": "system_program",
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
          "name": "stone_blue",
          "type": "pubkey"
        },
        {
          "name": "stone_purple",
          "type": "pubkey"
        },
        {
          "name": "stone_red",
          "type": "pubkey"
        },
        {
          "name": "sand_white",
          "type": "pubkey"
        },
        {
          "name": "sand_pink",
          "type": "pubkey"
        },
        {
          "name": "sand_yellow",
          "type": "pubkey"
        },
        {
          "name": "gem_blue",
          "type": "pubkey"
        },
        {
          "name": "gem_orange",
          "type": "pubkey"
        },
        {
          "name": "gem_white",
          "type": "pubkey"
        },
        {
          "name": "gem_green",
          "type": "pubkey"
        },
        {
          "name": "flask_blue",
          "type": "pubkey"
        },
        {
          "name": "flask_yellow",
          "type": "pubkey"
        },
        {
          "name": "flask_green",
          "type": "pubkey"
        },
        {
          "name": "flask_pink",
          "type": "pubkey"
        },
        {
          "name": "flask_purple",
          "type": "pubkey"
        },
        {
          "name": "love_heart",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "init_pack_config",
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
          "name": "pack_config",
          "writable": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pack_type",
          "type": "u8"
        },
        {
          "name": "price_lamports",
          "type": "u64"
        },
        {
          "name": "odds_bps",
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
      "name": "init_rarity_counter",
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
          "name": "rarity_counter",
          "writable": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "rarity",
          "type": {
            "defined": {
              "name": "Rarity"
            }
          }
        }
      ]
    },
    {
      "name": "init_reroll_config",
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
          "name": "reroll_config",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "odds_bps",
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
      "name": "init_season",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "season_id",
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
          "name": "program_data"
        },
        {
          "name": "system_program",
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
      "name": "marketplace_buy",
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
          "name": "listing_vault",
          "writable": true
        },
        {
          "name": "buyer_token",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "marketplace_cancel",
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
          "name": "listing_vault",
          "writable": true
        },
        {
          "name": "seller_token",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "marketplace_list",
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
          "name": "seller_token",
          "writable": true
        },
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "listing_vault",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "price_lamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "match_resource_orders",
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
          "name": "material_mints",
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
          "name": "buy_order",
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
          "name": "sell_order",
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
          "name": "sell_vault",
          "writable": true
        },
        {
          "name": "buyer_token",
          "docs": [
            "\u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c \u2014 \u0432\u043b\u0430\u0434\u0435\u043b\u0435\u0446 buy_order, \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442 \u0440\u0435\u0441\u0443\u0440\u0441"
          ],
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "migrate_tool",
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
          "name": "migration_authority",
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
          "name": "vault_token_account",
          "writable": true
        },
        {
          "name": "tool_data",
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
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tool_type",
          "type": "string"
        },
        {
          "name": "rarity",
          "type": {
            "defined": {
              "name": "Rarity"
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
      "name": "mint_resource",
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
          "name": "material_mints"
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
          "name": "token_account",
          "writable": true
        },
        {
          "name": "treasury_token",
          "writable": true
        },
        {
          "name": "player",
          "writable": true
        },
        {
          "name": "issuance_cap",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "ResourceKind"
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
      "name": "mint_tool",
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
          "name": "token_account",
          "writable": true
        },
        {
          "name": "recipient",
          "writable": true
        },
        {
          "name": "tool_data",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tool_type",
          "type": "string"
        },
        {
          "name": "rarity",
          "type": {
            "defined": {
              "name": "Rarity"
            }
          }
        }
      ]
    },
    {
      "name": "offer_accept",
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
          "name": "buyer_refund",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "seller_token",
          "writable": true
        },
        {
          "name": "buyer_token",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "offer_cancel",
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
      "name": "offer_create",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "price_lamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pack_open_commit",
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
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "pack_config"
        },
        {
          "name": "auth"
        },
        {
          "name": "mint"
        },
        {
          "name": "pack_commit",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pack_type",
          "type": {
            "defined": {
              "name": "PackType"
            }
          }
        },
        {
          "name": "commit_hash",
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
      "name": "pack_open_reveal",
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
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "pack_commit",
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
          "name": "pack_config"
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "user_token",
          "writable": true
        },
        {
          "name": "tool_data",
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
          "name": "slot_hashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
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
      "name": "pack_open_expire",
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
          "name": "pack_commit",
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
      "name": "pay_out",
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
          "name": "vault_token",
          "writable": true
        },
        {
          "name": "user_token",
          "writable": true
        },
        {
          "name": "player"
        },
        {
          "name": "material_mints"
        },
        {
          "name": "vault_guard",
          "writable": true
        },
        {
          "name": "token_program",
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
      "name": "pay_out_with_referral",
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
          "name": "vault_token",
          "writable": true
        },
        {
          "name": "user_token",
          "writable": true
        },
        {
          "name": "referral_link"
        },
        {
          "name": "referrer_token",
          "writable": true
        },
        {
          "name": "player"
        },
        {
          "name": "material_mints"
        },
        {
          "name": "vault_guard",
          "writable": true
        },
        {
          "name": "token_program",
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
      "name": "place_buy_order",
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
          "name": "material_mints",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": "u8"
        },
        {
          "name": "price_lamports_per_unit",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "place_sell_order",
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
          "name": "material_mints",
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
          "name": "maker_token",
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
          "name": "order_vault",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": "u8"
        },
        {
          "name": "price_lamports_per_unit",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "plant_seeds",
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
          "name": "material_mints",
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
          "name": "energy_account",
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
          "name": "farm_tile",
          "writable": true
        },
        {
          "name": "seeds_mint",
          "writable": true
        },
        {
          "name": "user_seeds",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tile_index",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "purchase_season_pass",
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
          "name": "season_pass",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "referral_bind",
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
          "name": "referrer_player",
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
          "name": "referrer_stats",
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
          "name": "referral_link",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "referral_upgrade",
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
          "name": "referral_link",
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
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_stone",
          "writable": true
        },
        {
          "name": "food_mint",
          "writable": true
        },
        {
          "name": "user_food",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "rental_end",
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
          "name": "rental_agreement",
          "writable": true
        },
        {
          "name": "renter_refund",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "rental_list",
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
          "name": "rental_listing",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "owner_split_bps",
          "type": "u16"
        },
        {
          "name": "min_duration",
          "type": "i64"
        },
        {
          "name": "max_duration",
          "type": "i64"
        },
        {
          "name": "price_per_hour_lamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "rental_revoke",
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
          "name": "rental_agreement",
          "writable": true
        },
        {
          "name": "renter_refund",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "rental_start",
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
          "name": "rental_listing",
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
          "name": "rental_agreement",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "duration_seconds",
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
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_stone",
          "writable": true
        },
        {
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "token_program",
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
          "name": "tool_a",
          "writable": true
        },
        {
          "name": "mint_a",
          "writable": true
        },
        {
          "name": "token_a",
          "writable": true
        },
        {
          "name": "tool_b",
          "writable": true
        },
        {
          "name": "mint_b",
          "writable": true
        },
        {
          "name": "token_b",
          "writable": true
        },
        {
          "name": "new_mint",
          "writable": true
        },
        {
          "name": "new_token",
          "writable": true
        },
        {
          "name": "new_tool_data",
          "writable": true
        },
        {
          "name": "auth"
        },
        {
          "name": "rarity_counter",
          "writable": true
        },
        {
          "name": "craft_economy"
        },
        {
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_stone",
          "writable": true
        },
        {
          "name": "food_mint",
          "writable": true
        },
        {
          "name": "user_food",
          "writable": true
        },
        {
          "name": "seeds_mint",
          "writable": true
        },
        {
          "name": "user_seeds",
          "writable": true
        },
        {
          "name": "water_mint",
          "writable": true
        },
        {
          "name": "user_water",
          "writable": true
        },
        {
          "name": "potato_mint",
          "writable": true
        },
        {
          "name": "user_potato",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "new_type",
          "type": "string"
        }
      ]
    },
    {
      "name": "reroll_random_commit",
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
          "name": "burn_tool",
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
          "name": "burn_mint",
          "writable": true
        },
        {
          "name": "burn_token",
          "writable": true
        },
        {
          "name": "new_mint"
        },
        {
          "name": "reroll_commit",
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
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "commit_hash",
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
      "name": "reroll_random_reveal",
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
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "reroll_config",
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
          "name": "reroll_commit",
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
          "name": "new_mint",
          "writable": true
        },
        {
          "name": "new_token",
          "writable": true
        },
        {
          "name": "new_tool_data",
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
          "name": "slot_hashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
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
      "name": "set_craft_economy",
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
          "name": "craft_economy",
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
          "name": "wood_base",
          "type": {
            "array": [
              "u64",
              4
            ]
          }
        },
        {
          "name": "stone_base",
          "type": {
            "array": [
              "u64",
              4
            ]
          }
        },
        {
          "name": "wood_mult",
          "type": {
            "array": [
              "u64",
              4
            ]
          }
        },
        {
          "name": "stone_mult",
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
      "name": "set_fees",
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
          "name": "craft_fee",
          "type": "u64"
        },
        {
          "name": "unstake_fee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "set_pack_config",
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
          "name": "pack_config",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "price_lamports",
          "type": "u64"
        },
        {
          "name": "odds_bps",
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
      "name": "set_paused",
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
      "name": "set_reroll_config",
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
          "name": "reroll_config",
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
          "name": "odds_bps",
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
      "name": "set_resource_mints",
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
          "name": "food_mint",
          "type": "pubkey"
        },
        {
          "name": "wood_mint",
          "type": "pubkey"
        },
        {
          "name": "stone_mint",
          "type": "pubkey"
        },
        {
          "name": "seeds_mint",
          "type": "pubkey"
        },
        {
          "name": "water_mint",
          "type": "pubkey"
        },
        {
          "name": "potato_mint",
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
          "name": "user_token",
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
          "name": "vault_token",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "lock_seconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "start_baking",
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
          "name": "material_mints",
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
          "name": "energy_account",
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
          "name": "oven_state",
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
          "name": "flour_mint",
          "writable": true
        },
        {
          "name": "water_mint",
          "writable": true
        },
        {
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "coal_mint",
          "writable": true
        },
        {
          "name": "user_flour",
          "writable": true
        },
        {
          "name": "user_water",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "user_coal",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "batch_size",
          "type": "u8"
        },
        {
          "name": "fuel_kind",
          "type": "u8"
        }
      ]
    },
    {
      "name": "start_exploration_commit",
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
          "name": "material_mints",
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
          "name": "exploration_state",
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
          "name": "tool_mint"
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
          "name": "exploration_commit",
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
          "name": "food_mint",
          "writable": true
        },
        {
          "name": "user_food",
          "writable": true
        },
        {
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_stone",
          "writable": true
        },
        {
          "name": "meat_mint",
          "writable": true
        },
        {
          "name": "user_meat",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "commit_hash",
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
      "name": "start_milling",
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
          "name": "material_mints",
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
          "name": "energy_account",
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
          "name": "mill_state",
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
          "name": "wheat_mint",
          "writable": true
        },
        {
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_wheat",
          "writable": true
        },
        {
          "name": "user_stone",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "batch_size",
          "type": "u8"
        }
      ]
    },
    {
      "name": "start_mining",
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
          "name": "system_program",
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
      "name": "sweep_gas_fees",
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
          "signer": true,
          "relations": [
            "config"
          ]
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
          "name": "system_program",
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
          "name": "user_token",
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
          "name": "vault_token",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "upgrade_exploration_tier",
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
          "name": "exploration_state",
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
          "name": "wood_mint",
          "writable": true
        },
        {
          "name": "user_wood",
          "writable": true
        },
        {
          "name": "stone_mint",
          "writable": true
        },
        {
          "name": "user_stone",
          "writable": true
        },
        {
          "name": "food_mint",
          "writable": true
        },
        {
          "name": "user_food",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "weather_crank",
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
          "name": "weather_state",
          "writable": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdraw_gas",
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
          "name": "system_program",
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
      "name": "mint_resource_once",
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
          "name": "material_mints"
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
          "name": "token_account",
          "writable": true
        },
        {
          "name": "treasury_token",
          "writable": true
        },
        {
          "name": "player",
          "writable": true
        },
        {
          "name": "issuance_cap",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "reward_receipt",
          "writable": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "ResourceKind"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "reward_id",
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
      "name": "marketplace_buy_bounded",
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
          "name": "listing_vault",
          "writable": true
        },
        {
          "name": "buyer_token",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "max_price_lamports",
          "type": "u64"
        },
        {
          "name": "expires_at",
          "type": "i64"
        }
      ]
    },
    {
      "name": "init_issuance_cap",
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
          "name": "issuance_cap",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "ResourceKind"
            }
          }
        },
        {
          "name": "epoch_slots",
          "type": "u64"
        },
        {
          "name": "cap_per_epoch",
          "type": "u64"
        }
      ]
    },
    {
      "name": "set_issuance_cap",
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
          "name": "issuance_cap",
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
              "name": "ResourceKind"
            }
          }
        },
        {
          "name": "epoch_slots",
          "type": "u64"
        },
        {
          "name": "cap_per_epoch",
          "type": "u64"
        }
      ]
    },
    {
      "name": "set_pending_authority",
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
          "name": "new_authority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "accept_authority",
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
          "name": "new_authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "cancel_pending_authority",
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
      "name": "set_mining_enabled",
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
      "name": "init_vault_guard",
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
          "name": "vault_guard",
          "writable": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "epoch_slots",
          "type": "u64"
        },
        {
          "name": "cap_per_epoch",
          "type": "u64"
        },
        {
          "name": "max_per_tx",
          "type": "u64"
        }
      ]
    },
    {
      "name": "set_vault_guard",
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
          "name": "vault_guard",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "epoch_slots",
          "type": "u64"
        },
        {
          "name": "cap_per_epoch",
          "type": "u64"
        },
        {
          "name": "max_per_tx",
          "type": "u64"
        }
      ]
    },
    {
      "name": "set_supply_cap",
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
          "name": "material_mints",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "ResourceKind"
            }
          }
        },
        {
          "name": "max_supply",
          "type": "u64"
        }
      ]
    },
    {
      "name": "register_collector_mint",
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "kind",
          "type": {
            "defined": {
              "name": "CollectorKind"
            }
          }
        }
      ]
    },
    {
      "name": "revoke_collector_mint",
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
      "name": "refund_lottery_round",
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
          "name": "round_id",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "Auction",
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
      "name": "Config",
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
      "name": "CraftEconomy",
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
      "name": "CraftOrder",
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
      "name": "EnchantSlot",
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
      "name": "EnergyAccount",
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
      "name": "ExplorationCommit",
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
      "name": "ExplorationState",
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
      "name": "FarmTile",
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
      "name": "ForgeCommit",
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
      "name": "GasTank",
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
      "name": "Listing",
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
      "name": "LotteryRound",
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
      "name": "LotteryTicket",
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
      "name": "MaterialMints",
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
      "name": "MillState",
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
      "name": "Offer",
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
      "name": "OvenState",
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
      "name": "PackCommit",
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
      "name": "PackConfig",
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
      "name": "Player",
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
      "name": "RarityCounter",
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
      "name": "ReferralLink",
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
      "name": "ReferrerStats",
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
      "name": "RentalAgreement",
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
      "name": "RentalListing",
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
      "name": "RerollCommit",
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
      "name": "RerollConfig",
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
      "name": "ResourceOrder",
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
      "name": "Season",
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
      "name": "SeasonPass",
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
      "name": "StakedCollector",
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
      "name": "ToolData",
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
      "name": "WeatherState",
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
      "name": "WellState",
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
      "name": "RewardReceipt",
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
      "name": "IssuanceCap",
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
      "name": "VaultGuard",
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
      "name": "CollectorAllowEntry",
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
      "name": "LotteryTicketCounter",
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
      "name": "AuctionBid",
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
      "name": "AuctionCreated",
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
      "name": "AuctionSettled",
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
      "name": "CollectorStaked",
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
      "name": "CollectorUnstaked",
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
      "name": "CraftEvent",
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
      "name": "CraftOrderFulfilled",
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
      "name": "ExplorationCompleted",
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
      "name": "ForgeAttempted",
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
      "name": "GasFeesSwept",
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
      "name": "ListingCreated",
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
      "name": "ListingSold",
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
      "name": "LotteryClaimed",
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
      "name": "LotteryDrawn",
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
      "name": "LotteryTicketBought",
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
      "name": "MiningCollected",
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
      "name": "OfferAccepted",
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
      "name": "OfferCreated",
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
      "name": "OrderMatched",
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
      "name": "OrderPlaced",
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
      "name": "PackOpened",
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
      "name": "PaidOut",
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
      "name": "ReferralBound",
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
      "name": "ReferralPayout",
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
      "name": "RentalEnded",
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
      "name": "RentalStarted",
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
      "name": "RerollResult",
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
      "name": "SeasonPassPurchased",
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
      "name": "SeasonRewardClaimed",
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
      "name": "Staked",
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
      "name": "ToolBurned",
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
      "name": "ToolCrafted",
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
      "name": "ToolMinted",
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
      "name": "ToolRepaired",
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
      "name": "Unstaked",
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
      "name": "PackCommitExpired",
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
      "name": "ForgeCommitExpired",
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
      "name": "ResourceIssued",
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
      "name": "IssuanceCapChanged",
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
      "name": "PausedToggled",
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
      "name": "FeesUpdated",
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
      "name": "ResourceMintsUpdated",
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
      "name": "CraftEconomyUpdated",
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
      "name": "VaultWithdrawal",
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
      "name": "VaultGuardChanged",
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
      "name": "AuthorityRotationProposed",
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
      "name": "AuthorityChanged",
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
      "name": "MiningToggled",
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
      "name": "SupplyCapChanged",
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
      "name": "CollectorMintRegistered",
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
      "name": "PlayerCapacityChanged",
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
      "name": "LotteryRoundRefunded",
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
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "Unauthorized",
      "msg": "Unauthorized: signer does not match required authority"
    },
    {
      "code": 6001,
      "name": "MathOverflow",
      "msg": "Math overflow or underflow detected"
    },
    {
      "code": 6002,
      "name": "InsufficientBalance",
      "msg": "Insufficient balance for operation"
    },
    {
      "code": 6003,
      "name": "ZeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6004,
      "name": "Paused",
      "msg": "Program is paused"
    },
    {
      "code": 6005,
      "name": "InvalidResourceKind",
      "msg": "Invalid resource kind for mint"
    },
    {
      "code": 6006,
      "name": "InvalidRarityForCraft",
      "msg": "Tool rarity must be above Common for craft"
    },
    {
      "code": 6007,
      "name": "NotToolOwner",
      "msg": "Tool is not owned by user"
    },
    {
      "code": 6008,
      "name": "InsufficientDurability",
      "msg": "Tool durability insufficient"
    },
    {
      "code": 6009,
      "name": "ToolIsMining",
      "msg": "Tool is currently mining"
    },
    {
      "code": 6010,
      "name": "MiningNotComplete",
      "msg": "Mining not yet complete"
    },
    {
      "code": 6011,
      "name": "InvalidMiningHours",
      "msg": "Invalid mining hours for tool rarity"
    },
    {
      "code": 6012,
      "name": "DurabilityExceedsMax",
      "msg": "Durability would exceed maximum"
    },
    {
      "code": 6013,
      "name": "InvalidStakeState",
      "msg": "Tool is already staked or not staked"
    },
    {
      "code": 6014,
      "name": "NotStaked",
      "msg": "Tool is not staked"
    },
    {
      "code": 6015,
      "name": "AlreadyStaked",
      "msg": "Tool is already staked"
    },
    {
      "code": 6016,
      "name": "AlreadyMining",
      "msg": "Tool is already mining"
    },
    {
      "code": 6017,
      "name": "NotMining",
      "msg": "Tool is not mining"
    },
    {
      "code": 6018,
      "name": "LockNotExpired",
      "msg": "Lock period not yet expired"
    },
    {
      "code": 6019,
      "name": "CooldownNotExpired",
      "msg": "Cooldown period not yet expired"
    },
    {
      "code": 6020,
      "name": "CannotRerollLegendary",
      "msg": "Legendary tools cannot be rerolled"
    },
    {
      "code": 6021,
      "name": "RerollMismatchedRarity",
      "msg": "Reroll requires two tools of same rarity"
    },
    {
      "code": 6022,
      "name": "AlreadyInitialized",
      "msg": "Program already initialized"
    },
    {
      "code": 6023,
      "name": "InvalidMigrationAuthority",
      "msg": "Invalid migration authority"
    },
    {
      "code": 6024,
      "name": "VaultInsufficient",
      "msg": "Vault balance insufficient for payout"
    },
    {
      "code": 6025,
      "name": "InvalidLockSeconds",
      "msg": "Invalid lock seconds for stake"
    },
    {
      "code": 6026,
      "name": "ToolTypeTooLong",
      "msg": "Tool type string too long"
    },
    {
      "code": 6027,
      "name": "RentExemptionFailed",
      "msg": "Rent exemption check failed"
    },
    {
      "code": 6028,
      "name": "RarityCounterMismatch",
      "msg": "Rarity counter account does not match the tool's target rarity"
    },
    {
      "code": 6029,
      "name": "NoExcessToSweep",
      "msg": "No excess lamports available to sweep from gas tank"
    },
    {
      "code": 6030,
      "name": "InvalidMint",
      "msg": "Invalid mint address"
    },
    {
      "code": 6031,
      "name": "NoIdleVillagers",
      "msg": "No idle villagers available for mining"
    },
    {
      "code": 6032,
      "name": "HoursExceedRarityCap",
      "msg": "Requested mining hours exceed max hours for this tool rarity"
    },
    {
      "code": 6033,
      "name": "NotCollectorOwner",
      "msg": "Signer does not own this staked collector"
    },
    {
      "code": 6034,
      "name": "CollectorNotConfigured",
      "msg": "Collector mint registry is not configured"
    },
    {
      "code": 6035,
      "name": "CommitMismatch",
      "msg": "Commit hash does not match revealed secret"
    },
    {
      "code": 6036,
      "name": "CommitExpired",
      "msg": "Commit has expired (SlotHashes window passed) \u2014 abort and refund"
    },
    {
      "code": 6037,
      "name": "InvalidOddsWeights",
      "msg": "Odds weights must sum to 10000 basis points"
    },
    {
      "code": 6038,
      "name": "ExplorationCooldown",
      "msg": "Exploration cooldown has not expired"
    },
    {
      "code": 6039,
      "name": "ExplorationDailyLimitReached",
      "msg": "Daily exploration trip limit reached"
    },
    {
      "code": 6040,
      "name": "ExplorationMaxTier",
      "msg": "Exploration tier is already at maximum"
    },
    {
      "code": 6041,
      "name": "ReferralAlreadyBound",
      "msg": "Referral link already exists for this user"
    },
    {
      "code": 6042,
      "name": "ReferralCapReached",
      "msg": "Referrer has reached their active referral cap"
    },
    {
      "code": 6043,
      "name": "InvalidReferral",
      "msg": "A wallet cannot refer itself"
    },
    {
      "code": 6044,
      "name": "ReferralMaxTier",
      "msg": "Referral tier is already at maximum"
    },
    {
      "code": 6045,
      "name": "EnchantMaxLevel",
      "msg": "Enchant slot is already at maximum level"
    },
    {
      "code": 6046,
      "name": "AuctionEnded",
      "msg": "Auction has already ended"
    },
    {
      "code": 6047,
      "name": "AuctionNotEnded",
      "msg": "Auction has not ended yet"
    },
    {
      "code": 6048,
      "name": "BidTooLow",
      "msg": "Bid must exceed current highest bid"
    },
    {
      "code": 6049,
      "name": "NotActive",
      "msg": "Listing/Offer/Auction is not active"
    },
    {
      "code": 6050,
      "name": "InvalidRentalDuration",
      "msg": "Rental period out of allowed range"
    },
    {
      "code": 6051,
      "name": "RentalGraceNotExpired",
      "msg": "Rental is still active \u2014 cannot revoke without grace period"
    },
    {
      "code": 6052,
      "name": "NotToolOperator",
      "msg": "Signer is not the current operator of this tool"
    },
    {
      "code": 6053,
      "name": "OrdersDoNotCross",
      "msg": "Order kinds/side do not cross (price/side mismatch)"
    },
    {
      "code": 6054,
      "name": "OrderExhausted",
      "msg": "Order has no remaining amount"
    },
    {
      "code": 6055,
      "name": "LotteryRoundClosed",
      "msg": "Lottery round is already drawn or closed"
    },
    {
      "code": 6056,
      "name": "LotteryNotDrawn",
      "msg": "Lottery round is not drawn yet"
    },
    {
      "code": 6057,
      "name": "NotWinningTicket",
      "msg": "Not the winning ticket for this round"
    },
    {
      "code": 6058,
      "name": "LotteryDailyLimitReached",
      "msg": "Daily lottery ticket limit reached"
    },
    {
      "code": 6059,
      "name": "SeasonRewardAlreadyClaimed",
      "msg": "Season reward level already claimed"
    },
    {
      "code": 6060,
      "name": "SeasonPremiumRequired",
      "msg": "Season reward requires premium pass"
    },
    {
      "code": 6061,
      "name": "SeasonInsufficientXp",
      "msg": "Not enough XP for this season level"
    },
    {
      "code": 6062,
      "name": "SeasonEnded",
      "msg": "Season has ended"
    },
    {
      "code": 6063,
      "name": "LotteryDrawNotCommitted",
      "msg": "Lottery draw has not been committed yet"
    },
    {
      "code": 6064,
      "name": "LotteryDrawAlreadyCommitted",
      "msg": "Lottery draw is already committed"
    },
    {
      "code": 6065,
      "name": "InvalidHash",
      "msg": "Revealed secret does not match committed hash"
    },
    {
      "code": 6066,
      "name": "EnergyDepleted",
      "msg": "Energy account depleted"
    },
    {
      "code": 6067,
      "name": "InsufficientEnergy",
      "msg": "Energy cost exceeds available balance"
    },
    {
      "code": 6068,
      "name": "FarmTileBusy",
      "msg": "Farm tile is busy (growing)"
    },
    {
      "code": 6069,
      "name": "FarmTileNotReady",
      "msg": "Farm tile is not ready for harvest"
    },
    {
      "code": 6070,
      "name": "FarmTileEmpty",
      "msg": "Farm tile is empty (nothing planted)"
    },
    {
      "code": 6071,
      "name": "ToolBusy",
      "msg": "Tool is busy (mining), cannot harvest"
    },
    {
      "code": 6072,
      "name": "MillInProgress",
      "msg": "Mill has active batch in progress"
    },
    {
      "code": 6073,
      "name": "MillNotReady",
      "msg": "Mill batch is not ready yet"
    },
    {
      "code": 6074,
      "name": "OvenInProgress",
      "msg": "Oven has active batch in progress"
    },
    {
      "code": 6075,
      "name": "OvenNotReady",
      "msg": "Oven batch is not ready yet"
    },
    {
      "code": 6076,
      "name": "InvalidBatchSize",
      "msg": "Invalid batch size (must be 1, 2, or 3)"
    },
    {
      "code": 6077,
      "name": "InvalidFuelKind",
      "msg": "Invalid fuel kind (must be 0=wood or 1=coal)"
    },
    {
      "code": 6078,
      "name": "MaterialNotRegistered",
      "msg": "Material mint is not registered in MaterialMints PDA"
    },
    {
      "code": 6079,
      "name": "WeatherAlreadyUpdated",
      "msg": "Weather state already updated for this day"
    },
    {
      "code": 6080,
      "name": "WellEmpty",
      "msg": "Well has no water to collect"
    },
    {
      "code": 6081,
      "name": "RecipeNotFound",
      "msg": "Recipe not found in RecipeConfig"
    },
    {
      "code": 6082,
      "name": "FortuneBoostExpired",
      "msg": "Fortune boost has expired"
    },
    {
      "code": 6083,
      "name": "FortuneBoostAlreadyActive",
      "msg": "Fortune boost is already active"
    },
    {
      "code": 6084,
      "name": "LoveHeartNotTransferable",
      "msg": "Love heart is not transferable"
    },
    {
      "code": 6085,
      "name": "InvalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6086,
      "name": "DurabilityOverflow",
      "msg": "Durability overflow"
    },
    {
      "code": 6087,
      "name": "InvalidWeatherSeed",
      "msg": "Invalid weather seed (must be derived from slot hash)"
    },
    {
      "code": 6088,
      "name": "InvalidReveal",
      "msg": "Invalid reveal: hash mismatch"
    },
    {
      "code": 6089,
      "name": "AlreadyRevealed",
      "msg": "Commit already revealed"
    },
    {
      "code": 6090,
      "name": "InvalidFlaskType",
      "msg": "Invalid flask type"
    },
    {
      "code": 6091,
      "name": "EnergyCapExceeded",
      "msg": "Energy cap exceeded"
    },
    {
      "code": 6092,
      "name": "InvalidToolType",
      "msg": "Tool type is not valid for this instruction"
    },
    {
      "code": 6093,
      "name": "InvalidProgramData",
      "msg": "Program data does not contain a valid upgrade authority"
    },
    {
      "code": 6094,
      "name": "FeatureDisabled",
      "msg": "Feature is disabled until its on-chain economic and recovery path is complete"
    },
    {
      "code": 6095,
      "name": "CommitNotExpired",
      "msg": "Commit is still inside its reveal window; it cannot be expired yet"
    },
    {
      "code": 6096,
      "name": "PriceLimitExceeded",
      "msg": "Listing price exceeds the signed maximum"
    },
    {
      "code": 6097,
      "name": "QuoteExpired",
      "msg": "Quote expired or its lifetime exceeds 300 seconds"
    },
    {
      "code": 6098,
      "name": "IssuanceCapNotConfigured",
      "msg": "Issuance cap for this resource is not configured"
    },
    {
      "code": 6099,
      "name": "IssuanceCapExceeded",
      "msg": "Issuance cap for this resource exceeded in the current epoch"
    },
    {
      "code": 6100,
      "name": "InvalidIssuanceCapParams",
      "msg": "Issuance cap parameters out of bounds"
    },
    {
      "code": 6101,
      "name": "SupplyCapExceeded",
      "msg": "Global supply cap for this resource would be exceeded"
    },
    {
      "code": 6102,
      "name": "VaultGuardNotConfigured",
      "msg": "Vault withdrawal guard for this mint is not configured"
    },
    {
      "code": 6103,
      "name": "VaultGuardLimitExceeded",
      "msg": "Vault withdrawal exceeds the per-transaction or per-epoch limit"
    },
    {
      "code": 6104,
      "name": "NotAResourceMint",
      "msg": "Mint is not a configured resource mint; pay_out cannot move it"
    },
    {
      "code": 6105,
      "name": "InvalidVaultGuardParams",
      "msg": "Vault withdrawal guard parameters out of bounds"
    },
    {
      "code": 6106,
      "name": "NoPendingAuthority",
      "msg": "No authority rotation is pending"
    },
    {
      "code": 6107,
      "name": "NotPendingAuthority",
      "msg": "Signer is not the pending authority"
    },
    {
      "code": 6108,
      "name": "MiningDisabled",
      "msg": "Mining is disabled by the on-chain config"
    },
    {
      "code": 6109,
      "name": "CollectorMintNotAllowed",
      "msg": "This NFT mint is not registered as a collector perk"
    },
    {
      "code": 6110,
      "name": "InvalidCapacityDelta",
      "msg": "Capacity delta is out of bounds"
    },
    {
      "code": 6111,
      "name": "StillActive",
      "msg": "Listing or auction is still active"
    },
    {
      "code": 6112,
      "name": "LotteryAlreadyDrawn",
      "msg": "Lottery round has already been drawn"
    },
    {
      "code": 6113,
      "name": "LotteryRoundNotExpired",
      "msg": "Lottery round refund timeout has not elapsed yet"
    },
    {
      "code": 6114,
      "name": "RandomnessDisabled",
      "msg": "Randomness-dependent instruction is disabled until a VRF is integrated"
    },
    {
      "code": 6115,
      "name": "EmptyCraftOrder",
      "msg": "Craft order must require at least one resource"
    },
    {
      "code": 6116,
      "name": "InvalidExplorationTier",
      "msg": "Exploration tier is out of range"
    }
  ],
  "types": [
    {
      "name": "Auction",
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
            "name": "min_bid",
            "type": "u64"
          },
          {
            "name": "current_bid",
            "type": "u64"
          },
          {
            "name": "current_bidder",
            "type": "pubkey"
          },
          {
            "name": "end_time",
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
      "name": "AuctionBid",
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
      "name": "AuctionCreated",
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
            "name": "min_bid",
            "type": "u64"
          },
          {
            "name": "end_time",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "AuctionSettled",
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
      "name": "CollectorKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Historian"
          },
          {
            "name": "Medallion"
          }
        ]
      }
    },
    {
      "name": "CollectorStaked",
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
                "name": "CollectorKind"
              }
            }
          },
          {
            "name": "unlock_at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "CollectorUnstaked",
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
                "name": "CollectorKind"
              }
            }
          }
        ]
      }
    },
    {
      "name": "Config",
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
            "name": "food_mint",
            "type": "pubkey"
          },
          {
            "name": "wood_mint",
            "type": "pubkey"
          },
          {
            "name": "stone_mint",
            "type": "pubkey"
          },
          {
            "name": "seeds_mint",
            "type": "pubkey"
          },
          {
            "name": "water_mint",
            "type": "pubkey"
          },
          {
            "name": "potato_mint",
            "type": "pubkey"
          },
          {
            "name": "craft_fee",
            "type": "u64"
          },
          {
            "name": "unstake_fee",
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
            "name": "mining_enabled",
            "type": "bool"
          },
          {
            "name": "pending_authority",
            "type": "pubkey"
          },
          {
            "name": "authority_updated_at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "CraftEconomy",
      "docs": [
        "\u041d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u043c\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b bonding-curve \u043a\u0440\u0430\u0444\u0442\u0430 (\u0431\u0430\u0437\u044b \u0438 \u043c\u043d\u043e\u0436\u0438\u0442\u0435\u043b\u0438 \u043f\u043e",
        "\u0440\u0435\u0434\u043a\u043e\u0441\u0442\u0438), \u043c\u0435\u043d\u044f\u044e\u0442\u0441\u044f \u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0435\u043c \u0447\u0435\u0440\u0435\u0437 set_craft_economy \u0431\u0435\u0437 \u0440\u0435\u0434\u0435\u043f\u043b\u043e\u044f."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wood_base",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "stone_base",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "food_base",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "seeds_base",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "water_base",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "potato_base",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "wood_mult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "stone_mult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "food_mult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "seeds_mult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "water_mult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "potato_mult",
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
      "name": "CraftEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tool_type",
            "type": "string"
          },
          {
            "name": "rarity",
            "type": "u8"
          },
          {
            "name": "wood_cost",
            "type": "u64"
          },
          {
            "name": "stone_cost",
            "type": "u64"
          },
          {
            "name": "food_cost",
            "type": "u64"
          },
          {
            "name": "seeds_cost",
            "type": "u64"
          },
          {
            "name": "water_cost",
            "type": "u64"
          },
          {
            "name": "potato_cost",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "CraftOrder",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "wood_needed",
            "type": "u64"
          },
          {
            "name": "stone_needed",
            "type": "u64"
          },
          {
            "name": "premium_lamports",
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
      "name": "CraftOrderFulfilled",
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
            "name": "premium_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "EnchantSlot",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tool_mint",
            "type": "pubkey"
          },
          {
            "name": "slot_type",
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
      "name": "EnergyAccount",
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
            "name": "last_regen_at",
            "type": "i64"
          },
          {
            "name": "cap",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "buff_expires_at",
            "type": "i64"
          },
          {
            "name": "buff_type",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ExplorationCommit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tool_mint",
            "type": "pubkey"
          },
          {
            "name": "commit_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "commit_slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ExplorationCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tool_mint",
            "type": "pubkey"
          },
          {
            "name": "success",
            "type": "bool"
          },
          {
            "name": "wood_reward",
            "type": "u64"
          },
          {
            "name": "stone_reward",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ExplorationState",
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
            "name": "last_trip_at",
            "type": "i64"
          },
          {
            "name": "trips_today",
            "type": "u8"
          },
          {
            "name": "day_start",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "FarmTile",
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
            "name": "planted_at",
            "type": "i64"
          },
          {
            "name": "ready_at",
            "type": "i64"
          },
          {
            "name": "seeds_amount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "buff_expires_at",
            "type": "i64"
          },
          {
            "name": "buff_type",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ForgeAttempted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tool_mint",
            "type": "pubkey"
          },
          {
            "name": "slot_type",
            "type": "u8"
          },
          {
            "name": "level_before",
            "type": "u8"
          },
          {
            "name": "level_after",
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
      "name": "ForgeCommit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tool_mint",
            "type": "pubkey"
          },
          {
            "name": "slot_type",
            "type": "u8"
          },
          {
            "name": "commit_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "commit_slot",
            "type": "u64"
          },
          {
            "name": "use_protector",
            "type": "bool"
          },
          {
            "name": "paid_lamports",
            "type": "u64"
          },
          {
            "name": "wood_burned",
            "type": "u64"
          },
          {
            "name": "stone_burned",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "GasFeesSwept",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "GasTank",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "balance_micros",
            "type": "u64"
          },
          {
            "name": "cooldown_until",
            "type": "i64"
          },
          {
            "name": "dust_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Listing",
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
            "name": "price_lamports",
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
      "name": "ListingCreated",
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
            "name": "price_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ListingSold",
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
            "name": "price_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "LotteryClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round_id",
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
      "name": "LotteryDrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round_id",
            "type": "u64"
          },
          {
            "name": "winning_ticket",
            "type": "u64"
          },
          {
            "name": "pool_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "LotteryRound",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round_id",
            "type": "u64"
          },
          {
            "name": "pool_lamports",
            "type": "u64"
          },
          {
            "name": "tickets_sold",
            "type": "u64"
          },
          {
            "name": "draw_slot",
            "type": "u64"
          },
          {
            "name": "drawn",
            "type": "bool"
          },
          {
            "name": "winning_ticket",
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
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "draw_committed",
            "type": "bool"
          },
          {
            "name": "draw_commit_slot",
            "type": "u64"
          },
          {
            "name": "draw_commit_hash",
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
      "name": "LotteryTicket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round_id",
            "type": "u64"
          },
          {
            "name": "ticket_number",
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
      "name": "LotteryTicketBought",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round_id",
            "type": "u64"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "ticket_number",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "MaterialMints",
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
            "name": "stone_blue",
            "type": "pubkey"
          },
          {
            "name": "stone_purple",
            "type": "pubkey"
          },
          {
            "name": "stone_red",
            "type": "pubkey"
          },
          {
            "name": "sand_white",
            "type": "pubkey"
          },
          {
            "name": "sand_pink",
            "type": "pubkey"
          },
          {
            "name": "sand_yellow",
            "type": "pubkey"
          },
          {
            "name": "gem_blue",
            "type": "pubkey"
          },
          {
            "name": "gem_orange",
            "type": "pubkey"
          },
          {
            "name": "gem_white",
            "type": "pubkey"
          },
          {
            "name": "gem_green",
            "type": "pubkey"
          },
          {
            "name": "flask_blue",
            "type": "pubkey"
          },
          {
            "name": "flask_yellow",
            "type": "pubkey"
          },
          {
            "name": "flask_green",
            "type": "pubkey"
          },
          {
            "name": "flask_pink",
            "type": "pubkey"
          },
          {
            "name": "flask_purple",
            "type": "pubkey"
          },
          {
            "name": "love_heart",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "max_supply",
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
      "name": "MillState",
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
            "name": "in_progress",
            "type": "bool"
          },
          {
            "name": "ready_at",
            "type": "i64"
          },
          {
            "name": "output_flour",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "buff_expires_at",
            "type": "i64"
          },
          {
            "name": "buff_type",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "MiningCollected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tool_mint",
            "type": "pubkey"
          },
          {
            "name": "resource_mint",
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
            "name": "durability_after",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Offer",
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
            "name": "price_lamports",
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
      "name": "OfferAccepted",
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
            "name": "price_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "OfferCreated",
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
            "name": "price_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "OrderMatched",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buy_order",
            "type": "pubkey"
          },
          {
            "name": "sell_order",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "price_lamports_per_unit",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "OrderPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "is_buy",
            "type": "bool"
          },
          {
            "name": "price_lamports_per_unit",
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
      "name": "OvenState",
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
            "name": "in_progress",
            "type": "bool"
          },
          {
            "name": "ready_at",
            "type": "i64"
          },
          {
            "name": "output_bread",
            "type": "u64"
          },
          {
            "name": "fuel_kind",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "buff_expires_at",
            "type": "i64"
          },
          {
            "name": "buff_type",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "PackCommit",
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
            "name": "pack_type",
            "type": "u8"
          },
          {
            "name": "commit_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "commit_slot",
            "type": "u64"
          },
          {
            "name": "revealed",
            "type": "bool"
          },
          {
            "name": "paid_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "PackConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pack_type",
            "type": "u8"
          },
          {
            "name": "price_lamports",
            "type": "u64"
          },
          {
            "name": "odds_bps",
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
          },
          {
            "name": "buff_expires_at",
            "type": "i64"
          },
          {
            "name": "buff_type",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "PackOpened",
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
            "name": "pack_type",
            "type": "u8"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "Rarity"
              }
            }
          },
          {
            "name": "tool_type",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "PackType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Small"
          },
          {
            "name": "Medium"
          },
          {
            "name": "Big"
          }
        ]
      }
    },
    {
      "name": "PaidOut",
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
            "name": "vault_balance_after",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Player",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "cooldown_until",
            "type": "i64"
          },
          {
            "name": "has_tent",
            "type": "bool"
          },
          {
            "name": "villagers",
            "type": "u32"
          },
          {
            "name": "villagers_available",
            "type": "u32"
          },
          {
            "name": "historian_count",
            "type": "u8"
          },
          {
            "name": "medallion_count",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Rarity",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Common"
          },
          {
            "name": "Uncommon"
          },
          {
            "name": "Rare"
          },
          {
            "name": "Epic"
          },
          {
            "name": "Legendary"
          }
        ]
      }
    },
    {
      "name": "RarityCounter",
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
            "name": "minted_count",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ReferralBound",
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
      "name": "ReferralLink",
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
            "name": "bound_at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ReferralPayout",
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
      "name": "ReferrerStats",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "referrer",
            "type": "pubkey"
          },
          {
            "name": "active_count",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "RentalAgreement",
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
            "name": "revoke_requested_at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "RentalEnded",
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
      "name": "RentalListing",
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
            "name": "owner_split_bps",
            "docs": [
              "[\u0424\u0418\u041a\u0421] \u0414\u043e\u043b\u044f \u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0430 \u043e\u0442 \u043f\u043b\u0430\u0442\u044b \u0437\u0430 \u0430\u0440\u0435\u043d\u0434\u0443 (0..=10000 bps), \u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u0432 start_handler"
            ],
            "type": "u16"
          },
          {
            "name": "min_duration",
            "type": "i64"
          },
          {
            "name": "max_duration",
            "type": "i64"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "price_per_hour_lamports",
            "docs": [
              "[\u0424\u0418\u041a\u0421] \u0426\u0435\u043d\u0430 \u0430\u0440\u0435\u043d\u0434\u044b \u0437\u0430 \u0447\u0430\u0441 \u0432 lamports (\u0440\u0430\u043d\u044c\u0448\u0435 \u0430\u0440\u0435\u043d\u0434\u0430 \u0431\u044b\u043b\u0430 \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e\u0439)"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "RentalStarted",
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
            "name": "end_time",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "RerollCommit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "burn_mint",
            "type": "pubkey"
          },
          {
            "name": "new_mint",
            "type": "pubkey"
          },
          {
            "name": "commit_hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "commit_slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "RerollConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "odds_bps",
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
          },
          {
            "name": "buff_expires_at",
            "type": "i64"
          },
          {
            "name": "buff_type",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "RerollResult",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "burned_mint",
            "type": "pubkey"
          },
          {
            "name": "new_mint",
            "type": "pubkey"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "Rarity"
              }
            }
          },
          {
            "name": "tool_type",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "ResourceKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Food"
          },
          {
            "name": "Wood"
          },
          {
            "name": "Stone"
          },
          {
            "name": "Seeds"
          },
          {
            "name": "Wheat"
          },
          {
            "name": "Flour"
          },
          {
            "name": "Bread"
          },
          {
            "name": "Water"
          },
          {
            "name": "Coal"
          },
          {
            "name": "Meat"
          },
          {
            "name": "StoneBlue"
          },
          {
            "name": "StonePurple"
          },
          {
            "name": "StoneRed"
          },
          {
            "name": "SandWhite"
          },
          {
            "name": "SandPink"
          },
          {
            "name": "SandYellow"
          },
          {
            "name": "GemBlue"
          },
          {
            "name": "GemOrange"
          },
          {
            "name": "GemWhite"
          },
          {
            "name": "GemGreen"
          },
          {
            "name": "FlaskBlue"
          },
          {
            "name": "FlaskYellow"
          },
          {
            "name": "FlaskGreen"
          },
          {
            "name": "FlaskPink"
          },
          {
            "name": "FlaskPurple"
          },
          {
            "name": "LoveHeart"
          },
          {
            "name": "Potato"
          }
        ]
      }
    },
    {
      "name": "ResourceOrder",
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
            "name": "is_buy",
            "type": "bool"
          },
          {
            "name": "price_lamports_per_unit",
            "type": "u64"
          },
          {
            "name": "amount_remaining",
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
      "name": "Season",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "season_id",
            "type": "u32"
          },
          {
            "name": "start_time",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "buff_expires_at",
            "type": "i64"
          },
          {
            "name": "buff_type",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "SeasonPass",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "season_id",
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
            "name": "claimed_bitmap",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "SeasonPassPurchased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "season_id",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "SeasonRewardClaimed",
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
      "name": "Staked",
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
      "name": "StakedCollector",
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
                "name": "CollectorKind"
              }
            }
          },
          {
            "name": "unlock_at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ToolBurned",
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
      "name": "ToolCrafted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "burned_mint",
            "type": "pubkey"
          },
          {
            "name": "minted_mint",
            "type": "pubkey"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "Rarity"
              }
            }
          },
          {
            "name": "wood_cost",
            "type": "u64"
          },
          {
            "name": "stone_cost",
            "type": "u64"
          },
          {
            "name": "minted_count_after",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ToolData",
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
            "name": "tool_type",
            "type": "string"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "Rarity"
              }
            }
          },
          {
            "name": "durability",
            "type": "u8"
          },
          {
            "name": "is_mining",
            "type": "bool"
          },
          {
            "name": "mining_end",
            "type": "i64"
          },
          {
            "name": "last_mined_hours",
            "type": "u8"
          },
          {
            "name": "staked",
            "type": "bool"
          },
          {
            "name": "unlock_at",
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
      "name": "ToolMinted",
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
            "name": "tool_type",
            "type": "string"
          },
          {
            "name": "rarity",
            "type": {
              "defined": {
                "name": "Rarity"
              }
            }
          }
        ]
      }
    },
    {
      "name": "ToolRepaired",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tool_mint",
            "type": "pubkey"
          },
          {
            "name": "repaired_amount",
            "type": "u8"
          },
          {
            "name": "stone_cost",
            "type": "u64"
          },
          {
            "name": "wood_cost",
            "type": "u64"
          },
          {
            "name": "new_durability",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Unstaked",
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
      "name": "WeatherState",
      "docs": [
        "WeatherState \u2014 \u0433\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u0430\u044f \u043f\u043e\u0433\u043e\u0434\u0430 (\u043e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u0442\u0441\u044f permissionless-\u043a\u0440\u0430\u043d\u043a\u043e\u043c \u0440\u0430\u0437 \u0432 \u0441\u0443\u0442\u043a\u0438)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "day_id",
            "type": "u32"
          },
          {
            "name": "weather",
            "type": "u8"
          },
          {
            "name": "updated_at",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "buff_expires_at",
            "type": "i64"
          },
          {
            "name": "buff_type",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "WellState",
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
            "name": "water_buffer",
            "type": "u64"
          },
          {
            "name": "last_collected_at",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "buff_expires_at",
            "type": "i64"
          },
          {
            "name": "buff_type",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "PackCommitExpired",
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
            "name": "pack_type",
            "type": "u8"
          },
          {
            "name": "refunded_lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "ForgeCommitExpired",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tool_mint",
            "type": "pubkey"
          },
          {
            "name": "slot_type",
            "type": "u8"
          },
          {
            "name": "refunded_lamports",
            "type": "u64"
          },
          {
            "name": "wood_refunded",
            "type": "u64"
          },
          {
            "name": "stone_refunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "RewardReceipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "reward_id",
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
            "name": "gross_amount",
            "type": "u64"
          },
          {
            "name": "claimed_slot",
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
      "name": "IssuanceCap",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "epoch_slots",
            "type": "u64"
          },
          {
            "name": "cap_per_epoch",
            "type": "u64"
          },
          {
            "name": "epoch_start_slot",
            "type": "u64"
          },
          {
            "name": "minted_in_epoch",
            "type": "u64"
          },
          {
            "name": "lifetime_minted",
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
      "name": "ResourceIssued",
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
            "name": "minted_in_epoch",
            "type": "u64"
          },
          {
            "name": "cap_per_epoch",
            "type": "u64"
          },
          {
            "name": "epoch_start_slot",
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
      "name": "IssuanceCapChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "epoch_slots",
            "type": "u64"
          },
          {
            "name": "cap_per_epoch",
            "type": "u64"
          },
          {
            "name": "minted_in_epoch",
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
      "name": "PausedToggled",
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
      "name": "FeesUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "craft_fee",
            "type": "u64"
          },
          {
            "name": "unstake_fee",
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
      "name": "ResourceMintsUpdated",
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
      "name": "CraftEconomyUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wood_base",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "stone_base",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "wood_mult",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "stone_mult",
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
      "name": "VaultGuard",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "epoch_slots",
            "type": "u64"
          },
          {
            "name": "cap_per_epoch",
            "type": "u64"
          },
          {
            "name": "max_per_tx",
            "type": "u64"
          },
          {
            "name": "epoch_start_slot",
            "type": "u64"
          },
          {
            "name": "withdrawn_in_epoch",
            "type": "u64"
          },
          {
            "name": "lifetime_withdrawn",
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
      "name": "CollectorAllowEntry",
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
                "name": "CollectorKind"
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
      "name": "LotteryTicketCounter",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "round_id",
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
      "name": "VaultWithdrawal",
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
            "name": "withdrawn_in_epoch",
            "type": "u64"
          },
          {
            "name": "cap_per_epoch",
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
      "name": "VaultGuardChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "epoch_slots",
            "type": "u64"
          },
          {
            "name": "cap_per_epoch",
            "type": "u64"
          },
          {
            "name": "max_per_tx",
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
      "name": "AuthorityRotationProposed",
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
      "name": "AuthorityChanged",
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
      "name": "MiningToggled",
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
      "name": "SupplyCapChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "max_supply",
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
      "name": "CollectorMintRegistered",
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
      "name": "PlayerCapacityChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "previous_villagers",
            "type": "u32"
          },
          {
            "name": "next_villagers",
            "type": "u32"
          },
          {
            "name": "delta",
            "type": "i32"
          },
          {
            "name": "has_tent",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "LotteryRoundRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round_id",
            "type": "u64"
          },
          {
            "name": "lamports",
            "type": "u64"
          },
          {
            "name": "tickets_sold",
            "type": "u64"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
