// AUTO-SAMPLED real rounds from the simulated math engine:
// math-sdk/games/0_0_theme_park/library/books/books_<MODE>.jsonl
// Regenerate with scratchpad/sample_books.py + emit_ts.py. Do not edit by hand.
// These literals are typed against the frontend BookEvent union — a type error
// here means math/frontend contract drift.
import type { StoryBook } from './helpers';
import { makeDuckPool } from './duckPools';

const books: StoryBook[] = [
	// duck_mid — sampled from books_DUCK.jsonl (id 0, payout 10420 cents, criteria 'duck')
	{
 "id": 0,
 "payoutMultiplier": 10420,
 "events": [
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "H3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "L1"
     }
    ],
    [
     {
      "name": "H5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "H3"
     },
     {
      "name": "S_DUCK",
      "scatter": true
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "S_DUCK",
      "scatter": true
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "S_DUCK",
      "scatter": true
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    1
   ],
   "gameType": "basegame",
   "index": 0
  },
  {
   "type": "winInfo",
   "totalWin": 20,
   "wins": [
    {
     "symbol": "L5",
     "kind": 3,
     "win": 10,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 9,
      "multiplier": 1,
      "winWithoutMult": 10,
      "lineMultiplier": 1
     }
    },
    {
     "symbol": "L5",
     "kind": 3,
     "win": 10,
     "positions": [
      {
       "reel": 0,
       "row": 0
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 11,
      "multiplier": 1,
      "winWithoutMult": 10,
      "lineMultiplier": 1
     }
    }
   ],
   "index": 1
  },
  {
   "type": "setTotalWin",
   "amount": 20,
   "index": 2
  },
  {
   "type": "duckPickStart",
   "totalPicks": 10,
   "pool": makeDuckPool([
    { "kind": "mult", "value": 2 },
    { "kind": "mult", "value": 3 },
    { "kind": "mult", "value": 2 },
    { "kind": "mult", "value": 5 },
    { "kind": "mult", "value": 10 },
    { "kind": "mult", "value": 2 },
    { "kind": "multmult", "value": 2 },
    { "kind": "mult", "value": 2 },
    { "kind": "mult", "value": 2 },
    { "kind": "multmult", "value": 2 }
   ]),
   "index": 3
  },
  {
   "type": "duckPick",
   "pickIndex": 0,
   "kind": "mult",
   "value": 2,
   "runningTotal": 200,
   "index": 4
  },
  {
   "type": "duckPick",
   "pickIndex": 1,
   "kind": "mult",
   "value": 3,
   "runningTotal": 500,
   "index": 5
  },
  {
   "type": "duckPick",
   "pickIndex": 2,
   "kind": "mult",
   "value": 2,
   "runningTotal": 700,
   "index": 6
  },
  {
   "type": "duckPick",
   "pickIndex": 3,
   "kind": "mult",
   "value": 5,
   "runningTotal": 1200,
   "index": 7
  },
  {
   "type": "duckPick",
   "pickIndex": 4,
   "kind": "mult",
   "value": 10,
   "runningTotal": 2200,
   "index": 8
  },
  {
   "type": "duckPick",
   "pickIndex": 5,
   "kind": "mult",
   "value": 2,
   "runningTotal": 2400,
   "index": 9
  },
  {
   "type": "duckPick",
   "pickIndex": 6,
   "kind": "multmult",
   "value": 2,
   "runningTotal": 4800,
   "index": 10
  },
  {
   "type": "duckPick",
   "pickIndex": 7,
   "kind": "mult",
   "value": 2,
   "runningTotal": 5000,
   "index": 11
  },
  {
   "type": "duckPick",
   "pickIndex": 8,
   "kind": "mult",
   "value": 2,
   "runningTotal": 5200,
   "index": 12
  },
  {
   "type": "duckPick",
   "pickIndex": 9,
   "kind": "multmult",
   "value": 2,
   "runningTotal": 10400,
   "index": 13
  },
  {
   "type": "duckPickEnd",
   "amount": 10400,
   "index": 14
  },
  {
   "type": "setTotalWin",
   "amount": 10420,
   "index": 15
  },
  {
   "type": "setWin",
   "amount": 10420,
   "winLevel": 8,
   "index": 16
  },
  {
   "type": "finalWin",
   "amount": 10420,
   "index": 17
  }
 ],
 "criteria": "duck",
 "baseGameWins": 0.2,
 "freeGameWins": 104.0
},
	// duck_large — sampled from books_DUCK.jsonl (id 212, payout 103500 cents, criteria 'duck')
	{
 "id": 212,
 "payoutMultiplier": 103500,
 "events": [
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "S_DUCK",
      "scatter": true
     },
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L1"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "L5"
     },
     {
      "name": "H2"
     },
     {
      "name": "L5"
     },
     {
      "name": "S_DUCK",
      "scatter": true
     },
     {
      "name": "L3"
     },
     {
      "name": "L2"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "H2"
     },
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "S_DUCK",
      "scatter": true
     },
     {
      "name": "L4"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    1,
    2
   ],
   "gameType": "basegame",
   "index": 0
  },
  {
   "type": "setTotalWin",
   "amount": 0,
   "index": 1
  },
  {
   "type": "duckPickStart",
   "totalPicks": 10,
   "pool": makeDuckPool([
    { "kind": "mult", "value": 3 },
    { "kind": "mult", "value": 3 },
    { "kind": "mult", "value": 2 },
    { "kind": "mult", "value": 3 },
    { "kind": "mult", "value": 500 },
    { "kind": "multmult", "value": 2 },
    { "kind": "mult", "value": 3 },
    { "kind": "mult", "value": 2 },
    { "kind": "mult", "value": 5 },
    { "kind": "mult", "value": 3 }
   ]),
   "index": 2
  },
  {
   "type": "duckPick",
   "pickIndex": 0,
   "kind": "mult",
   "value": 3,
   "runningTotal": 300,
   "index": 3
  },
  {
   "type": "duckPick",
   "pickIndex": 1,
   "kind": "mult",
   "value": 3,
   "runningTotal": 600,
   "index": 4
  },
  {
   "type": "duckPick",
   "pickIndex": 2,
   "kind": "mult",
   "value": 2,
   "runningTotal": 800,
   "index": 5
  },
  {
   "type": "duckPick",
   "pickIndex": 3,
   "kind": "mult",
   "value": 3,
   "runningTotal": 1100,
   "index": 6
  },
  {
   "type": "duckPick",
   "pickIndex": 4,
   "kind": "mult",
   "value": 500,
   "runningTotal": 51100,
   "index": 7
  },
  {
   "type": "duckPick",
   "pickIndex": 5,
   "kind": "multmult",
   "value": 2,
   "runningTotal": 102200,
   "index": 8
  },
  {
   "type": "duckPick",
   "pickIndex": 6,
   "kind": "mult",
   "value": 3,
   "runningTotal": 102500,
   "index": 9
  },
  {
   "type": "duckPick",
   "pickIndex": 7,
   "kind": "mult",
   "value": 2,
   "runningTotal": 102700,
   "index": 10
  },
  {
   "type": "duckPick",
   "pickIndex": 8,
   "kind": "mult",
   "value": 5,
   "runningTotal": 103200,
   "index": 11
  },
  {
   "type": "duckPick",
   "pickIndex": 9,
   "kind": "mult",
   "value": 3,
   "runningTotal": 103500,
   "index": 12
  },
  {
   "type": "duckPickEnd",
   "amount": 103500,
   "index": 13
  },
  {
   "type": "setTotalWin",
   "amount": 103500,
   "index": 14
  },
  {
   "type": "setWin",
   "amount": 103500,
   "winLevel": 10,
   "index": 15
  },
  {
   "type": "finalWin",
   "amount": 103500,
   "index": 16
  }
 ],
 "criteria": "duck",
 "baseGameWins": 0.0,
 "freeGameWins": 1035.0
},
	// roller_mid — sampled from books_ROLLER.jsonl (id 5, payout 2700 cents, criteria 'roller')
	{
 "id": 5,
 "payoutMultiplier": 2700,
 "events": [
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L5"
     },
     {
      "name": "L2"
     },
     {
      "name": "L1"
     },
     {
      "name": "L5"
     },
     {
      "name": "H1"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L1"
     },
     {
      "name": "H5"
     },
     {
      "name": "S_ROLLER",
      "scatter": true
     },
     {
      "name": "L4"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "S_ROLLER",
      "scatter": true
     },
     {
      "name": "H4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "L2"
     },
     {
      "name": "S_ROLLER",
      "scatter": true
     },
     {
      "name": "L3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L1"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    1,
    2
   ],
   "gameType": "basegame",
   "index": 0
  },
  {
   "type": "setTotalWin",
   "amount": 0,
   "index": 1
  },
  {
   "type": "freeSpinTrigger",
   "totalFs": 10,
   "positions": [
    {
     "reel": 1,
     "row": 2
    },
    {
     "reel": 2,
     "row": 2
    },
    {
     "reel": 3,
     "row": 0
    }
   ],
   "bonusType": "roller",
   "index": 2
  },
  {
   "type": "updateFreeSpin",
   "amount": 0,
   "total": 10,
   "index": 3
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L4"
     },
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "L5"
     },
     {
      "name": "H4"
     },
     {
      "name": "H2"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "H3"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H2"
     },
     {
      "name": "L5"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L2"
     }
    ],
    [
     {
      "name": "H2"
     },
     {
      "name": "L4"
     },
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "H5"
     },
     {
      "name": "L5"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 4
  },
  {
   "type": "winInfo",
   "totalWin": 20,
   "wins": [
    {
     "symbol": "L5",
     "kind": 3,
     "win": 10,
     "positions": [
      {
       "reel": 0,
       "row": 3
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 3
      }
     ],
     "meta": {
      "lineIndex": 3,
      "multiplier": 1,
      "winWithoutMult": 10,
      "lineMultiplier": 1
     }
    },
    {
     "symbol": "L5",
     "kind": 3,
     "win": 10,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 10,
      "multiplier": 1,
      "winWithoutMult": 10,
      "lineMultiplier": 1
     }
    }
   ],
   "index": 5
  },
  {
   "type": "setTotalWin",
   "amount": 20,
   "index": 6
  },
  {
   "type": "updateFreeSpin",
   "amount": 1,
   "total": 10,
   "index": 7
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L2"
     },
     {
      "name": "L4"
     },
     {
      "name": "L1"
     },
     {
      "name": "L3"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "L5"
     },
     {
      "name": "L2"
     },
     {
      "name": "L3"
     },
     {
      "name": "L2"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "L2"
     },
     {
      "name": "L4"
     },
     {
      "name": "L3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 8
  },
  {
   "type": "updateFreeSpin",
   "amount": 2,
   "total": 10,
   "index": 9
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "H5"
     },
     {
      "name": "L1"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "L4"
     },
     {
      "name": "H2"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "H5"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L2"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L1"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 10
  },
  {
   "type": "rollerWildsApply",
   "reels": [
    {
     "reel": 3,
     "multiplier": 3
    }
   ],
   "index": 11
  },
  {
   "type": "updateFreeSpin",
   "amount": 3,
   "total": 10,
   "index": 12
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "H2"
     },
     {
      "name": "H4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "H2"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L2"
     },
     {
      "name": "L4"
     },
     {
      "name": "H2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L5"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 13
  },
  {
   "type": "rollerWildsApply",
   "reels": [
    {
     "reel": 1,
     "multiplier": 5
    }
   ],
   "index": 14
  },
  {
   "type": "winInfo",
   "totalWin": 100,
   "wins": [
    {
     "symbol": "L4",
     "kind": 3,
     "win": 50,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 2
      }
     ],
     "meta": {
      "lineIndex": 6,
      "multiplier": 5,
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "L5",
     "kind": 3,
     "win": 50,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 9,
      "multiplier": 5,
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    }
   ],
   "index": 15
  },
  {
   "type": "setTotalWin",
   "amount": 120,
   "index": 16
  },
  {
   "type": "updateFreeSpin",
   "amount": 4,
   "total": 10,
   "index": 17
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L4"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "L2"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "L5"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "L5"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 18
  },
  {
   "type": "rollerWildsApply",
   "reels": [
    {
     "reel": 0,
     "multiplier": 2
    },
    {
     "reel": 2,
     "multiplier": 3
    },
    {
     "reel": 4,
     "multiplier": 2
    }
   ],
   "index": 19
  },
  {
   "type": "winInfo",
   "totalWin": 2550,
   "wins": [
    {
     "symbol": "L1",
     "kind": 3,
     "win": 50,
     "positions": [
      {
       "reel": 0,
       "row": 0
      },
      {
       "reel": 1,
       "row": 0
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 0,
      "multiplier": 5,
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "L1",
     "kind": 3,
     "win": 50,
     "positions": [
      {
       "reel": 0,
       "row": 1
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 1
      }
     ],
     "meta": {
      "lineIndex": 1,
      "multiplier": 5,
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H5",
     "kind": 3,
     "win": 250,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 2
      }
     ],
     "meta": {
      "lineIndex": 2,
      "multiplier": 5,
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H5",
     "kind": 3,
     "win": 250,
     "positions": [
      {
       "reel": 0,
       "row": 3
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 3
      }
     ],
     "meta": {
      "lineIndex": 3,
      "multiplier": 5,
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "L5",
     "kind": 3,
     "win": 50,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 4
      },
      {
       "reel": 2,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 4,
      "multiplier": 5,
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "L1",
     "kind": 3,
     "win": 50,
     "positions": [
      {
       "reel": 0,
       "row": 0
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 2
      }
     ],
     "meta": {
      "lineIndex": 5,
      "multiplier": 5,
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H5",
     "kind": 3,
     "win": 250,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 2
      }
     ],
     "meta": {
      "lineIndex": 6,
      "multiplier": 5,
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H5",
     "kind": 3,
     "win": 250,
     "positions": [
      {
       "reel": 0,
       "row": 1
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 3
      }
     ],
     "meta": {
      "lineIndex": 7,
      "multiplier": 5,
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H5",
     "kind": 3,
     "win": 250,
     "positions": [
      {
       "reel": 0,
       "row": 3
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 1
      }
     ],
     "meta": {
      "lineIndex": 8,
      "multiplier": 5,
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "L1",
     "kind": 3,
     "win": 50,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 9,
      "multiplier": 5,
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H5",
     "kind": 3,
     "win": 250,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 10,
      "multiplier": 5,
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "L1",
     "kind": 3,
     "win": 50,
     "positions": [
      {
       "reel": 0,
       "row": 0
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 11,
      "multiplier": 5,
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H5",
     "kind": 3,
     "win": 250,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 12,
      "multiplier": 5,
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H5",
     "kind": 3,
     "win": 250,
     "positions": [
      {
       "reel": 0,
       "row": 1
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 1
      }
     ],
     "meta": {
      "lineIndex": 13,
      "multiplier": 5,
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H5",
     "kind": 3,
     "win": 250,
     "positions": [
      {
       "reel": 0,
       "row": 3
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 3
      }
     ],
     "meta": {
      "lineIndex": 14,
      "multiplier": 5,
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    }
   ],
   "index": 20
  },
  {
   "type": "setTotalWin",
   "amount": 2670,
   "index": 21
  },
  {
   "type": "updateFreeSpin",
   "amount": 5,
   "total": 10,
   "index": 22
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "H1"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "L1"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "H5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     }
    ],
    [
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L2"
     },
     {
      "name": "H4"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 23
  },
  {
   "type": "updateFreeSpin",
   "amount": 6,
   "total": 10,
   "index": 24
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "H2"
     },
     {
      "name": "L5"
     },
     {
      "name": "H3"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L1"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "H2"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 25
  },
  {
   "type": "winInfo",
   "totalWin": 10,
   "wins": [
    {
     "symbol": "L4",
     "kind": 3,
     "win": 10,
     "positions": [
      {
       "reel": 0,
       "row": 1
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 3
      }
     ],
     "meta": {
      "lineIndex": 7,
      "multiplier": 1,
      "winWithoutMult": 10,
      "lineMultiplier": 1
     }
    }
   ],
   "index": 26
  },
  {
   "type": "setTotalWin",
   "amount": 2680,
   "index": 27
  },
  {
   "type": "updateFreeSpin",
   "amount": 7,
   "total": 10,
   "index": 28
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "H3"
     },
     {
      "name": "H2"
     },
     {
      "name": "H4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "H4"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L2"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L1"
     },
     {
      "name": "L3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "L2"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L1"
     },
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 29
  },
  {
   "type": "winInfo",
   "totalWin": 20,
   "wins": [
    {
     "symbol": "L5",
     "kind": 3,
     "win": 10,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 4
      },
      {
       "reel": 2,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 4,
      "multiplier": 1,
      "winWithoutMult": 10,
      "lineMultiplier": 1
     }
    },
    {
     "symbol": "L5",
     "kind": 3,
     "win": 10,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 12,
      "multiplier": 1,
      "winWithoutMult": 10,
      "lineMultiplier": 1
     }
    }
   ],
   "index": 30
  },
  {
   "type": "setTotalWin",
   "amount": 2700,
   "index": 31
  },
  {
   "type": "updateFreeSpin",
   "amount": 8,
   "total": 10,
   "index": 32
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L3"
     },
     {
      "name": "L2"
     },
     {
      "name": "H5"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "L4"
     },
     {
      "name": "L1"
     },
     {
      "name": "H4"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L4"
     },
     {
      "name": "L3"
     },
     {
      "name": "H1"
     },
     {
      "name": "L4"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 33
  },
  {
   "type": "updateFreeSpin",
   "amount": 9,
   "total": 10,
   "index": 34
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L3"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "H1"
     },
     {
      "name": "H4"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "H5"
     },
     {
      "name": "L4"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     }
    ],
    [
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     },
     {
      "name": "H5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 35
  },
  {
   "type": "freeSpinEnd",
   "amount": 2700,
   "winLevel": 6,
   "index": 36
  },
  {
   "type": "setWin",
   "amount": 2700,
   "winLevel": 6,
   "index": 37
  },
  {
   "type": "finalWin",
   "amount": 2700,
   "index": 38
  }
 ],
 "criteria": "roller",
 "baseGameWins": 0.0,
 "freeGameWins": 27.0
},
	// coaster_mid — sampled from books_COASTER.jsonl (id 0, payout 4540 cents, criteria 'coaster')
	{
 "id": 0,
 "payoutMultiplier": 4540,
 "events": [
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "H3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "L1"
     }
    ],
    [
     {
      "name": "H5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "H3"
     },
     {
      "name": "S_COASTER",
      "scatter": true
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "S_COASTER",
      "scatter": true
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "S_COASTER",
      "scatter": true
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L4"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    1
   ],
   "gameType": "basegame",
   "index": 0
  },
  {
   "type": "winInfo",
   "totalWin": 20,
   "wins": [
    {
     "symbol": "L5",
     "kind": 3,
     "win": 10,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 9,
      "multiplier": 1,
      "winWithoutMult": 10,
      "lineMultiplier": 1
     }
    },
    {
     "symbol": "L5",
     "kind": 3,
     "win": 10,
     "positions": [
      {
       "reel": 0,
       "row": 0
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 11,
      "multiplier": 1,
      "winWithoutMult": 10,
      "lineMultiplier": 1
     }
    }
   ],
   "index": 1
  },
  {
   "type": "setTotalWin",
   "amount": 20,
   "index": 2
  },
  {
   "type": "freeSpinTrigger",
   "totalFs": 10,
   "positions": [
    {
     "reel": 2,
     "row": 3
    },
    {
     "reel": 3,
     "row": 1
    },
    {
     "reel": 4,
     "row": 0
    }
   ],
   "bonusType": "coaster",
   "index": 3
  },
  {
   "type": "coasterSetup",
   "pukes": [
    {
     "reel": 3,
     "row": 3,
     "multiplier": 2
    },
    {
     "reel": 4,
     "row": 0,
     "multiplier": 2
    },
    {
     "reel": 3,
     "row": 2,
     "multiplier": 2
    },
    {
     "reel": 1,
     "row": 4,
     "multiplier": 2
    },
    {
     "reel": 0,
     "row": 2,
     "multiplier": 2
    }
   ],
   "tiles": [
    {
     "reel": 0,
     "row": 2,
     "multiplier": 2
    },
    {
     "reel": 1,
     "row": 4,
     "multiplier": 2
    },
    {
     "reel": 3,
     "row": 2,
     "multiplier": 2
    },
    {
     "reel": 3,
     "row": 3,
     "multiplier": 2
    },
    {
     "reel": 4,
     "row": 0,
     "multiplier": 2
    }
   ],
   "index": 4
  },
  {
   "type": "updateFreeSpin",
   "amount": 0,
   "total": 10,
   "index": 5
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L1"
     },
     {
      "name": "L2"
     },
     {
      "name": "H5"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H1"
     },
     {
      "name": "H5"
     },
     {
      "name": "H2"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L1"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "H2"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L5"
     },
     {
      "name": "H1"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "H2"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 6
  },
  {
   "type": "updateFreeSpin",
   "amount": 1,
   "total": 10,
   "index": 7
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "H1"
     },
     {
      "name": "L3"
     },
     {
      "name": "H2"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H1"
     },
     {
      "name": "L5"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "H4"
     },
     {
      "name": "H1"
     },
     {
      "name": "H2"
     },
     {
      "name": "L4"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "H3"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L3"
     },
     {
      "name": "H2"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L2"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "L5"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 8
  },
  {
   "type": "winInfo",
   "totalWin": 20,
   "wins": [
    {
     "symbol": "L5",
     "kind": 3,
     "win": 20,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 4
      },
      {
       "reel": 2,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 4,
      "multiplier": 2,
      "winWithoutMult": 10,
      "lineMultiplier": 2
     }
    }
   ],
   "index": 9
  },
  {
   "type": "setTotalWin",
   "amount": 40,
   "index": 10
  },
  {
   "type": "updateFreeSpin",
   "amount": 2,
   "total": 10,
   "index": 11
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L1"
     },
     {
      "name": "H3"
     },
     {
      "name": "H1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L4"
     },
     {
      "name": "H5"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "H2"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L3"
     },
     {
      "name": "H2"
     },
     {
      "name": "H5"
     },
     {
      "name": "H1"
     },
     {
      "name": "H5"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "L3"
     },
     {
      "name": "H2"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 12
  },
  {
   "type": "winInfo",
   "totalWin": 4000,
   "wins": [
    {
     "symbol": "H1",
     "kind": 4,
     "win": 4000,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 4
      },
      {
       "reel": 3,
       "row": 3
      }
     ],
     "meta": {
      "lineIndex": 10,
      "multiplier": 4,
      "winWithoutMult": 1000,
      "lineMultiplier": 4
     }
    }
   ],
   "index": 13
  },
  {
   "type": "setTotalWin",
   "amount": 4040,
   "index": 14
  },
  {
   "type": "updateFreeSpin",
   "amount": 3,
   "total": 10,
   "index": 15
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "H2"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "L5"
     },
     {
      "name": "H3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "L1"
     },
     {
      "name": "H5"
     },
     {
      "name": "L4"
     },
     {
      "name": "H5"
     },
     {
      "name": "H2"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L2"
     },
     {
      "name": "L1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H5"
     },
     {
      "name": "H1"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L3"
     },
     {
      "name": "L1"
     },
     {
      "name": "H3"
     },
     {
      "name": "L5"
     },
     {
      "name": "H2"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 16
  },
  {
   "type": "winInfo",
   "totalWin": 400,
   "wins": [
    {
     "symbol": "H1",
     "kind": 3,
     "win": 400,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 9,
      "multiplier": 2,
      "winWithoutMult": 200,
      "lineMultiplier": 2
     }
    }
   ],
   "index": 17
  },
  {
   "type": "setTotalWin",
   "amount": 4440,
   "index": 18
  },
  {
   "type": "updateFreeSpin",
   "amount": 4,
   "total": 10,
   "index": 19
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "H3"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H3"
     },
     {
      "name": "H1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L1"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "H4"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     }
    ],
    [
     {
      "name": "H5"
     },
     {
      "name": "L1"
     },
     {
      "name": "L5"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H3"
     },
     {
      "name": "H1"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H4"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "H4"
     },
     {
      "name": "H2"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 20
  },
  {
   "type": "updateFreeSpin",
   "amount": 5,
   "total": 10,
   "index": 21
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "H5"
     },
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H5"
     },
     {
      "name": "H1"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "L4"
     },
     {
      "name": "H4"
     },
     {
      "name": "L2"
     },
     {
      "name": "H2"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "L4"
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "H2"
     },
     {
      "name": "L2"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H3"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H2"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H5"
     },
     {
      "name": "H1"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 22
  },
  {
   "type": "updateFreeSpin",
   "amount": 6,
   "total": 10,
   "index": 23
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "H4"
     },
     {
      "name": "H5"
     },
     {
      "name": "H1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "L4"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "H1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "H3"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L3"
     },
     {
      "name": "H2"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "H1"
     },
     {
      "name": "L4"
     },
     {
      "name": "L3"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 24
  },
  {
   "type": "updateFreeSpin",
   "amount": 7,
   "total": 10,
   "index": 25
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "H4"
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H2"
     },
     {
      "name": "H3"
     },
     {
      "name": "H1"
     }
    ],
    [
     {
      "name": "H5"
     },
     {
      "name": "H5"
     },
     {
      "name": "L4"
     },
     {
      "name": "H3"
     },
     {
      "name": "H5"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H5"
     }
    ],
    [
     {
      "name": "H2"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     }
    ],
    [
     {
      "name": "L2"
     },
     {
      "name": "L2"
     },
     {
      "name": "H3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L2"
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H2"
     },
     {
      "name": "H2"
     },
     {
      "name": "H1"
     },
     {
      "name": "L4"
     },
     {
      "name": "L3"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 26
  },
  {
   "type": "updateFreeSpin",
   "amount": 8,
   "total": 10,
   "index": 27
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L2"
     },
     {
      "name": "L4"
     },
     {
      "name": "H1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "H3"
     },
     {
      "name": "H1"
     },
     {
      "name": "H4"
     },
     {
      "name": "L1"
     },
     {
      "name": "H5"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H3"
     }
    ],
    [
     {
      "name": "L2"
     },
     {
      "name": "H4"
     },
     {
      "name": "H2"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "L4"
     },
     {
      "name": "L3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L4"
     },
     {
      "name": "L4"
     }
    ],
    [
     {
      "name": "H5"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H1"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     },
     {
      "name": "L3"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 28
  },
  {
   "type": "winInfo",
   "totalWin": 100,
   "wins": [
    {
     "symbol": "H4",
     "kind": 3,
     "win": 100,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 9,
      "multiplier": 2,
      "winWithoutMult": 50,
      "lineMultiplier": 2
     }
    }
   ],
   "index": 29
  },
  {
   "type": "setTotalWin",
   "amount": 4540,
   "index": 30
  },
  {
   "type": "updateFreeSpin",
   "amount": 9,
   "total": 10,
   "index": 31
  },
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L4"
     },
     {
      "name": "H3"
     },
     {
      "name": "H2"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H2"
     },
     {
      "name": "L3"
     },
     {
      "name": "L2"
     }
    ],
    [
     {
      "name": "L5"
     },
     {
      "name": "L5"
     },
     {
      "name": "L3"
     },
     {
      "name": "H3"
     },
     {
      "name": "L3"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "H4"
     },
     {
      "name": "H4"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
     },
     {
      "name": "H4"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "H3"
     },
     {
      "name": "H5"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "H1"
     },
     {
      "name": "H5"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2,
      "persistent": true
     },
     {
      "name": "L1"
     },
     {
      "name": "L1"
     },
     {
      "name": "H2"
     },
     {
      "name": "H4"
     },
     {
      "name": "L1"
     }
    ]
   ],
   "paddingPositions": [
    2,
    4,
    6,
    8,
    10
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "freegame",
   "index": 32
  },
  {
   "type": "freeSpinEnd",
   "amount": 4540,
   "winLevel": 6,
   "index": 33
  },
  {
   "type": "setWin",
   "amount": 4540,
   "winLevel": 6,
   "index": 34
  },
  {
   "type": "finalWin",
   "amount": 4540,
   "index": 35
  }
 ],
 "criteria": "coaster",
 "baseGameWins": 0.2,
 "freeGameWins": 45.2
},
	// wincap — sampled from books_FSPIN2.jsonl (id 15291, payout 2500000 cents, criteria 'rollerwild')
	{
 "id": 15291,
 "payoutMultiplier": 2500000,
 "events": [
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L2"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "L2"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 100
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 100
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 100
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 100
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 100
     },
     {
      "name": "L2"
     }
    ],
    [
     {
      "name": "H4"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 5
     },
     {
      "name": "L5"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 2
     },
     {
      "name": "L3"
     }
    ],
    [
     {
      "name": "L1"
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "W",
      "wild": true,
      "multiplier": 3
     },
     {
      "name": "H5"
     }
    ]
   ],
   "paddingPositions": [
    1,
    3,
    5,
    7,
    9
   ],
   "anticipation": [
    0,
    0,
    0,
    0,
    0
   ],
   "gameType": "basegame",
   "index": 0
  },
  {
   "type": "rollerWildsApply",
   "reels": [
    {
     "reel": 0,
     "multiplier": 2
    },
    {
     "reel": 1,
     "multiplier": 100
    },
    {
     "reel": 2,
     "multiplier": 5
    },
    {
     "reel": 3,
     "multiplier": 2
    },
    {
     "reel": 4,
     "multiplier": 3
    }
   ],
   "index": 1
  },
  {
   "type": "winInfo",
   "totalWin": 3360000,
   "wins": [
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 0
      },
      {
       "reel": 1,
       "row": 0
      },
      {
       "reel": 2,
       "row": 0
      },
      {
       "reel": 3,
       "row": 0
      },
      {
       "reel": 4,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 0,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 1
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 1
      },
      {
       "reel": 3,
       "row": 1
      },
      {
       "reel": 4,
       "row": 1
      }
     ],
     "meta": {
      "lineIndex": 1,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 2
      },
      {
       "reel": 3,
       "row": 2
      },
      {
       "reel": 4,
       "row": 2
      }
     ],
     "meta": {
      "lineIndex": 2,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 3
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 3
      },
      {
       "reel": 3,
       "row": 3
      },
      {
       "reel": 4,
       "row": 3
      }
     ],
     "meta": {
      "lineIndex": 3,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 4
      },
      {
       "reel": 2,
       "row": 4
      },
      {
       "reel": 3,
       "row": 4
      },
      {
       "reel": 4,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 4,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 0
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 2
      },
      {
       "reel": 3,
       "row": 1
      },
      {
       "reel": 4,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 5,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 2
      },
      {
       "reel": 3,
       "row": 3
      },
      {
       "reel": 4,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 6,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 1
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 3
      },
      {
       "reel": 3,
       "row": 2
      },
      {
       "reel": 4,
       "row": 1
      }
     ],
     "meta": {
      "lineIndex": 7,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 3
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 1
      },
      {
       "reel": 3,
       "row": 2
      },
      {
       "reel": 4,
       "row": 3
      }
     ],
     "meta": {
      "lineIndex": 8,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      },
      {
       "reel": 3,
       "row": 1
      },
      {
       "reel": 4,
       "row": 2
      }
     ],
     "meta": {
      "lineIndex": 9,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 2
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 4
      },
      {
       "reel": 3,
       "row": 3
      },
      {
       "reel": 4,
       "row": 2
      }
     ],
     "meta": {
      "lineIndex": 10,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 0
      },
      {
       "reel": 1,
       "row": 1
      },
      {
       "reel": 2,
       "row": 0
      },
      {
       "reel": 3,
       "row": 1
      },
      {
       "reel": 4,
       "row": 0
      }
     ],
     "meta": {
      "lineIndex": 11,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 4
      },
      {
       "reel": 1,
       "row": 3
      },
      {
       "reel": 2,
       "row": 4
      },
      {
       "reel": 3,
       "row": 3
      },
      {
       "reel": 4,
       "row": 4
      }
     ],
     "meta": {
      "lineIndex": 12,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 1
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 1
      },
      {
       "reel": 3,
       "row": 2
      },
      {
       "reel": 4,
       "row": 1
      }
     ],
     "meta": {
      "lineIndex": 13,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    },
    {
     "symbol": "H1",
     "kind": 5,
     "win": 224000,
     "positions": [
      {
       "reel": 0,
       "row": 3
      },
      {
       "reel": 1,
       "row": 2
      },
      {
       "reel": 2,
       "row": 3
      },
      {
       "reel": 3,
       "row": 2
      },
      {
       "reel": 4,
       "row": 3
      }
     ],
     "meta": {
      "lineIndex": 14,
      "multiplier": 112,
      "winWithoutMult": 2000,
      "lineMultiplier": 112
     }
    }
   ],
   "index": 2
  },
  {
   "type": "setTotalWin",
   "amount": 2500000,
   "index": 3
  },
  {
   "type": "wincap",
   "amount": 2500000,
   "index": 4
  },
  {
   "type": "setWin",
   "amount": 2500000,
   "winLevel": 10,
   "index": 5
  },
  {
   "type": "finalWin",
   "amount": 2500000,
   "index": 6
  }
 ],
 "criteria": "rollerwild",
 "baseGameWins": 25000.0,
 "freeGameWins": 0.0
},
];

export default books;
