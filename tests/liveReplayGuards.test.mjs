import test from "node:test";
import assert from "node:assert/strict";

import {
  CANDIDATE_DATA_STATUS,
  evaluateCandidateDataFreshness
} from "../assets/js/live/candidateDataFreshness.js";

import {
  applyLiveQuoteToState
} from "../assets/js/live/signalEngine.js";

import {
  LIVE_STATUS,
  resetLiveStates
} from "../assets/js/live/liveState.js";

import {
  replayCandidate,
  runBacktest
} from "../assets/js/replay/replayEngine.js";

import {
  applyReplaySlippage
} from "../assets/js/replay/slippage.js";

import {
  buildPerformanceReport
} from "../assets/js/replay/performance.js";

import {
  HISTORICAL_SOURCE_TYPE,
  JsonHistorical5mProvider,
  getHistoricalSourceLabel,
  parseHistorical5mCsv
} from "../assets/js/replay/historical5mProvider.js";

import {
  calculateDayTradeCosts
} from "../assets/js/strategy/tradingCosts.js";

import {
  getTickDistance
} from "../assets/js/utils/priceTick.js";

import {
  TRADING_CALENDAR_SOURCE,
  getPreviousTradingDate,
  isTradingDate
} from "../assets/js/utils/tradingCalendar.js";

import {
  HISTORICAL_UNIVERSE_MODE
} from "../assets/js/replay/historicalUniverse.js";


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
    ) <=
      tolerance,
    `${actual} should be within ${tolerance} of ${expected}`
  );

}


function createStock() {

  return {
    Code: "GUARD",
    Name: "Guard 測試",
    Market: "TWSE",
    OpeningPrice: 104,
    HighestPrice: 110,
    LowestPrice: 100,
    ClosingPrice: 109,
    Change: 5,
    TradeVolume: 2_000_000,
    DayTradeEligible: true,
    SellFirstDayTradeAllowed: true
  };

}


function tradingCalendar(
  {
    coveredYears = [
      "2026"
    ],
    closedDates = [],
    specialTradingDates = []
  } = {}
) {

  return {
    source:
      TRADING_CALENDAR_SOURCE,
    syncStatus:
      "SYNCED",
    coveredYears,
    closedDates,
    specialTradingDates
  };

}


function candidateMetadata(
  tradeDate,
  liveSessionDate,
  calendar,
  expectedPreviousTradingDate =
    getPreviousTradingDate(
      liveSessionDate,
      calendar
    )
) {

  return {
    tradeDateISO:
      tradeDate,
    syncStatus:
      "SYNCED",
    validForTradingDate:
      liveSessionDate,
    expectedPreviousTradingDate,
    tradingCalendar:
      calendar,
    marketTradeDates: {
      TWSE:
        tradeDate,
      TPEX:
        tradeDate
    }
  };

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


function longDirectionBars(
  date
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


function createShortStock() {

  return {
    ...createStock(),
    Code: "SHORT_GUARD",
    Name: "Short Guard 測試",
    OpeningPrice: 120,
    HighestPrice: 122,
    LowestPrice: 100,
    ClosingPrice: 101,
    Change: -5
  };

}


function shortDirectionBars(
  date
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


function replaySide(
  side,
  {
    slippageTicks = 0,
    maxRiskAmount = null
  } = {}
) {

  const stock =
    side === "long"

      ? createStock()

      : createShortStock();


  return replayCandidate(
    {
      stock,
      side,
      sessionDate: "2026-08-18",
      bars: [
        ...(
          side === "long"

            ? longDirectionBars("2026-08-18")

            : shortDirectionBars("2026-08-18")
        ),
        fiveMinuteBar(
          "2026-08-18T09:25:00+08:00",
          side === "long"

            ? {
                open: 111.5,
                high: 112,
                low: 110,
                close: 111
              }

            : {
                open: 98.5,
                high: 100,
                low: 98,
                close: 99
              }
        )
      ],
      slippageTicks,
      maxRiskAmount
    }
  );

}


function applyBarsWithFreshness(
  freshness
) {

  resetLiveStates();


  const stock =
    createStock();


  return longDirectionBars(
    "2026-08-17"
  )
  .map(
    bar =>
      applyLiveQuoteToState(
        stock,
        "long",
        {
          code:
            stock.Code,
          timestamp:
            bar.timestamp,
          candleTimeframeMinutes: 5,
          open:
            bar.open,
          high:
            bar.high,
          low:
            bar.low,
          last:
            bar.close,
          volume:
            bar.volume,
          candles: [
            bar
          ]
        },
        {
          candidateDataFreshness:
            freshness
        }
      )
  );

}


function replayDataset() {

  const stock =
    createStock();


  return {
    dailySnapshots: [
      {
        date: "2026-08-17",
        stocks: [
          stock
        ]
      },
      {
        date: "2026-08-18",
        stocks: [
          stock
        ]
      }
    ],
    sessions: [
      {
        date: "2026-08-18",
        previousTradingDate: "2026-08-17",
        barsByCode: {
          GUARD: [
            ...longDirectionBars(
              "2026-08-18"
            ),
            fiveMinuteBar(
              "2026-08-18T09:25:00+08:00",
              {
                open: 111.5,
                high: 125,
                low: 110,
                close: 122
              }
            )
          ]
        }
      },
      {
        date: "2026-08-19",
        previousTradingDate: "2026-08-18",
        barsByCode: {
          GUARD: [
            ...longDirectionBars(
              "2026-08-19"
            ),
            fiveMinuteBar(
              "2026-08-19T09:25:00+08:00",
              {
                open: 111.5,
                high: 112,
                low: 90,
                close: 95
              }
            )
          ]
        }
      }
    ]
  };

}


function validatedRealDataset(
  source
) {

  const dataset =
    JSON.parse(
      JSON.stringify(
        source
      )
    );

  const tpexStock = {
    ...createStock(),
    Code: "GUARD_TPEX",
    Name: "Guard 上櫃測試",
    Market: "TPEX",
    DayTradeEligible: false
  };


  dataset.dailySnapshots.forEach(
    snapshot => {

      snapshot.stocks.push(
        tpexStock
      );

    }
  );

  dataset.metadata = {
    sourceType:
      HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA,
    universeMode:
      HISTORICAL_UNIVERSE_MODE,
    universeValidated: true,
    universeStockCount: 2,
    twseStockCount: 1,
    tpexStockCount: 1
  };


  return dataset;

}


test(
  "stale candidate data cannot reach live entry ready",
  () => {

    const calendar =
      tradingCalendar();

    const freshness =
      evaluateCandidateDataFreshness(
        candidateMetadata(
          "2026-08-13",
          "2026-08-17",
          calendar
        ),
        "2026-08-17"
      );


    assert.equal(
      freshness.status,
      CANDIDATE_DATA_STATUS.DATA_STALE
    );


    const states =
      applyBarsWithFreshness(
        freshness
      );


    assert.equal(
      states.every(
        state =>
          state.status ===
            LIVE_STATUS.DATA_STALE
      ),
      true
    );

    assert.equal(
      states.at(-1).entryReadyAt,
      null
    );

    assert.equal(
      states.at(-1).riskPlan,
      null
    );

  }
);


test(
  "candidate freshness fails closed without an official trading-date declaration",
  () => {

    const sameDayRefreshOnly =
      evaluateCandidateDataFreshness(
        {
          tradeDateISO: "2026-08-13",
          candidateDataUpdatedAt:
            "2026-08-17 08:15:00",
          syncStatus: "SYNCED"
        },
        "2026-08-17"
      );


    const weekendDeclaration =
      evaluateCandidateDataFreshness(
        {
          tradeDateISO: "2026-08-14",
          validForTradingDate:
            "2026-08-15",
          syncStatus: "SYNCED"
        },
        "2026-08-15"
      );


    assert.equal(
      sameDayRefreshOnly.status,
      CANDIDATE_DATA_STATUS.DATA_STALE
    );


    assert.equal(
      weekendDeclaration.status,
      CANDIDATE_DATA_STATUS.DATA_STALE
    );

  }
);


test(
  "the actual previous trading date allows live signals",
  () => {

    const calendar =
      tradingCalendar();

    const freshness =
      evaluateCandidateDataFreshness(
        candidateMetadata(
          "2026-08-17",
          "2026-08-18",
          calendar
        ),
        "2026-08-18"
      );


    assert.equal(
      freshness.status,
      CANDIDATE_DATA_STATUS.FRESH
    );


    const states =
      (() => {
        resetLiveStates();

        const stock =
          createStock();

        return longDirectionBars(
          "2026-08-18"
        ).map(
          bar =>
            applyLiveQuoteToState(
              stock,
              "long",
              {
                code: stock.Code,
                timestamp: bar.timestamp,
                candleTimeframeMinutes: 5,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                last: bar.close,
                volume: bar.volume,
                candles: [bar]
              },
              {
                candidateDataFreshness:
                  freshness
              }
            )
        );
      })();


    assert.equal(
      states.at(-1).status,
      LIVE_STATUS.ENTRY_READY
    );

  }
);


test(
  "Monday requires Friday candidate data and rejects Thursday",
  () => {

    const calendar =
      tradingCalendar();


    assert.equal(
      getPreviousTradingDate(
        "2026-08-17",
        calendar
      ),
      "2026-08-14"
    );


    const friday =
      evaluateCandidateDataFreshness(
        candidateMetadata(
          "2026-08-14",
          "2026-08-17",
          calendar
        ),
        "2026-08-17"
      );


    const thursday =
      evaluateCandidateDataFreshness(
        candidateMetadata(
          "2026-08-13",
          "2026-08-17",
          calendar
        ),
        "2026-08-17"
      );


    assert.equal(
      friday.status,
      CANDIDATE_DATA_STATUS.FRESH
    );


    assert.equal(
      thursday.status,
      CANDIDATE_DATA_STATUS.DATA_STALE
    );

  }
);


test(
  "holiday and consecutive closures resolve the last actual trading date",
  () => {

    const lunarNewYearCalendar =
      tradingCalendar(
        {
          closedDates: [
            "2026-02-12",
            "2026-02-13",
            "2026-02-16",
            "2026-02-17",
            "2026-02-18",
            "2026-02-19",
            "2026-02-20"
          ],
          specialTradingDates: [
            "2026-02-11",
            "2026-02-23"
          ]
        }
      );


    assert.equal(
      getPreviousTradingDate(
        "2026-02-23",
        lunarNewYearCalendar
      ),
      "2026-02-11"
    );


    assert.equal(
      evaluateCandidateDataFreshness(
        candidateMetadata(
          "2026-02-11",
          "2026-02-23",
          lunarNewYearCalendar
        ),
        "2026-02-23"
      ).status,
      CANDIDATE_DATA_STATUS.FRESH
    );


    const consecutiveClosureCalendar =
      tradingCalendar(
        {
          closedDates: [
            "2026-09-28",
            "2026-09-29"
          ]
        }
      );


    assert.equal(
      getPreviousTradingDate(
        "2026-09-30",
        consecutiveClosureCalendar
      ),
      "2026-09-25"
    );

  }
);


test(
  "official special weekend trading dates override the weekend rule",
  () => {

    const calendar =
      tradingCalendar(
        {
          specialTradingDates: [
            "2026-08-15"
          ]
        }
      );


    assert.equal(
      isTradingDate(
        "2026-08-15",
        calendar
      ),
      true
    );


    assert.equal(
      getPreviousTradingDate(
        "2026-08-17",
        calendar
      ),
      "2026-08-15"
    );

  }
);


test(
  "an incomplete holiday calendar fails closed",
  () => {

    const incompleteCalendar =
      tradingCalendar(
        {
          coveredYears: [
            "2026"
          ],
          closedDates: [
            "2026-01-01"
          ],
          specialTradingDates: [
            "2026-01-02"
          ]
        }
      );


    assert.equal(
      getPreviousTradingDate(
        "2026-01-02",
        incompleteCalendar
      ),
      null
    );


    assert.equal(
      evaluateCandidateDataFreshness(
        candidateMetadata(
          "2025-12-31",
          "2026-01-02",
          incompleteCalendar,
          null
        ),
        "2026-01-02"
      ).status,
      CANDIDATE_DATA_STATUS.DATA_STALE
    );

  }
);


test(
  "replay previousTradingDate remains independent from live freshness guard",
  () => {

    const stock =
      createStock();


    const report =
      runBacktest(
        {
          dailySnapshots: [
            {
              date: "2026-08-13",
              stocks: [
                stock
              ]
            },
            {
              date: "2026-08-14",
              stocks: [
                stock
              ]
            }
          ],
          sessions: [
            {
              date: "2026-08-17",
              previousTradingDate: "2026-08-13",
              barsByCode: {}
            }
          ]
        }
      );


    assert.equal(
      report.sessions[0].previousTradingDate,
      "2026-08-13"
    );

  }
);


test(
  "zero one and two tick replay slippage are adverse and symmetric",
  () => {

    assert.deepEqual(
      [
        0,
        1,
        2
      ].map(
        slippageTicks =>
          applyReplaySlippage(
            {
              price: 100,
              side: "long",
              leg: "entry",
              slippageTicks
            }
          )
      ),
      [
        100,
        100.5,
        101
      ]
    );

    assert.equal(
      applyReplaySlippage(
        {
          price: 100,
          side: "long",
          leg: "exit",
          slippageTicks: 2
        }
      ),
      99.8
    );

    assert.equal(
      applyReplaySlippage(
        {
          price: 100,
          side: "short",
          leg: "entry",
          slippageTicks: 2
        }
      ),
      99.8
    );

    assert.equal(
      applyReplaySlippage(
        {
          price: 100,
          side: "short",
          leg: "exit",
          slippageTicks: 2
        }
      ),
      101
    );


    const zeroTickTrade =
      runBacktest(
        replayDataset(),
        {
          slippageTicks: 0
        }
      ).trades[0];


    assert.equal(
      zeroTickTrade.rawEntry,
      zeroTickTrade.filledEntry
    );

    assert.equal(
      zeroTickTrade.rawExit,
      zeroTickTrade.filledExit
    );

    assert.equal(
      zeroTickTrade.slippageCost,
      0
    );

  }
);


test(
  "slippage crosses Taiwan tick bands using legal prices",
  () => {

    const upward =
      applyReplaySlippage(
        {
          price: 49.95,
          side: "long",
          leg: "entry",
          slippageTicks: 2
        }
      );


    const downward =
      applyReplaySlippage(
        {
          price: 50,
          side: "long",
          leg: "exit",
          slippageTicks: 2
        }
      );


    assert.equal(
      upward,
      50.1
    );

    assert.equal(
      downward,
      49.9
    );

    assert.equal(
      getTickDistance(
        49.95,
        upward
      ),
      2
    );

    assert.equal(
      getTickDistance(
        50,
        downward
      ),
      2
    );


    [
      [49.95, 50.1],
      [99.9, 100.5],
      [499.5, 501],
      [999, 1005]
    ].forEach(
      ([rawPrice, expectedPrice]) => {

        const filledPrice =
          applyReplaySlippage(
            {
              price: rawPrice,
              side: "long",
              leg: "entry",
              slippageTicks: 2
            }
          );


        assert.equal(
          filledPrice,
          expectedPrice
        );


        assert.equal(
          getTickDistance(
            rawPrice,
            filledPrice
          ),
          2
        );

      }
    );


    [
      [50, 49.9],
      [100, 99.8],
      [500, 499],
      [1000, 998]
    ].forEach(
      ([rawPrice, expectedPrice]) => {

        const filledPrice =
          applyReplaySlippage(
            {
              price: rawPrice,
              side: "long",
              leg: "exit",
              slippageTicks: 2
            }
          );


        assert.equal(
          filledPrice,
          expectedPrice
        );


        assert.equal(
          getTickDistance(
            rawPrice,
            filledPrice
          ),
          2
        );

      }
    );

  }
);


test(
  "filled slippage risk can reject a raw one-lot entry",
  () => {

    const baseline =
      replaySide(
        "long",
        {
          slippageTicks: 2
        }
      ).trades[0];


    assert.ok(
      baseline.filledCashRiskPerLot >
        baseline.rawCashRiskPerLot
    );


    const maxRiskAmount =
      (
        baseline.rawCashRiskPerLot
        +
        baseline.filledCashRiskPerLot
      )
      /
      2;


    const result =
      replaySide(
        "long",
        {
          slippageTicks: 2,
          maxRiskAmount
        }
      );


    const rejected =
      result.logs.find(
        log =>
          log.eventType ===
            "ENTRY_REJECTED_RISK"
      );


    assert.equal(
      result.trades.length,
      0
    );


    assert.ok(rejected);


    assert.equal(
      rejected.rawMaxLots,
      1
    );


    assert.equal(
      rejected.filledMaxLots,
      0
    );


    assert.equal(
      rejected.newStatus,
      "RISK_BLOCKED_SLIPPAGE"
    );


    assert.equal(
      rejected.structuralStop,
      rejected.stop
    );


    assert.ok(
      rejected.expectedFilledStop !==
        rejected.structuralStop
    );


    const performance =
      buildPerformanceReport(
        {
          sessionResults: [
            {
              date: "2026-08-18",
              candidateCount: 1
            }
          ],
          trades:
            result.trades,
          logs:
            result.logs
        }
      );


    assert.equal(
      performance.summary.actualTrades,
      0
    );


    assert.equal(
      performance.summary.wins,
      0
    );


    assert.equal(
      performance.summary.losses,
      0
    );


    assert.equal(
      performance.summary.riskBlockedCount,
      1
    );

  }
);


test(
  "filled position sizing reduces three raw lots to two actual lots",
  () => {

    [
      "long",
      "short"
    ].forEach(
      side => {

        const baseline =
          replaySide(
            side,
            {
              slippageTicks: 2
            }
          ).trades[0];


        const maxRiskAmount =
          baseline.rawCashRiskPerLot
          *
          3
          +
          0.01;


        const trade =
          replaySide(
            side,
            {
              slippageTicks: 2,
              maxRiskAmount
            }
          ).trades[0];


        assert.equal(
          trade.rawMaxLots,
          3
        );


        assert.equal(
          trade.filledMaxLots,
          2
        );


        assert.equal(
          trade.actualLots,
          2
        );


        assert.equal(
          trade.shares,
          2000
        );


        const expectedCosts =
          calculateDayTradeCosts(
            {
              entry:
                trade.filledEntry,
              exit:
                trade.filledExit,
              side,
              shares:
                trade.shares
            }
          );


        assertClose(
          trade.netPnl,
          expectedCosts.netPnlAfterRebate
        );


        assertClose(
          trade.initialRisk,
          trade.filledRiskPerLot
          *
          trade.actualLots
        );

      }
    );

  }
);


test(
  "zero-tick raw and filled position sizes are identical",
  () => {

    [
      "long",
      "short"
    ].forEach(
      side => {

        const baseline =
          replaySide(side).trades[0];

        const maxRiskAmount =
          baseline.rawCashRiskPerLot
          *
          3
          +
          0.01;

        const trade =
          replaySide(
            side,
            {
              slippageTicks: 0,
              maxRiskAmount
            }
          ).trades[0];


        assert.equal(
          trade.rawMaxLots,
          trade.filledMaxLots
        );


        assert.equal(
          trade.rawCashRiskPerLot,
          trade.filledCashRiskPerLot
        );


        assert.equal(
          trade.actualLots,
          3
        );

      }
    );

  }
);


test(
  "filled prices drive replay pnl R and performance",
  () => {

    const report =
      runBacktest(
        replayDataset(),
        {
          slippageTicks: 2
        }
      );


    assert.equal(
      report.trades.length,
      2
    );


    report.trades.forEach(
      trade => {

        const expectedCosts =
          calculateDayTradeCosts(
            {
              entry:
                trade.filledEntry,
              exit:
                trade.filledExit,
              side:
                trade.side,
              shares:
                trade.shares
            }
          );


        assert.equal(
          trade.slippageTicks,
          2
        );

        assert.ok(
          trade.slippageCost >
            0
        );

        assertClose(
          trade.netPnl,
          expectedCosts.netPnlAfterRebate
        );

        assertClose(
          trade.grossPnl,
          expectedCosts.grossPnl
        );


        assertClose(
          trade.originalCommission,
          expectedCosts.originalCommission
        );


        assertClose(
          trade.monthlyRebate,
          expectedCosts.monthlyRebate
        );


        assertClose(
          trade.transactionTax,
          expectedCosts.transactionTax
        );


        assertClose(
          trade.netCostAfterRebate,
          expectedCosts.netCostAfterRebate
        );


        const rawGrossPnl =
          (
            trade.side ===
              "long"

              ? trade.rawExit
                -
                trade.rawEntry

              : trade.rawEntry
                -
                trade.rawExit
          )
          *
          trade.shares;


        assertClose(
          trade.slippageCost,
          rawGrossPnl
          -
          trade.grossPnl
        );

        assertClose(
          trade.rMultiple,
          trade.netPnl
          /
          trade.initialRisk
        );

      }
    );


    const wins =
      report.trades.filter(
        trade =>
          trade.netPnl > 0
      );


    const losses =
      report.trades.filter(
        trade =>
          trade.netPnl < 0
      );


    assert.equal(
      wins.length,
      1
    );

    assert.equal(
      losses.length,
      1
    );

    assertClose(
      report.summary.totalPnl,
      report.trades.reduce(
        (
          total,
          trade
        ) =>
          total
          +
          trade.netPnl,
        0
      )
    );

    assertClose(
      report.summary.totalR,
      report.trades.reduce(
        (
          total,
          trade
        ) =>
          total
          +
          trade.rMultiple,
        0
      )
    );

    assertClose(
      report.summary.totalSlippageCost,
      report.trades.reduce(
        (
          total,
          trade
        ) =>
          total
          +
          trade.slippageCost,
        0
      )
    );

    const expectedProfitFactor =
      wins[0].netPnl
      /
      Math.abs(
        losses[0].netPnl
      );


    assertClose(
      report.summary.profitFactor,
      expectedProfitFactor
    );


    assertClose(
      report.daily.reduce(
        (
          total,
          day
        ) =>
          total
          +
          day.totalPnl,
        0
      ),
      report.summary.totalPnl
    );


    assertClose(
      report.instruments.reduce(
        (
          total,
          instrument
        ) =>
          total
          +
          instrument.totalPnl,
        0
      ),
      report.summary.totalPnl
    );

  }
);


test(
  "historical providers cannot confuse mock and real source labels",
  () => {

    const baseDataset =
      replayDataset();


    const jsonProvider =
      new JsonHistorical5mProvider();


    const implicitMock =
      jsonProvider.toReplayDataset(
        baseDataset
      );


    const spoofedMock =
      jsonProvider.toReplayDataset(
        {
          ...baseDataset,
          metadata: {
            sourceType:
              HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK,
            sourceLabel:
              "REAL HISTORICAL DATA"
          }
        }
      );


    const explicitReal =
      jsonProvider.toReplayDataset(
        validatedRealDataset(
          baseDataset
        )
      );


    const topLevelRealOnly =
      jsonProvider.toReplayDataset(
        {
          ...baseDataset,
          sourceType:
            HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA
        }
      );


    assert.equal(
      implicitMock.metadata.sourceLabel,
      "SAMPLE / MOCK"
    );

    assert.equal(
      spoofedMock.metadata.sourceLabel,
      "SAMPLE / MOCK"
    );

    assert.equal(
      explicitReal.metadata.sourceLabel,
      "REAL HISTORICAL DATA"
    );


    assert.equal(
      topLevelRealOnly.metadata.sourceType,
      HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK
    );

    assert.equal(
      getHistoricalSourceLabel(
        HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK
      ),
      "SAMPLE / MOCK"
    );

  }
);


test(
  "CSV historical provider produces the replay dataset contract",
  () => {

    const csv = [
      "sourceType,universeMode,universeValidated,universeStockCount,twseStockCount,tpexStockCount,sessionDate,previousTradingDate,code,name,market,openingPrice,highestPrice,lowestPrice,closingPrice,change,tradeVolume,dayTradeEligible,sellFirstDayTradeAllowed,timestamp,timeframeMinutes,isComplete,open,high,low,close,volume",
      `REAL_HISTORICAL_DATA,${HISTORICAL_UNIVERSE_MODE},true,2,1,1,2026-08-18,2026-08-17,2330,台積電,TWSE,104,110,100,109,5,2000000,true,true,2026-08-18T09:00:00+08:00,5,true,110,112,109,111.5,1800`,
      `REAL_HISTORICAL_DATA,${HISTORICAL_UNIVERSE_MODE},true,2,1,1,2026-08-18,2026-08-17,8069,元太,TPEX,110,112,98,100,-2,750000,false,true,2026-08-18T09:00:00+08:00,5,true,100,101,99,100,1000`
    ].join(
      "\n"
    );


    const dataset =
      parseHistorical5mCsv(
        csv
      );


    assert.equal(
      dataset.metadata.sourceType,
      HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA
    );

    assert.equal(
      dataset.metadata.sourceLabel,
      "REAL HISTORICAL DATA"
    );

    assert.equal(
      dataset.dailySnapshots[0].stocks[0].Code,
      "2330"
    );

    assert.equal(
      dataset.sessions[0].previousTradingDate,
      "2026-08-17"
    );

    assert.equal(
      dataset.sessions[0].barsByCode["2330"][0].timeframeMinutes,
      5
    );


    const report =
      runBacktest(
        dataset
      );


    assert.equal(
      report.sessions[0].previousTradingDate,
      "2026-08-17"
    );

  }
);


test(
  "CSV requires every row to declare REAL historical data",
  () => {

    const header =
      "sourceType,sessionDate,previousTradingDate,code,name,market,openingPrice,highestPrice,lowestPrice,closingPrice,change,tradeVolume,dayTradeEligible,sellFirstDayTradeAllowed,timestamp,timeframeMinutes,isComplete,open,high,low,close,volume";

    const realRow =
      "REAL_HISTORICAL_DATA,2026-08-18,2026-08-17,2330,台積電,TWSE,104,110,100,109,5,2000000,true,true,2026-08-18T09:00:00+08:00,5,true,110,112,109,111.5,1800";

    const blankRow =
      ",2026-08-18,2026-08-17,2330,台積電,TWSE,104,110,100,109,5,2000000,true,true,2026-08-18T09:05:00+08:00,5,true,111.5,113,111,112,1600";

    const sampleRow =
      "SAMPLE_MOCK,2026-08-18,2026-08-17,2330,台積電,TWSE,104,110,100,109,5,2000000,true,true,2026-08-18T09:05:00+08:00,5,true,111.5,113,111,112,1600";


    assert.throws(
      () =>
        parseHistorical5mCsv(
          [
            header,
            realRow,
            blankRow
          ].join("\n")
        ),
      /來源標記不一致/
    );


    assert.throws(
      () =>
        parseHistorical5mCsv(
          [
            header,
            realRow,
            sampleRow
          ].join("\n")
        ),
      /來源標記不一致/
    );


    const implicitSample =
      parseHistorical5mCsv(
        [
          header,
          blankRow
        ].join("\n")
      );


    assert.equal(
      implicitSample.metadata.sourceType,
      HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK
    );

  }
);


test(
  "final-bar ENTRY_READY is skipped without trade pnl cost or slippage",
  () => {

    const replay =
      replayCandidate(
        {
          stock:
            createStock(),
          side:
            "long",
          sessionDate:
            "2026-08-18",
          bars: [
            ...longDirectionBars(
              "2026-08-18"
            ),
            fiveMinuteBar(
              "2026-08-18T09:25:00+08:00",
              {
                isComplete: false,
                open: 111.5,
                high: 125,
                low: 90,
                close: 120
              }
            )
          ],
          slippageTicks:
            2
        }
      );

    const performance =
      buildPerformanceReport(
        {
          sessionResults: [
            {
              date:
                "2026-08-18",
              candidateCount: 1
            }
          ],
          trades:
            replay.trades,
          logs:
            replay.logs
        }
      );

    const skippedLogs =
      replay.logs.filter(
        log =>
          log.eventType ===
            "ENTRY_SKIPPED_END_OF_SESSION"
      );


    assert.equal(
      replay.trades.length,
      0
    );

    assert.equal(
      performance.summary.actualTrades,
      0
    );

    assert.equal(
      performance.summary.totalPnl,
      0
    );

    assert.equal(
      performance.summary.totalR,
      0
    );

    assert.equal(
      performance.summary.totalSlippageCost,
      0
    );

    assert.equal(
      skippedLogs.length,
      1
    );

    assert.equal(
      Date.parse(
        skippedLogs[0].timestamp
      ),
      Date.parse(
        "2026-08-18T09:20:00+08:00"
      )
    );

    assert.equal(
      skippedLogs[0].rawEntry,
      null
    );

    assert.equal(
      skippedLogs[0].filledEntry,
      null
    );

    assert.equal(
      skippedLogs[0].slippageTicks,
      null
    );

    assert.equal(
      skippedLogs[0].slippageCost,
      null
    );

    assert.equal(
      skippedLogs[0].pnl,
      null
    );

    assert.equal(
      replay.logs.filter(
        log =>
          log.eventType ===
            "ENTRY"
      ).length,
      0
    );

  }
);


test(
  "penultimate-bar entry can close OTHER on the final bar",
  () => {

    const replay =
      replaySide(
        "long",
        {
          slippageTicks: 2
        }
      );

    const trade =
      replay.trades[0];


    assert.equal(
      replay.trades.length,
      1
    );

    assert.equal(
      trade.exitReason,
      "OTHER"
    );

    assert.equal(
      Date.parse(
        trade.exitTime
      ),
      Date.parse(
        "2026-08-18T09:25:00+08:00"
      )
    );

    assert.ok(
      Date.parse(
        trade.entryTime
      ) <
        Date.parse(
          trade.exitTime
        )
    );

    assert.equal(
      replay.logs.filter(
        log =>
          log.eventType ===
            "EXIT"
          &&
          log.exitReason ===
            "OTHER"
      ).length,
      1
    );

  }
);


test(
  "every completed replay trade exits after its entry",
  () => {

    const trades = [
      ...runBacktest(
        replayDataset(),
        {
          slippageTicks: 2
        }
      ).trades,
      ...replaySide(
        "long"
      ).trades,
      ...replaySide(
        "short"
      ).trades
    ];


    assert.ok(
      trades.length > 0
    );

    trades.forEach(
      trade => {

        assert.ok(
          Date.parse(
            trade.entryTime
          ) <
            Date.parse(
              trade.exitTime
            )
        );

      }
    );

  }
);


test(
  "end-of-session skip preserves daily weekly and log reconciliation",
  () => {

    const completedReport =
      runBacktest(
        replayDataset(),
        {
          slippageTicks: 2
        }
      );

    const skippedReplay =
      replayCandidate(
        {
          stock:
            createStock(),
          side:
            "long",
          sessionDate:
            "2026-08-20",
          bars:
            longDirectionBars(
              "2026-08-20"
            ),
          slippageTicks:
            2
        }
      );

    const report =
      buildPerformanceReport(
        {
          sessionResults: [
            ...completedReport.sessions,
            {
              date:
                "2026-08-20",
              candidateCount: 1
            }
          ],
          trades:
            completedReport.trades,
          logs: [
            ...completedReport.logs,
            ...skippedReplay.logs
          ]
        }
      );

    const entryLogs =
      report.logs.filter(
        log =>
          log.eventType ===
            "ENTRY"
      );

    const exitLogs =
      report.logs.filter(
        log =>
          log.eventType ===
            "EXIT"
      );

    const skippedLogs =
      report.logs.filter(
        log =>
          log.eventType ===
            "ENTRY_SKIPPED_END_OF_SESSION"
      );

    const totalPnl =
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

    const totalR =
      report.trades.reduce(
        (
          total,
          trade
        ) =>
          total
          +
          trade.rMultiple,
        0
      );

    const grossProfit =
      report.trades.reduce(
        (
          total,
          trade
        ) =>
          total
          +
          Math.max(
            0,
            trade.netPnl
          ),
        0
      );

    const grossLoss =
      Math.abs(
        report.trades.reduce(
          (
            total,
            trade
          ) =>
            total
            +
            Math.min(
              0,
              trade.netPnl
            ),
          0
        )
      );


    assert.equal(
      skippedLogs.length,
      1
    );

    assert.equal(
      report.summary.actualTrades,
      report.trades.length
    );

    assert.equal(
      entryLogs.length,
      report.trades.length
    );

    assert.equal(
      exitLogs.length,
      report.trades.length
    );

    assert.equal(
      report.daily.reduce(
        (
          total,
          day
        ) =>
          total
          +
          day.actualTrades,
        0
      ),
      report.summary.actualTrades
    );

    assertClose(
      report.summary.totalPnl,
      totalPnl
    );

    assertClose(
      report.summary.totalR,
      totalR
    );

    assertClose(
      report.daily.reduce(
        (
          total,
          day
        ) =>
          total
          +
          day.totalPnl,
        0
      ),
      report.summary.totalPnl
    );

    assertClose(
      report.daily.reduce(
        (
          total,
          day
        ) =>
          total
          +
          day.totalR,
        0
      ),
      report.summary.totalR
    );

    assertClose(
      report.summary.profitFactor,
      grossProfit
      /
      grossLoss
    );

  }
);
