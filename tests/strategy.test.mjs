import test from "node:test";
import assert from "node:assert/strict";

import {
  isLongCandidate,
  isShortCandidate
} from "../assets/js/strategy/candidateRules.js";

import {
  calculateRiskPlan
} from "../assets/js/strategy/riskEngine.js";

import {
  calculateDayTradeCosts
} from "../assets/js/strategy/tradingCosts.js";

import {
  getCandlesAfter
} from "../assets/js/strategy/intradayStructure.js";

import {
  replayCandidate,
  runBacktest
} from "../assets/js/replay/replayEngine.js";

import {
  getNextPrice,
  getPreviousPrice,
  getTickDistance
} from "../assets/js/utils/priceTick.js";

import {
  applyLiveQuoteToState
} from "../assets/js/live/signalEngine.js";

import {
  normalizeLiveQuote
} from "../assets/js/live/liveDataProvider.js";

import {
  getLiveState,
  getLiveStatusLabel,
  LIVE_STATUS,
  resetLiveStates
} from "../assets/js/live/liveState.js";


function createStock(
  overrides = {}
) {
  return {
    Code: "TEST",
    OpeningPrice: 104,
    HighestPrice: 110,
    LowestPrice: 100,
    ClosingPrice: 109,
    Change: 5,
    __liquidityRank: 1,
    DayTradeEligible: true,
    SellFirstDayTradeAllowed: true,
    ...overrides
  };
}


function createShortStock(
  overrides = {}
) {
  return createStock(
    {
      Code: "SHORT",
      Name: "空方測試",
      OpeningPrice: 120,
      HighestPrice: 122,
      LowestPrice: 100,
      ClosingPrice: 101,
      Change: -5,
      ...overrides
    }
  );
}


function fiveMinuteBar(
  timestamp,
  overrides = {}
) {
  return {
    timestamp,
    timeframeMinutes: 5,
    isComplete: true,
    open: 110,
    high: 111,
    low: 109,
    close: 110,
    volume: 1000,
    ...overrides
  };
}


function applyFiveMinuteBar(
  stock,
  side,
  bar,
  maxRiskAmount = null
) {
  return applyLiveQuoteToState(
    stock,
    side,
    {
      code: stock.Code,
      timestamp: bar.timestamp,
      candleTimeframeMinutes: 5,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      last: bar.close,
      volume: bar.volume,
      candles: [
        bar
      ],
      invalidated:
        bar.invalidated ===
        true
    },
    {
      maxRiskAmount
    }
  );
}


function longDirectionBars(
  date = "2026-08-18"
) {
  return [
    fiveMinuteBar(
      `${date}T09:00:00+08:00`,
      {
        open: 110,
        high: 112,
        low: 110,
        close: 111.5
      }
    ),
    fiveMinuteBar(
      `${date}T09:05:00+08:00`,
      {
        open: 111.5,
        high: 112,
        low: 109,
        close: 110.5
      }
    ),
    fiveMinuteBar(
      `${date}T09:10:00+08:00`,
      {
        open: 110.5,
        high: 110.5,
        low: 104,
        close: 106
      }
    ),
    fiveMinuteBar(
      `${date}T09:15:00+08:00`,
      {
        open: 106,
        high: 109,
        low: 105,
        close: 108
      }
    ),
    fiveMinuteBar(
      `${date}T09:20:00+08:00`,
      {
        open: 108,
        high: 112,
        low: 107,
        close: 111.5
      }
    )
  ];
}


function shortDirectionBars(
  date = "2026-08-18"
) {
  return [
    fiveMinuteBar(
      `${date}T09:00:00+08:00`,
      {
        open: 100,
        high: 100,
        low: 98,
        close: 98.5
      }
    ),
    fiveMinuteBar(
      `${date}T09:05:00+08:00`,
      {
        open: 98.5,
        high: 101,
        low: 98,
        close: 99.5
      }
    ),
    fiveMinuteBar(
      `${date}T09:10:00+08:00`,
      {
        open: 99.5,
        high: 106,
        low: 99,
        close: 104
      }
    ),
    fiveMinuteBar(
      `${date}T09:15:00+08:00`,
      {
        open: 104,
        high: 105,
        low: 100,
        close: 102
      }
    ),
    fiveMinuteBar(
      `${date}T09:20:00+08:00`,
      {
        open: 102,
        high: 103,
        low: 98,
        close: 98.5
      }
    )
  ];
}


function feedBars(
  stock,
  side,
  bars,
  maxRiskAmount = null
) {
  resetLiveStates();

  return bars.map(
    bar =>
      applyFiveMinuteBar(
        stock,
        side,
        bar,
        maxRiskAmount
      )
  );
}


function assertClose(
  actual,
  expected,
  tolerance = 0.001
) {
  assert.ok(
    Math.abs(
      actual
      -
      expected
    )
    <=
    tolerance,
    `${actual} should be within ${tolerance} of ${expected}`
  );
}


test(
  "28-discount monthly rebate matches the provided day-trade example",
  () => {
    const costs =
      calculateDayTradeCosts(
        {
          entry: 100,
          exit: 101,
          side: "long",
          shares: 1000
        }
      );

    assertClose(
      costs.originalBuyCommission,
      142.5
    );

    assertClose(
      costs.effectiveBuyCommission,
      39.9
    );

    assertClose(
      costs.originalSellCommission,
      143.925
    );

    assertClose(
      costs.effectiveSellCommission,
      40.299
    );

    assertClose(
      costs.transactionTax,
      151.5
    );

    assertClose(
      costs.monthlyRebate,
      206.226
    );

    assertClose(
      costs.costBeforeRebate,
      437.925
    );

    assertClose(
      costs.netCostAfterRebate,
      231.699
    );

    assertClose(
      costs.netPnlAfterRebate,
      768.301
    );
  }
);


test(
  "sell-first day trades charge tax on the entry sell amount",
  () => {
    const costs =
      calculateDayTradeCosts(
        {
          entry: 101,
          exit: 100,
          side: "short",
          shares: 1000
        }
      );

    assert.equal(
      costs.sellAmount,
      101000
    );

    assertClose(
      costs.transactionTax,
      151.5
    );

    assertClose(
      costs.netPnlAfterRebate,
      768.301
    );
  }
);


test(
  "Taiwan stock tick boundaries remain legal",
  () => {
    assert.deepEqual(
      [
        getNextPrice(49.95),
        getNextPrice(99.9),
        getNextPrice(499.5),
        getNextPrice(999)
      ],
      [50, 100, 500, 1000]
    );

    assert.deepEqual(
      [
        getPreviousPrice(10),
        getPreviousPrice(50),
        getPreviousPrice(100),
        getPreviousPrice(500),
        getPreviousPrice(1000)
      ],
      [9.99, 49.95, 99.9, 499.5, 999]
    );

    assert.equal(
      getTickDistance(
        49.85,
        50
      ),
      3
    );
  }
);


test(
  "candidate rules reject ineligible and sell-first-suspended stocks",
  () => {
    const longStock =
      createStock();

    assert.equal(
      isLongCandidate(
        longStock
      ),
      true
    );

    assert.equal(
      isLongCandidate(
        {
          ...longStock,
          DayTradeEligible: false
        }
      ),
      false
    );

    const shortStock =
      createStock(
        {
          OpeningPrice: 106,
          HighestPrice: 110,
          LowestPrice: 96,
          ClosingPrice: 97,
          Change: -5
        }
      );

    assert.equal(
      isShortCandidate(
        shortStock
      ),
      true
    );

    assert.equal(
      isShortCandidate(
        {
          ...shortStock,
          SellFirstDayTradeAllowed: false
        }
      ),
      false
    );

    assert.equal(
      isShortCandidate(
        {
          ...shortStock,
          SellFirstDayTradeAllowed: true,
          SellFirstSuspended: true
        }
      ),
      false
    );
  }
);


test(
  "raw price pullback cannot replace completed five-minute structure",
  () => {
    resetLiveStates();

    const stock =
      createStock();

    const near =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 110,
          timestamp: "2026-08-14T00:59:58.000Z"
        }
      );

    const triggered =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 110.5,
          timestamp: "2026-08-14T01:00:00.000Z"
        }
      );

    const pullback =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 110,
          timestamp: "2026-08-14T01:00:01.000Z"
        }
      );

    assert.equal(
      near.status,
      LIVE_STATUS.NEAR_TRIGGER
    );

    assert.equal(
      triggered.status,
      LIVE_STATUS.TRIGGERED
    );

    assert.equal(
      pullback.status,
      LIVE_STATUS.TRIGGERED
    );

    assert.equal(
      pullback.triggeredAt,
      "2026-08-14T01:00:00.000Z"
    );
  }
);


test(
  "invalidated is terminal until reset or a later trading session",
  () => {
    resetLiveStates();

    const stock =
      createStock();

    const invalidated =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 109,
          timestamp: "2026-08-14T01:00:00.000Z",
          invalidated: true
        }
      );

    const sameSession =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 111,
          timestamp: "2026-08-14T05:00:00.000Z",
          invalidated: false
        }
      );

    assert.equal(
      invalidated.status,
      LIVE_STATUS.INVALIDATED
    );

    assert.equal(
      sameSession.status,
      LIVE_STATUS.INVALIDATED
    );

    assert.equal(
      sameSession.entry,
      null
    );

    const nextSession =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 111,
          timestamp: "2026-08-17T01:00:00.000Z",
          invalidated: false
        }
      );

    assert.equal(
      nextSession.status,
      LIVE_STATUS.TRIGGERED
    );

    assert.equal(
      nextSession.sessionDate,
      "2026-08-17"
    );

    resetLiveStates();

    const afterManualReset =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 111,
          timestamp: "2026-08-14T05:01:00.000Z"
        }
      );

    assert.equal(
      afterManualReset.status,
      LIVE_STATUS.TRIGGERED
    );
  }
);


test(
  "an older-session quote cannot roll the live state backward",
  () => {
    resetLiveStates();

    const stock =
      createStock();

    const currentState =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 111,
          timestamp: "2026-08-17T09:15:05+08:00"
        }
      );

    const afterOldQuote =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 90,
          timestamp: "2026-08-14T09:15:06+08:00",
          invalidated: true
        }
      );

    assert.strictEqual(
      afterOldQuote,
      currentState
    );

    assert.equal(
      afterOldQuote.sessionDate,
      "2026-08-17"
    );

    assert.equal(
      afterOldQuote.lastQuoteTimestamp,
      "2026-08-17T01:15:05.000Z"
    );
  }
);


test(
  "a quote without a sortable timestamp fails closed",
  () => {
    resetLiveStates();

    const stock =
      createStock();

    const quote =
      normalizeLiveQuote(
        {
          code: stock.Code,
          last: 111
        }
      );

    assert.equal(
      quote.timestamp,
      null
    );

    const state =
      applyLiveQuoteToState(
        stock,
        "long",
        quote
      );

    assert.equal(
      state.status,
      LIVE_STATUS.WAITING_LIVE
    );

    assert.equal(
      state.updatedAt,
      null
    );
  }
);


function createEntryReadyLiveState(
  stock
) {

  const states =
    feedBars(
      stock,
      "long",
      longDirectionBars(
        "2026-08-17"
      ),
      25000
    );


  return states[
    states.length - 1
  ];

}


test(
  "a stale same-session quote cannot alter entry stop or signal",
  () => {
    const stock =
      createStock();

    const readyState =
      createEntryReadyLiveState(
        stock
      );

    assert.equal(
      readyState.status,
      LIVE_STATUS.ENTRY_READY
    );

    const afterStaleQuote =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 90,
          timestamp: "2026-08-17T09:14:58+08:00",
          candles: [],
          invalidated: true
        }
      );

    assert.strictEqual(
      afterStaleQuote,
      readyState
    );

    assert.equal(
      afterStaleQuote.status,
      LIVE_STATUS.ENTRY_READY
    );

    assert.equal(
      afterStaleQuote.entry,
      readyState.entry
    );

    assert.equal(
      afterStaleQuote.stop,
      readyState.stop
    );

    assert.strictEqual(
      afterStaleQuote.riskPlan,
      readyState.riskPlan
    );

    assert.equal(
      afterStaleQuote.lastQuoteTimestamp,
      "2026-08-17T01:20:00.000Z"
    );
  }
);


test(
  "a newer same-session quote continues processing normally",
  () => {
    const stock =
      createStock();

    const readyState =
      createEntryReadyLiveState(
        stock
      );

    const nextState =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 112,
          timestamp: "2026-08-17T09:25:00+08:00"
        }
      );

    assert.notStrictEqual(
      nextState,
      readyState
    );

    assert.equal(
      nextState.status,
      LIVE_STATUS.ENTRY_READY
    );

    assert.equal(
      nextState.quote.last,
      112
    );

    assert.equal(
      nextState.lastQuoteTimestamp,
      "2026-08-17T01:25:00.000Z"
    );
  }
);


function createRiskEvaluatedLiveState(
  stock,
  maxRiskAmount
) {

  const states =
    feedBars(
      stock,
      "long",
      longDirectionBars(),
      maxRiskAmount
    );


  return states[
    states.length - 1
  ];

}


test(
  "maxLots zero blocks entry-ready when a risk limit is configured",
  () => {
    const stock =
      createStock();

    const blockedState =
      createRiskEvaluatedLiveState(
        stock,
        5000
      );

    assert.equal(
      Math.round(
        blockedState.riskPlan.cashRiskPerLot
        /
        100
      )
      *
      100,
      8000
    );

    assert.equal(
      blockedState.riskPlan.maxLots,
      0
    );

    assert.equal(
      blockedState.status,
      LIVE_STATUS.RISK_BLOCKED
    );

    assert.notEqual(
      blockedState.status,
      LIVE_STATUS.ENTRY_READY
    );

    assert.equal(
      getLiveStatusLabel(
        blockedState.status,
        "long"
      ),
      "風險超標"
    );
  }
);


test(
  "risk-blocked requires a new direction confirmation after risk falls",
  () => {
    const stock =
      createStock();

    const blockedState =
      createRiskEvaluatedLiveState(
        stock,
        5000
      );

    const lowerRiskState =
      applyFiveMinuteBar(
        stock,
        "long",
        fiveMinuteBar(
          "2026-08-18T09:25:00+08:00",
          {
            open: 108.3,
            high: 108.4,
            low: 107.5,
            close: 108
          }
        ),
        5000
      );

    assert.equal(
      blockedState.status,
      LIVE_STATUS.RISK_BLOCKED
    );

    assert.ok(
      lowerRiskState.riskPlan.cashRiskPerLot <
      5000
    );

    assert.equal(
      lowerRiskState.riskPlan.maxLots,
      1
    );

    assert.equal(
      lowerRiskState.entry,
      108
    );

    assert.equal(
      lowerRiskState.status,
      LIVE_STATUS.CONFIRMING
    );

    const readyState =
      applyFiveMinuteBar(
        stock,
        "long",
        fiveMinuteBar(
          "2026-08-18T09:30:00+08:00",
          {
            open: 108,
            high: 109,
            low: 107.8,
            close: 108.5
          }
        ),
        5000
      );

    assert.equal(
      readyState.riskPlan.maxLots,
      1
    );

    assert.equal(
      readyState.status,
      LIVE_STATUS.ENTRY_READY
    );
  }
);


test(
  "an unset risk limit preserves normal entry-ready behavior",
  () => {
    const stock =
      createStock();

    const readyState =
      createRiskEvaluatedLiveState(
        stock,
        null
      );

    assert.equal(
      readyState.riskPlan.maxLots,
      null
    );

    assert.equal(
      readyState.status,
      LIVE_STATUS.ENTRY_READY
    );
  }
);


test(
  "only a completed post-breakout swing can produce an entry-ready risk plan",
  () => {
    resetLiveStates();

    const stock =
      createStock();

    const triggered =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 111,
          timestamp: "2026-08-14T01:05:30.000Z",
          candles: [
            {
              timestamp: "2026-08-14T01:01:00.000Z",
              open: 102,
              high: 104,
              low: 100,
              close: 103
            },
            {
              timestamp: "2026-08-14T01:02:00.000Z",
              open: 103,
              high: 105,
              low: 99,
              close: 100
            },
            {
              timestamp: "2026-08-14T01:03:00.000Z",
              open: 100,
              high: 106,
              low: 101,
              close: 105
            },
            {
              timestamp: "2026-08-14T01:04:00.000Z",
              open: 105,
              high: 112,
              low: 104,
              close: 111
            }
          ]
        },
        {
          maxRiskAmount: 25000
        }
      );

    assert.equal(
      triggered.status,
      LIVE_STATUS.TRIGGERED
    );

    assert.equal(
      triggered.stop,
      null
    );

    assert.equal(
      triggered.riskPlan,
      null
    );

    const forming =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 111.5,
          timestamp: "2026-08-14T01:20:00.000Z",
          candleTimeframeMinutes: 5,
          candles: [
            ...triggered.candles,
            {
              timestamp: "2026-08-14T01:10:00.000Z",
              open: 110,
              high: 112,
              low: 104,
              close: 108,
              isComplete: true
            },
            {
              timestamp: "2026-08-14T01:15:00.000Z",
              open: 108,
              high: 110,
              low: 102,
              close: 106,
              isComplete: true
            },
            {
              timestamp: "2026-08-14T01:20:00.000Z",
              open: 106,
              high: 111,
              low: 105,
              close: 110,
              isComplete: false
            }
          ]
        },
        {
          maxRiskAmount: 25000
        }
      );

    assert.equal(
      forming.status,
      LIVE_STATUS.CONFIRMING
    );

    assert.equal(
      forming.riskPlan,
      null
    );

    const result =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 111.5,
          timestamp: "2026-08-14T01:25:00.000Z",
          candleTimeframeMinutes: 5,
          candles: [
            ...forming.candles.map(
              candle =>
                candle.timestamp ===
                "2026-08-14T01:20:00.000Z"

                  ? {
                      ...candle,
                      isComplete: true
                    }

                  : candle
            ),
            {
              timestamp: "2026-08-14T01:25:00.000Z",
              open: 110,
              high: 112,
              low: 106,
              close: 111.5,
              isComplete: true
            }
          ]
        },
        {
          maxRiskAmount: 25000
        }
      );

    assert.equal(
      result.status,
      LIVE_STATUS.ENTRY_READY
    );

    assert.equal(
      result.stop,
      102
    );

    assert.equal(
      result.triggeredAt,
      "2026-08-14T01:05:30.000Z"
    );

    assert.equal(
      result.riskPlan.maxLots,
      2
    );
  }
);


test(
  "forming and sub-five-minute candles cannot confirm structure",
  () => {
    const boundary =
      "2026-08-18T09:00:00+08:00";

    const eligible =
      getCandlesAfter(
        [
          fiveMinuteBar(
            "2026-08-18T09:05:00+08:00",
            {
              timeframeMinutes: 1
            }
          ),
          fiveMinuteBar(
            "2026-08-18T09:10:00+08:00",
            {
              isComplete: false
            }
          ),
          fiveMinuteBar(
            "2026-08-18T09:15:00+08:00"
          )
        ],
        boundary
      );

    assert.equal(
      eligible.length,
      1
    );

    assert.equal(
      eligible[0].timestamp,
      "2026-08-18T09:15:00+08:00"
    );
  }
);


test(
  "future candles are excluded from the current live decision",
  () => {
    resetLiveStates();

    const stock =
      createStock();

    const bars =
      longDirectionBars();

    const firstBar =
      bars[0];

    const state =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          timestamp: firstBar.timestamp,
          candleTimeframeMinutes: 5,
          last: firstBar.close,
          candles:
            bars
        }
      );

    assert.equal(
      state.status,
      LIVE_STATUS.TRIGGERED
    );

    assert.equal(
      state.candles.length,
      1
    );

    assert.equal(
      state.directionConfirmedAt,
      null
    );
  }
);


test(
  "short risk-blocked direction confirmation is symmetric",
  () => {
    const stock =
      createShortStock();

    const states =
      feedBars(
        stock,
        "short",
        shortDirectionBars(),
        5000
      );

    const blockedState =
      states[
        states.length - 1
      ];

    assert.equal(
      blockedState.status,
      LIVE_STATUS.RISK_BLOCKED
    );

    assert.equal(
      blockedState.stop,
      106
    );

    assert.equal(
      blockedState.riskPlan.maxLots,
      0
    );

    const lowerRiskState =
      applyFiveMinuteBar(
        stock,
        "short",
        fiveMinuteBar(
          "2026-08-18T09:25:00+08:00",
          {
            open: 102,
            high: 102.5,
            low: 101.7,
            close: 102
          }
        ),
        5000
      );

    assert.equal(
      lowerRiskState.riskPlan.maxLots,
      1
    );

    assert.equal(
      lowerRiskState.status,
      LIVE_STATUS.CONFIRMING
    );

    const readyState =
      applyFiveMinuteBar(
        stock,
        "short",
        fiveMinuteBar(
          "2026-08-18T09:30:00+08:00",
          {
            open: 102,
            high: 102.1,
            low: 101.4,
            close: 101.6
          }
        ),
        5000
      );

    assert.equal(
      readyState.riskPlan.maxLots,
      1
    );

    assert.equal(
      readyState.status,
      LIVE_STATUS.ENTRY_READY
    );
  }
);


function replayBarsForDate(
  date
) {
  return [
    ...longDirectionBars(
      date
    ),
    fiveMinuteBar(
      `${date}T09:25:00+08:00`,
      {
        open: 111.5,
        high: 125,
        low: 110,
        close: 122
      }
    )
  ];
}


test(
  "replay feeds completed five-minute bars one at a time deterministically",
  () => {
    resetLiveStates();

    const input = {
      stock:
        createStock(
          {
            Name: "多方測試"
          }
        ),
      side:
        "long",
      sessionDate:
        "2026-08-18",
      bars:
        replayBarsForDate(
          "2026-08-18"
        ),
      maxRiskAmount:
        null
    };

    const first =
      replayCandidate(
        input
      );

    const second =
      replayCandidate(
        input
      );

    assert.deepEqual(
      second,
      first
    );

    assert.equal(
      getLiveState(
        input.stock.Code,
        input.side
      ).status,
      LIVE_STATUS.WAITING_LIVE
    );

    assert.equal(
      first.processedBars,
      input.bars.length
    );

    assert.equal(
      first.logs.filter(
        log =>
          log.eventType ===
          "ENTRY"
      ).length,
      1
    );

    assert.equal(
      first.trades.length,
      1
    );

    assert.ok(
      first.logs.every(
        log =>
          log.candle.timeframeMinutes ===
          5
      )
    );
  }
);


test(
  "replay rejects sub-five-minute bars",
  () => {
    assert.throws(
      () =>
        replayCandidate(
          {
            stock:
              createStock(),
            side:
              "long",
            sessionDate:
              "2026-08-18",
            bars: [
              fiveMinuteBar(
                "2026-08-18T09:00:00+08:00",
                {
                  timeframeMinutes: 1
                }
              )
            ]
          }
        ),
      /至少 5 分 K/
    );
  }
);


test(
  "daily and weekly performance reconcile with trade and entry logs",
  () => {
    const longStock =
      createStock(
        {
          Name: "多方測試",
          TradeVolume: 2_000_000
        }
      );

    const shortStock =
      createShortStock(
        {
          TradeVolume: 1_000_000
        }
      );

    const dataset = {
      dailySnapshots: [
        {
          date: "2026-08-17",
          stocks: [
            longStock,
            shortStock
          ]
        },
        {
          date: "2026-08-18",
          stocks: [
            longStock,
            shortStock
          ]
        }
      ],
      sessions: [
        {
          date: "2026-08-18",
          previousTradingDate: "2026-08-17",
          barsByCode: {
            TEST:
              replayBarsForDate(
                "2026-08-18"
              ),
            SHORT: []
          }
        },
        {
          date: "2026-08-19",
          previousTradingDate: "2026-08-18",
          barsByCode: {
            TEST:
              replayBarsForDate(
                "2026-08-19"
              ),
            SHORT: []
          }
        }
      ]
    };

    const report =
      runBacktest(
        dataset
      );

    const entryLogs =
      report.logs.filter(
        log =>
          log.eventType ===
          "ENTRY"
      );

    const netPnlSum =
      report.trades.reduce(
        (
          total,
          trade
        ) =>
          total
          +
          trade.netPnl,
        0
      );

    assert.equal(
      report.summary.tradingDays,
      2
    );

    assert.equal(
      report.daily.length,
      2
    );

    assert.equal(
      report.summary.actualTrades,
      report.trades.length
    );

    assert.equal(
      report.summary.actualTrades,
      entryLogs.length
    );

    assert.equal(
      report.summary.actualTrades,
      report.daily.reduce(
        (
          total,
          day
        ) =>
          total
          +
          day.actualTrades,
        0
      )
    );

    assertClose(
      report.summary.totalPnl,
      netPnlSum
    );

    report.trades.forEach(
      trade => {
        assertClose(
          trade.netPnl,
          trade.grossPnl
          -
          trade.tradingCost
          +
          trade.monthlyRebate
          -
          trade.transactionTax
        );
      }
    );

    assert.equal(
      report.sessions[0].previousTradingDate,
      "2026-08-17"
    );

    assert.equal(
      report.sessions[1].previousTradingDate,
      "2026-08-18"
    );
  }
);


test(
  "risk plan rounds targets and respects the risk budget",
  () => {
    const plan =
      calculateRiskPlan(
        {
          entry: 50,
          stop: 49.5,
          side: "long",
          maxRiskAmount: 1300
        }
      );

    assertClose(
      plan.priceRiskPerLot,
      500
    );

    assertClose(
      plan.riskPerLot,
      613.9505
    );

    assertClose(
      plan.cashRiskPerLot,
      716.0375
    );

    assert.equal(
      Math.floor(
        plan.maxRiskAmount
        /
        plan.riskPerLot
      ),
      2
    );

    assert.equal(
      plan.maxLots,
      1
    );

    assert.equal(
      plan.tp1,
      50.8
    );

    assert.equal(
      plan.breakEvenPrice,
      50.2
    );

    assert.ok(
      plan.tp1Outcome.netPnlAfterRebate
      >=
      plan.riskPerLot
    );
  }
);
