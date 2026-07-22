// AUTO-SAMPLED real rounds from the simulated math engine:
// math-sdk/games/0_0_theme_park/library/books/books_<MODE>.jsonl
// Regenerate with scratchpad/sample_books.py + emit_ts.py. Do not edit by hand.
// These literals are typed against the frontend BookEvent union — a type error
// here means math/frontend contract drift.
import type { StoryBook } from './helpers';

const books: StoryBook[] = [
	// base_losing — sampled from books_BASE.jsonl (id 0, payout 0 cents, criteria '0')
	{
 "id": 0,
 "payoutMultiplier": 0,
 "events": [
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L2"
     },
     {
      "name": "H5"
     },
     {
      "name": "H2"
     },
     {
      "name": "L4"
     },
     {
      "name": "L5"
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
      "name": "L4"
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
      "name": "L5"
     },
     {
      "name": "L1"
     },
     {
      "name": "H5"
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
      "name": "H5"
     },
     {
      "name": "H4"
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
      "name": "L5"
     },
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
      "name": "L5"
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
      "name": "L3"
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
      "name": "L4"
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
   "gameType": "basegame",
   "index": 0
  },
  {
   "type": "setTotalWin",
   "amount": 0,
   "index": 1
  },
  {
   "type": "finalWin",
   "amount": 0,
   "index": 2
  }
 ],
 "criteria": "0",
 "baseGameWins": 0.0,
 "freeGameWins": 0.0
},
	// base_linewin — sampled from books_BASE.jsonl (id 1, payout 10 cents, criteria 'basegame')
	{
 "id": 1,
 "payoutMultiplier": 10,
 "events": [
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "H2"
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
      "name": "L1"
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
      "name": "L5"
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
      "name": "S_ROLLER",
      "scatter": true
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
      "name": "L4"
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
      "name": "L4"
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
      "name": "L4"
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
      "name": "S_ROLLER",
      "scatter": true
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
   "gameType": "basegame",
   "index": 0
  },
  {
   "type": "winInfo",
   "totalWin": 10,
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
    }
   ],
   "index": 1
  },
  {
   "type": "setTotalWin",
   "amount": 10,
   "index": 2
  },
  {
   "type": "setWin",
   "amount": 10,
   "winLevel": 2,
   "index": 3
  },
  {
   "type": "finalWin",
   "amount": 10,
   "index": 4
  }
 ],
 "criteria": "basegame",
 "baseGameWins": 0.1,
 "freeGameWins": 0.0
},
	// base_duckcollect — sampled from books_BASE.jsonl (id 132, payout 3200 cents, criteria 'duckcollect')
	{
 "id": 132,
 "payoutMultiplier": 3200,
 "events": [
  {
   "type": "reveal",
   "board": [
    [
     {
      "name": "L1"
     },
     {
      "name": "H1"
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
      "name": "L4"
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
      "name": "L4"
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
      "name": "H5"
     }
    ],
    [
     {
      "name": "L4"
     },
     {
      "name": "L5"
     },
     {
      "name": "H1"
     },
     {
      "name": "L1"
     },
     {
      "name": "DC",
      "duck": true
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
      "name": "DC",
      "duck": true
     },
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
      "name": "L2"
     },
     {
      "name": "L2"
     }
    ],
    [
     {
      "name": "H1"
     },
     {
      "name": "L5"
     },
     {
      "name": "DC",
      "duck": true
     },
     {
      "name": "H5"
     },
     {
      "name": "L5"
     },
     {
      "name": "H1"
     },
     {
      "name": "H1"
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
   "type": "duckCollectStart",
   "positions": [
    {
     "reel": 2,
     "row": 3
    },
    {
     "reel": 3,
     "row": 0
    },
    {
     "reel": 4,
     "row": 1
    }
   ],
   "index": 1
  },
  {
   "type": "duckReveal",
   "position": {
    "reel": 2,
    "row": 3
   },
   "kind": "mult",
   "value": 5,
   "runningTotal": 500,
   "index": 2
  },
  {
   "type": "duckReveal",
   "position": {
    "reel": 3,
    "row": 0
   },
   "kind": "mult",
   "value": 2,
   "runningTotal": 700,
   "index": 3
  },
  {
   "type": "duckReveal",
   "position": {
    "reel": 4,
    "row": 1
   },
   "kind": "mult",
   "value": 25,
   "runningTotal": 3200,
   "index": 4
  },
  {
   "type": "duckCollectEnd",
   "amount": 3200,
   "index": 5
  },
  {
   "type": "setTotalWin",
   "amount": 3200,
   "index": 6
  },
  {
   "type": "setWin",
   "amount": 3200,
   "winLevel": 6,
   "index": 7
  },
  {
   "type": "finalWin",
   "amount": 3200,
   "index": 8
  }
 ],
 "criteria": "duckcollect",
 "baseGameWins": 32.0,
 "freeGameWins": 0.0
},
	// base_rollerwild — sampled from books_BASE.jsonl (id 199, payout 5300 cents, criteria 'basegame')
	{
 "id": 199,
 "payoutMultiplier": 5300,
 "events": [
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
      "name": "H4"
     },
     {
      "name": "L3"
     },
     {
      "name": "L5"
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
      "name": "H5"
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
      "name": "L1"
     }
    ],
    [
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
     }
    ],
    [
     {
      "name": "H1"
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
      "name": "L5"
     },
     {
      "name": "L3"
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
     "reel": 1,
     "multiplier": 2
    },
    {
     "reel": 2,
     "multiplier": 3
    }
   ],
   "index": 1
  },
  {
   "type": "winInfo",
   "totalWin": 5300,
   "wins": [
    {
     "symbol": "H2",
     "kind": 4,
     "win": 2500,
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
      }
     ],
     "meta": {
      "lineIndex": 0,
      "multiplier": 5,
      "winWithoutMult": 500,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H4",
     "kind": 3,
     "win": 250,
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
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "L3",
     "kind": 3,
     "win": 50,
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
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H4",
     "kind": 3,
     "win": 250,
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
      "winWithoutMult": 50,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H2",
     "kind": 3,
     "win": 500,
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
      "winWithoutMult": 100,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H4",
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
     "symbol": "H4",
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
     "symbol": "L5",
     "kind": 3,
     "win": 50,
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
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "L3",
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
     "symbol": "L3",
     "kind": 3,
     "win": 50,
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
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H2",
     "kind": 3,
     "win": 500,
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
      "winWithoutMult": 100,
      "lineMultiplier": 5
     }
    },
    {
     "symbol": "H4",
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
     "symbol": "H4",
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
     "symbol": "L5",
     "kind": 3,
     "win": 50,
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
      "winWithoutMult": 10,
      "lineMultiplier": 5
     }
    }
   ],
   "index": 2
  },
  {
   "type": "setTotalWin",
   "amount": 5300,
   "index": 3
  },
  {
   "type": "setWin",
   "amount": 5300,
   "winLevel": 7,
   "index": 4
  },
  {
   "type": "finalWin",
   "amount": 5300,
   "index": 5
  }
 ],
 "criteria": "basegame",
 "baseGameWins": 53.0,
 "freeGameWins": 0.0
},
];

export default books;
