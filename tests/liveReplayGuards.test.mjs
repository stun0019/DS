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
  runBacktest
} from "../assets/js/replay/replayEngine.js";

import {
  applyReplaySlippage
} from "../assets/js/replay/slippage.js";

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


test(
  "stale candidate data cannot reach live entry ready",
  () => {

    const freshness =
      evaluateCandidateDataFreshness(
        {
          tradeDateISO: "2026-08-13",
          updatedAt: "2026-08-14 08:15:22",
          syncStatus: "SYNCED"
        },
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
  "explicit latest trading-day confirmation allows live signals across calendar gaps",
  () => {

    const freshness =
      evaluateCandidateDataFreshness(
        {
          tradeDateISO: "2026-08-13",
          updatedAt: "2026-08-14 08:15:22",
          syncStatus: "SYNCED",
          validForTradingDate: "2026-08-17"
        },
        "2026-08-17"
      );


    assert.equal(
      freshness.status,
      CANDIDATE_DATA_STATUS.FRESH
    );


    const states =
      applyBarsWithFreshness(
        freshness
      );


    assert.equal(
      states.at(-1).status,
      LIVE_STATUS.ENTRY_READY
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

  }
);


test(
  "historical providers cannot confuse mock and real source labels",
  () => {

    const baseDataset = {
      dailySnapshots: [],
      sessions: []
    };


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
        {
          ...baseDataset,
          metadata: {
            sourceType:
              HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA
          }
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
      "sourceType,sessionDate,previousTradingDate,code,name,market,openingPrice,highestPrice,lowestPrice,closingPrice,change,tradeVolume,dayTradeEligible,sellFirstDayTradeAllowed,timestamp,timeframeMinutes,isComplete,open,high,low,close,volume",
      "REAL_HISTORICAL_DATA,2026-08-18,2026-08-17,2330,台積電,TWSE,104,110,100,109,5,2000000,true,true,2026-08-18T09:00:00+08:00,5,true,110,112,109,111.5,1800"
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
