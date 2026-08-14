import test from "node:test";
import assert from "node:assert/strict";

import {
  HistoricalUniverseBuilder,
  HISTORICAL_UNIVERSE_MODE,
  buildHistoricalUniverse
} from "../assets/js/replay/historicalUniverse.js";

import {
  CallbackHistoricalCompanyUniverseProvider,
  CallbackHistoricalEligibilityProvider,
  HistoricalDailyCollector,
  TpexHistoricalDailyProvider,
  TwseHistoricalDailyProvider
} from "../assets/js/replay/historicalDailyCollector.js";

import {
  CallbackHistoricalIntradayProvider,
  ShioajiHistoricalAdapter
} from "../assets/js/replay/historicalIntradayProvider.js";

import {
  FiveMinuteBarAggregator,
  aggregateOneMinuteBarsToFiveMinutes
} from "../assets/js/replay/fiveMinuteBarAggregator.js";

import {
  HistoricalAutoBacktestPipeline,
  getHistoricalTradingDates
} from "../assets/js/replay/historicalAutoBacktest.js";

import {
  InMemoryHistoricalCache,
  createHistoricalCacheKey
} from "../assets/js/replay/historicalCache.js";

import {
  buildHistoricalReplayDataset
} from "../assets/js/replay/historicalDatasetBuilder.js";

import {
  getCandidatesBySide
} from "../assets/js/strategy/candidateSelector.js";

import {
  HISTORICAL_SOURCE_TYPE
} from "../assets/js/replay/historical5mProvider.js";

import {
  REPLAY_DATA_MODE,
  createReplayUiState,
  getReplayDataSourceState,
  paginateReplayRows,
  resolveReplayControlRange
} from "../assets/js/replay/replayUiState.js";

import {
  TRADING_CALENDAR_SOURCE,
  getPreviousTradingDate
} from "../assets/js/utils/tradingCalendar.js";


function calendar(
  closedDates = []
) {

  return {
    source:
      TRADING_CALENDAR_SOURCE,
    syncStatus:
      "SYNCED",
    coveredYears: [
      "2026"
    ],
    closedDates,
    specialTradingDates: []
  };

}


function equity(
  code,
  market,
  side,
  index = 0
) {

  const isLong =
    side ===
      "long";


  return {
    Code:
      code,
    Name:
      `${market} ${side} ${index}`,
    Market:
      market,
    MarketName:
      market ===
        "TWSE"

        ? "上市"

        : "上櫃",
    Industry: "半導體業",
    IndustryCode: "24",
    OpeningPrice:
      isLong

        ? 100

        : 110,
    HighestPrice: 112,
    LowestPrice: 98,
    ClosingPrice:
      isLong

        ? 110

        : 100,
    Change:
      isLong

        ? 0.5 + index * 0.25

        : -0.5 - index * 0.25,
    TradeVolume:
      2_000_000 + index * 10_000,
    DayTradeEligible: true,
    SellFirstDayTradeAllowed: true
  };

}


function equityUniverse() {

  return [
    ...Array.from(
      {
        length: 12
      },
      (
        _,
        index
      ) =>
        equity(
          `TW${String(index + 1).padStart(2, "0")}`,
          "TWSE",
          "long",
          index
        )
    ),
    ...Array.from(
      {
        length: 12
      },
      (
        _,
        index
      ) =>
        equity(
          `TP${String(index + 1).padStart(2, "0")}`,
          "TPEX",
          "short",
          index
        )
    )
  ];

}


function fiveMinuteBar(
  code,
  date,
  overrides =
    {}
) {

  return {
    code,
    timestamp:
      `${date}T09:00:00+08:00`,
    timeframeMinutes: 5,
    isComplete: true,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1000,
    ...overrides
  };

}


function oneMinuteBars(
  code,
  date,
  count = 5
) {

  return Array.from(
    {
      length:
        count
    },
    (
      _,
      index
    ) => ({
      code,
      timestamp:
        `${date}T09:0${index}:00+08:00`,
      timeframeMinutes: 1,
      isComplete: true,
      open:
        100 + index,
      high:
        102 + index,
      low:
        99 + index,
      close:
        101 + index,
      volume:
        100 + index
    })
  );

}


function createFixture(
  {
    missingDaily =
      false,
    missingIntradayCode =
      null,
    oneMinuteCount =
      null,
    cache =
      new InMemoryHistoricalCache(),
    closedDates =
      []
  } =
    {}
) {

  const stocks =
    equityUniverse();

  const etf = {
    ...equity(
      "0050",
      "TWSE",
      "long",
      20
    ),
    Name: "元大台灣50 ETF"
  };

  const warrant = {
    ...equity(
      "WARRANT",
      "TPEX",
      "short",
      20
    ),
    Name: "測試權證"
  };

  const dailyCalls = [];
  const intradayCalls = [];
  const eligibilityCalls = [];

  const dailyLoader =
    async (
      {
        date,
        market,
        source
      }
    ) => {

      dailyCalls.push(
        {
          date,
          market
        }
      );


      if (
        missingDaily
        &&
        market ===
          "TWSE"
      ) {

        return null;

      }


      return {
        date,
        market,
        source,
        volumeMode:
          "TRADE_VOLUME_SHARES",
        stocks: [
          ...stocks.filter(
            stock =>
              stock.Market ===
                market
          ),
          ...(
            market ===
              "TWSE"

              ? [
                  etf
                ]

              : [
                  warrant
                ]
          )
        ]
      };

    };

  const companyUniverseProvider =
    new CallbackHistoricalCompanyUniverseProvider(
      {
        loadCompanyEquities:
          async (
            {
              date,
              market
            }
          ) => ({
            date,
            market,
            validated: true,
            codes:
              stocks.filter(
                stock =>
                  stock.Market ===
                    market
              )
              .map(
                stock =>
                  stock.Code
              )
          })
      }
    );

  const dailyCollector =
    new HistoricalDailyCollector(
      {
        twseProvider:
          new TwseHistoricalDailyProvider(
            {
              loadDaily:
                dailyLoader
            }
          ),
        tpexProvider:
          new TpexHistoricalDailyProvider(
            {
              loadDaily:
                dailyLoader
            }
          ),
        companyUniverseProvider
      }
    );

  const eligibilityProvider =
    new CallbackHistoricalEligibilityProvider(
      {
        loadEligibility:
          async (
            {
              date,
              market
            }
          ) => {

            eligibilityCalls.push(
              {
                date,
                market
              }
            );


            return {
              date,
              market,
              validated: true,
              entries:
                stocks.filter(
                  stock =>
                    stock.Market ===
                      market
                )
                .map(
                  stock => ({
                    Code:
                      stock.Code,
                    DayTradeEligible:
                      stock.DayTradeEligible,
                    SellFirstDayTradeAllowed:
                      stock.SellFirstDayTradeAllowed
                  })
                )
            };

          }
      }
    );

  const intradayProvider =
    new CallbackHistoricalIntradayProvider(
      {
        source:
          "TEST_INTRADAY",
        loadBars:
          async request => {

            intradayCalls.push(
              {
                ...request
              }
            );


            if (
              request.code ===
                missingIntradayCode
            ) {

              return {
                timeframeMinutes: 5,
                bars: []
              };

            }


            if (
              oneMinuteCount !==
                null
            ) {

              return {
                timeframeMinutes: 1,
                bars:
                  oneMinuteBars(
                    request.code,
                    request.date,
                    oneMinuteCount
                  )
              };

            }


            return {
              timeframeMinutes: 5,
              bars: [
                fiveMinuteBar(
                  request.code,
                  request.date
                )
              ]
            };

          }
      }
    );

  const pipeline =
    new HistoricalAutoBacktestPipeline(
      {
        dailyCollector,
        universeBuilder:
          new HistoricalUniverseBuilder(),
        eligibilityProvider,
        intradayProvider,
        fiveMinuteAggregator:
          new FiveMinuteBarAggregator(),
        cache
      }
    );


  return {
    stocks,
    etf,
    warrant,
    dailyCollector,
    dailyCalls,
    intradayCalls,
    eligibilityCalls,
    pipeline,
    calendar:
      calendar(
        closedDates
      )
  };

}


async function runFixture(
  fixture,
  date =
    "2026-08-18"
) {

  return fixture.pipeline.run(
    {
      fromDate:
        date,
      toDate:
        date,
      tradingCalendar:
        fixture.calendar
    }
  );

}


test(
  "ETF ETN warrant and non-company securities are excluded before candidates",
  () => {

    const result =
      buildHistoricalUniverse(
        {
          date: "2026-08-17",
          marketStocks: {
            TWSE: [
              equity("2330", "TWSE", "long"),
              equity("0050", "TWSE", "long"),
              equity("02001L", "TWSE", "long")
            ],
            TPEX: [
              equity("8069", "TPEX", "short"),
              equity("WARRANT", "TPEX", "short")
            ]
          },
          companyEquityWhitelists: {
            TWSE: {
              date: "2026-08-17",
              market: "TWSE",
              validated: true,
              codes: [
                "2330"
              ]
            },
            TPEX: {
              date: "2026-08-17",
              market: "TPEX",
              validated: true,
              codes: [
                "8069"
              ]
            }
          }
        }
      );


    assert.deepEqual(
      result.stocks.map(
        stock =>
          stock.Code
      ),
      [
        "2330",
        "8069"
      ]
    );

  }
);


test(
  "TWSE company equity remains in the historical universe",
  () => {

    const fixture =
      createFixture();

    const result =
      buildHistoricalUniverse(
        {
          date: "2026-08-17",
          marketStocks: {
            TWSE:
              fixture.stocks.filter(stock => stock.Market === "TWSE"),
            TPEX:
              fixture.stocks.filter(stock => stock.Market === "TPEX")
          },
          companyEquityWhitelists: {
            TWSE: {
              date: "2026-08-17",
              market: "TWSE",
              validated: true,
              codes:
                fixture.stocks.filter(stock => stock.Market === "TWSE").map(stock => stock.Code)
            },
            TPEX: {
              date: "2026-08-17",
              market: "TPEX",
              validated: true,
              codes:
                fixture.stocks.filter(stock => stock.Market === "TPEX").map(stock => stock.Code)
            }
          }
        }
      );


    assert.ok(
      result.stocks.some(
        stock =>
          stock.Code ===
            "TW01"
        &&
          stock.Market ===
            "TWSE"
      )
    );

  }
);


test(
  "TPEx company equity remains in the historical universe",
  async () => {

    const result =
      await runFixture(
        createFixture()
      );


    assert.ok(
      result.dataset.dailySnapshots[0].stocks.some(
        stock =>
          stock.Code ===
            "TP01"
        &&
          stock.Market ===
            "TPEX"
      )
    );

  }
);


test(
  "historical universe is the exact official daily and company whitelist intersection",
  async () => {

    const fixture =
      createFixture();

    const result =
      await runFixture(
        fixture
      );


    assert.deepEqual(
      result.dataset.dailySnapshots[0].stocks.map(stock => stock.Code).sort(),
      fixture.stocks.map(stock => stock.Code).sort()
    );

    assert.equal(
      result.dataset.metadata.universeMode,
      HISTORICAL_UNIVERSE_MODE
    );

  }
);


test(
  "unvalidated REAL universe fails closed",
  () => {

    const twse =
      equity("2330", "TWSE", "long");

    const tpex =
      equity("8069", "TPEX", "short");


    assert.throws(
      () =>
        buildHistoricalReplayDataset(
          {
            metadata: {
              sourceType:
                HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA
            },
            dailySnapshots: [
              {
                date: "2026-08-17",
                stocks: [
                  twse,
                  tpex
                ]
              }
            ],
            sessions: [
              {
                date: "2026-08-18",
                previousTradingDate: "2026-08-17",
                barsByCode: {
                  2330: [
                    fiveMinuteBar("2330", "2026-08-18")
                  ],
                  8069: [
                    fiveMinuteBar("8069", "2026-08-18")
                  ]
                }
              }
            ]
          }
        ),
      error =>
        error.code ===
          "UNIVERSE_NOT_VALIDATED"
    );

  }
);


test(
  "D-1 official daily data produces D candidates",
  async () => {

    const result =
      await runFixture(
        createFixture()
      );


    assert.equal(
      result.dataset.candidateAudits[0].date,
      "2026-08-18"
    );

    assert.equal(
      result.dataset.candidateAudits[0].previousTradingDate,
      "2026-08-17"
    );

  }
);


test(
  "weekend and holiday resolve the actual previous trading date",
  () => {

    const schedule =
      calendar(
        [
          "2026-08-14"
        ]
      );


    assert.equal(
      getPreviousTradingDate(
        "2026-08-17",
        schedule
      ),
      "2026-08-13"
    );

    assert.deepEqual(
      getHistoricalTradingDates(
        {
          fromDate: "2026-08-14",
          toDate: "2026-08-17",
          tradingCalendar:
            schedule
        }
      ),
      [
        "2026-08-17"
      ]
    );

  }
);


test(
  "D daily data is never requested to select D candidates",
  async () => {

    const fixture =
      createFixture();

    await runFixture(
      fixture
    );


    assert.deepEqual(
      new Set(
        fixture.dailyCalls.map(
          call =>
            call.date
        )
      ),
      new Set(
        [
          "2026-08-17"
        ]
      )
    );

  }
);


test(
  "intraday provider is called only for shared-selector candidates",
  async () => {

    const fixture =
      createFixture();

    const expected =
      getCandidatesBySide(
        fixture.stocks
      );

    await runFixture(
      fixture
    );

    const expectedCodes =
      new Set(
        [
          ...expected.long,
          ...expected.short
        ].map(
          stock =>
            stock.Code
        )
      );


    assert.deepEqual(
      new Set(fixture.intradayCalls.map(call => call.code)),
      expectedCodes
    );

  }
);


test(
  "non-candidates never trigger intraday requests",
  async () => {

    const fixture =
      createFixture();

    await runFixture(
      fixture
    );

    const requested =
      new Set(
        fixture.intradayCalls.map(
          call =>
            call.code
        )
      );


    assert.equal(requested.has("TW01"), false);
    assert.equal(requested.has("TP01"), false);
    assert.equal(requested.has("0050"), false);
    assert.equal(requested.has("WARRANT"), false);

  }
);


test(
  "1m to 5m aggregation calculates exact OHLCV",
  () => {

    const bars =
      aggregateOneMinuteBarsToFiveMinutes(
        oneMinuteBars(
          "2330",
          "2026-08-18"
        ),
        {
          expectedDate:
            "2026-08-18"
        }
      );


    assert.deepEqual(
      bars[0],
      {
        code: "2330",
        timestamp: "2026-08-18T09:00:00+08:00",
        timeframeMinutes: 5,
        isComplete: true,
        open: 100,
        high: 106,
        low: 99,
        close: 105,
        volume: 510,
        sourceBarCount: 5
      }
    );

  }
);


test(
  "incomplete 5m buckets remain incomplete",
  () => {

    const bars =
      aggregateOneMinuteBarsToFiveMinutes(
        oneMinuteBars(
          "2330",
          "2026-08-18",
          4
        ),
        {
          expectedDate:
            "2026-08-18"
        }
      );


    assert.equal(
      bars[0].isComplete,
      false
    );

  }
);


test(
  "UTC intraday timestamps are bucketed by Asia Taipei date",
  () => {

    const bars =
      oneMinuteBars(
        "2330",
        "2026-08-18"
      )
      .map(
        (
          bar,
          index
        ) => ({
          ...bar,
          timestamp:
            `2026-08-18T01:0${index}:00Z`
        })
      );

    const result =
      aggregateOneMinuteBarsToFiveMinutes(
        bars,
        {
          expectedDate:
            "2026-08-18"
        }
      );


    assert.equal(
      result[0].timestamp,
      "2026-08-18T09:00:00+08:00"
    );

  }
);


test(
  "auto backtest is deterministic for the same range and inputs",
  async () => {

    const first =
      await runFixture(
        createFixture()
      );

    const second =
      await runFixture(
        createFixture()
      );


    assert.deepEqual(
      second.dataset,
      first.dataset
    );

    assert.deepEqual(
      second.report,
      first.report
    );

  }
);


test(
  "missing official daily data fails closed",
  async () => {

    await assert.rejects(
      () =>
        runFixture(
          createFixture(
            {
              missingDaily: true
            }
          )
        ),
      error =>
        error.code ===
          "MISSING_MARKET_DAILY_DATA"
    );

  }
);


test(
  "missing candidate intraday data fails closed",
  async () => {

    await assert.rejects(
      () =>
        runFixture(
          createFixture(
            {
              missingIntradayCode:
                "TW12"
            }
          )
        ),
      error =>
        error.code ===
          "MISSING_CANDIDATE_5M_DATA"
    );

  }
);


test(
  "incomplete aggregated candidate bars fail closed before Replay",
  async () => {

    await assert.rejects(
      () =>
        runFixture(
          createFixture(
            {
              oneMinuteCount: 4
            }
          )
        ),
      error =>
        error.code ===
          "INVALID_CANDIDATE_5M_DATA"
    );

  }
);


test(
  "collector never creates a future snapshot",
  async () => {

    const fixture =
      createFixture();

    const result =
      await runFixture(
        fixture
      );


    result.dataset.sessions.forEach(
      session => {

        assert.ok(
          session.previousTradingDate <
            session.date
        );

      }
    );

    assert.equal(
      fixture.dailyCalls.some(
        call =>
          call.date >=
            "2026-08-18"
      ),
      false
    );

  }
);


test(
  "Replay candidates equal historical candidate audit and shared selector",
  async () => {

    const fixture =
      createFixture();

    const result =
      await runFixture(
        fixture
      );

    const expected =
      getCandidatesBySide(
        result.dataset.dailySnapshots[0].stocks
      );

    const audit =
      result.dataset.candidateAudits[0];

    const auditCodes =
      [
        ...audit.long,
        ...audit.short
      ].map(candidate => candidate.code).sort();

    const replayCodes =
      result.report.sessions[0].candidates.map(candidate => candidate.code).sort();

    const expectedCodes =
      [
        ...expected.long,
        ...expected.short
      ].map(stock => stock.Code).sort();


    assert.deepEqual(replayCodes, auditCodes);
    assert.deepEqual(auditCodes, expectedCodes);

  }
);


test(
  "daily collector accepts from and to and skips non-trading dates",
  async () => {

    const fixture =
      createFixture();

    const results =
      await fixture.dailyCollector.collectRange(
        {
          fromDate: "2026-08-14",
          toDate: "2026-08-17",
          tradingCalendar:
            fixture.calendar
        }
      );


    assert.deepEqual(
      results.map(result => result.date),
      [
        "2026-08-14",
        "2026-08-17"
      ]
    );

  }
);


test(
  "historical cache prevents repeated daily and intraday fetches",
  async () => {

    const fixture =
      createFixture();

    await runFixture(fixture);

    const dailyCount =
      fixture.dailyCalls.length;

    const intradayCount =
      fixture.intradayCalls.length;

    await runFixture(fixture);


    assert.equal(fixture.dailyCalls.length, dailyCount);
    assert.equal(fixture.intradayCalls.length, intradayCount);

  }
);


test(
  "auto backtest publishes the documented progress stages",
  async () => {

    const fixture =
      createFixture();

    const stages = [];

    fixture.pipeline.onProgress =
      progress =>
        stages.push(
          progress.stage
        );

    await runFixture(
      fixture
    );


    [
      "PREPARING",
      "FETCHING_DAILY",
      "BUILDING_UNIVERSE",
      "SELECTING_CANDIDATES",
      "FETCHING_INTRADAY",
      "BUILDING_5M",
      "VALIDATING_DATASET",
      "RUNNING_REPLAY",
      "COMPLETED"
    ].forEach(
      stage =>
        assert.ok(
          stages.includes(stage),
          `${stage} was not published`
        )
    );

  }
);


test(
  "Shioaji adapter contains no credential and fails closed without a server bridge",
  async () => {

    const adapter =
      new ShioajiHistoricalAdapter();


    assert.deepEqual(
      Object.keys(adapter),
      [
        "requestKbars"
      ]
    );

    await assert.rejects(
      () =>
        adapter.getBars(
          {
            code: "2330",
            date: "2026-08-18",
            timeframeMinutes: 5
          }
        ),
      error =>
        error.code ===
          "SHIOAJI_ADAPTER_NOT_CONFIGURED"
    );

  }
);


test(
  "historical cache keys include every required isolation field",
  () => {

    const key =
      createHistoricalCacheKey(
        {
          date: "2026-08-18",
          market: "TWSE",
          code: "2330",
          timeframe: "5m",
          source: "SHIOAJI",
          volumeMode: "TRADE_VOLUME_SHARES"
        }
      );


    [
      "date=2026-08-18",
      "market=TWSE",
      "code=2330",
      "timeframe=5m",
      "source=SHIOAJI",
      "volumeMode=TRADE_VOLUME_SHARES"
    ].forEach(
      part =>
        assert.ok(
          key.includes(part)
        )
    );

  }
);


test(
  "Replay control range state is a deterministic pure function",
  () => {

    assert.deepEqual(
      resolveReplayControlRange(
        {
          mode: "week",
          sessionDates: [
            "2026-08-18",
            "2026-08-17"
          ]
        }
      ),
      {
        from: "2026-08-17",
        to: "2026-08-18"
      }
    );

    assert.equal(
      createReplayUiState(
        {
          dataMode: "invalid"
        }
      ).dataMode,
      REPLAY_DATA_MODE.AUTO
    );

  }
);


test(
  "Replay data source state cannot spoof SAMPLE as REAL",
  () => {

    const sample =
      getReplayDataSourceState(
        {
          dataset: {
            metadata: {
              sourceType:
                HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK,
              sourceLabel:
                "REAL HISTORICAL DATA"
            }
          }
        }
      );


    assert.equal(sample.sourceLabel, "SAMPLE / MOCK");
    assert.equal(sample.universeValidated, false);

  }
);


test(
  "Replay table pagination bounds large result sets",
  () => {

    const page =
      paginateReplayRows(
        Array.from(
          {
            length: 125
          },
          (_, index) => index
        ),
        3,
        50
      );


    assert.equal(page.rows.length, 25);
    assert.equal(page.totalPages, 3);
    assert.equal(page.currentPage, 3);

  }
);
