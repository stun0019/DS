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
  "triggered signals do not regress when price pulls back",
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
      LIVE_STATUS.CONFIRMING
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

  resetLiveStates();

  applyLiveQuoteToState(
    stock,
    "long",
    {
      code: stock.Code,
      last: 111,
      timestamp: "2026-08-17T09:15:00+08:00"
    }
  );

  return applyLiveQuoteToState(
    stock,
    "long",
    {
      code: stock.Code,
      last: 111.5,
      timestamp: "2026-08-17T09:15:05+08:00",
      candles: [
        {
          timestamp: "2026-08-17T09:15:01+08:00",
          open: 110,
          high: 112,
          low: 104,
          close: 108,
          isComplete: true
        },
        {
          timestamp: "2026-08-17T09:15:02+08:00",
          open: 108,
          high: 110,
          low: 102,
          close: 106,
          isComplete: true
        },
        {
          timestamp: "2026-08-17T09:15:03+08:00",
          open: 106,
          high: 112,
          low: 105,
          close: 111.5,
          isComplete: true
        }
      ]
    },
    {
      maxRiskAmount: 25000
    }
  );

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
      "2026-08-17T01:15:05.000Z"
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
          timestamp: "2026-08-17T09:15:06+08:00"
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
      "2026-08-17T01:15:06.000Z"
    );
  }
);


function createRiskEvaluatedLiveState(
  stock,
  maxRiskAmount
) {

  resetLiveStates();

  applyLiveQuoteToState(
    stock,
    "long",
    {
      code: stock.Code,
      last: 111,
      timestamp: "2026-08-18T09:15:00+08:00"
    },
    {
      maxRiskAmount
    }
  );

  return applyLiveQuoteToState(
    stock,
    "long",
    {
      code: stock.Code,
      last: 111.5,
      timestamp: "2026-08-18T09:15:05+08:00",
      candles: [
        {
          timestamp: "2026-08-18T09:15:01+08:00",
          open: 110,
          high: 112,
          low: 106,
          close: 108,
          isComplete: true
        },
        {
          timestamp: "2026-08-18T09:15:02+08:00",
          open: 108,
          high: 110,
          low: 104,
          close: 106,
          isComplete: true
        },
        {
          timestamp: "2026-08-18T09:15:03+08:00",
          open: 106,
          high: 112,
          low: 107,
          close: 111.5,
          isComplete: true
        }
      ]
    },
    {
      maxRiskAmount
    }
  );

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
  "risk-blocked returns to entry-ready after per-lot risk falls",
  () => {
    const stock =
      createStock();

    const blockedState =
      createRiskEvaluatedLiveState(
        stock,
        5000
      );

    const readyState =
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code: stock.Code,
          last: 108,
          timestamp: "2026-08-18T09:15:06+08:00"
        },
        {
          maxRiskAmount: 5000
        }
      );

    assert.equal(
      blockedState.status,
      LIVE_STATUS.RISK_BLOCKED
    );

    assert.ok(
      readyState.riskPlan.cashRiskPerLot <
      5000
    );

    assert.equal(
      readyState.riskPlan.maxLots,
      1
    );

    assert.equal(
      readyState.entry,
      108
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
      LIVE_STATUS.CONFIRMING
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
          timestamp: "2026-08-14T01:10:00.000Z",
          candles: [
            ...triggered.candles,
            {
              timestamp: "2026-08-14T01:06:00.000Z",
              open: 110,
              high: 112,
              low: 104,
              close: 108,
              isComplete: true
            },
            {
              timestamp: "2026-08-14T01:07:00.000Z",
              open: 108,
              high: 110,
              low: 102,
              close: 106,
              isComplete: true
            },
            {
              timestamp: "2026-08-14T01:08:00.000Z",
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
          timestamp: "2026-08-14T01:11:00.000Z",
          candles: [
            ...forming.candles.map(
              candle =>
                candle.timestamp ===
                "2026-08-14T01:08:00.000Z"

                  ? {
                      ...candle,
                      isComplete: true
                    }

                  : candle
            ),
            {
              timestamp: "2026-08-14T01:09:00.000Z",
              open: 110,
              high: 112,
              low: 106,
              close: 111.5,
              isComplete: false
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
