import test from "node:test";
import assert from "node:assert/strict";

import {
  HISTORICAL_VALIDATION_EVENT,
  HistoricalDatasetBuilder,
  HistoricalDatasetValidationError,
  buildHistoricalReplayDataset
} from "../assets/js/replay/historicalDatasetBuilder.js";

import {
  HISTORICAL_SOURCE_TYPE,
  JsonHistorical5mProvider,
  parseHistorical5mCsv
} from "../assets/js/replay/historical5mProvider.js";

import {
  runBacktest
} from "../assets/js/replay/replayEngine.js";

import {
  getCandidatesBySide
} from "../assets/js/strategy/candidateSelector.js";

import {
  TRADING_CALENDAR_SOURCE
} from "../assets/js/utils/tradingCalendar.js";


function clone(
  value
) {

  return JSON.parse(
    JSON.stringify(
      value
    )
  );

}


function tradingCalendar() {

  return {
    source:
      TRADING_CALENDAR_SOURCE,
    syncStatus:
      "SYNCED",
    coveredYears: [
      2026
    ],
    closedDates: [],
    specialTradingDates: []
  };

}


function createLongStocks(
  prefix,
  count = 12
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
      Code:
        `${prefix}L${String(
          index + 1
        ).padStart(
          2,
          "0"
        )}`,
      Name:
        `${prefix} 多方 ${index + 1}`,
      Market:
        "TWSE",
      OpeningPrice: 100,
      HighestPrice: 112,
      LowestPrice: 98,
      ClosingPrice: 110,
      Change:
        0.5
        +
        index * 0.25,
      TradeVolume:
        1_000_000
        +
        index * 10_000,
      DayTradeEligible: true,
      SellFirstDayTradeAllowed: true
    })
  );

}


function createShortStocks(
  prefix,
  count = 12
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
      Code:
        `${prefix}S${String(
          index + 1
        ).padStart(
          2,
          "0"
        )}`,
      Name:
        `${prefix} 空方 ${index + 1}`,
      Market:
        "TPEX",
      OpeningPrice: 110,
      HighestPrice: 112,
      LowestPrice: 98,
      ClosingPrice: 100,
      Change:
        -0.5
        -
        index * 0.25,
      TradeVolume:
        750_000
        +
        index * 10_000,
      DayTradeEligible: true,
      SellFirstDayTradeAllowed: true
    })
  );

}


function fiveMinuteBar(
  date,
  code,
  overrides = {}
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


function barsForStocks(
  date,
  stocks
) {

  return Object.fromEntries(
    stocks.map(
      stock => [
        stock.Code,
        [
          fiveMinuteBar(
            date,
            stock.Code
          )
        ]
      ]
    )
  );

}


function rawHistoricalInput() {

  const firstStocks = [
    ...createLongStocks(
      "A"
    ),
    ...createShortStocks(
      "A"
    )
  ];

  const secondStocks = [
    ...createLongStocks(
      "B"
    ),
    ...createShortStocks(
      "B"
    )
  ];


  return {
    metadata: {
      sourceType:
        HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA,
      adapter:
        "TEST_ADAPTER",
      tradingCalendar:
        tradingCalendar()
    },
    dailySnapshots: [
      {
        date:
          "2026-08-17",
        stocks:
          firstStocks
      },
      {
        date:
          "2026-08-18",
        stocks:
          secondStocks
      }
    ],
    sessions: [
      {
        date:
          "2026-08-18",
        previousTradingDate:
          "2026-08-17",
        barsByCode:
          barsForStocks(
            "2026-08-18",
            firstStocks
          )
      },
      {
        date:
          "2026-08-19",
        previousTradingDate:
          "2026-08-18",
        barsByCode:
          barsForStocks(
            "2026-08-19",
            secondStocks
          )
      }
    ]
  };

}


function auditCodes(
  audit,
  side
) {

  return audit[side].map(
    candidate =>
      candidate.code
  );

}


function reportCodes(
  report,
  sessionIndex,
  side
) {

  return report.sessions[
    sessionIndex
  ].candidates
  .filter(
    candidate =>
      candidate.side ===
        side
  )
  .map(
    candidate =>
      candidate.code
  );

}


function assertValidationError(
  callback,
  expectedCode
) {

  assert.throws(
    callback,
    error => {

      assert.ok(
        error instanceof
          HistoricalDatasetValidationError
      );

      assert.equal(
        error.code,
        expectedCode
      );

      assert.equal(
        error.validationLogs.length,
        1
      );

      assert.equal(
        error.validationLogs[0].eventType,
        HISTORICAL_VALIDATION_EVENT.SESSION_REJECTED
      );


      return true;

    }
  );

}


test(
  "D-1 snapshot produces D candidates",
  () => {

    const dataset =
      buildHistoricalReplayDataset(
        rawHistoricalInput()
      );


    assert.equal(
      dataset.candidateAudits[0].date,
      "2026-08-18"
    );

    assert.equal(
      dataset.candidateAudits[0].previousTradingDate,
      "2026-08-17"
    );

    assert.ok(
      dataset.candidateAudits[0].long.every(
        candidate =>
          candidate.code.startsWith(
            "A"
          )
      )
    );

    assert.ok(
      dataset.candidateAudits[0].short.every(
        candidate =>
          candidate.code.startsWith(
            "A"
          )
      )
    );

  }
);


test(
  "D snapshot cannot produce D candidates",
  () => {

    const input =
      rawHistoricalInput();

    input.sessions[0].previousTradingDate =
      "2026-08-18";


    assertValidationError(
      () =>
        buildHistoricalReplayDataset(
          input
        ),
      "FUTURE_SNAPSHOT"
    );

  }
);


test(
  "each historical date rebuilds an independent candidate set",
  () => {

    const dataset =
      new HistoricalDatasetBuilder()
      .build(
        rawHistoricalInput()
      );

    const firstCodes = [
      ...auditCodes(
        dataset.candidateAudits[0],
        "long"
      ),
      ...auditCodes(
        dataset.candidateAudits[0],
        "short"
      )
    ];

    const secondCodes = [
      ...auditCodes(
        dataset.candidateAudits[1],
        "long"
      ),
      ...auditCodes(
        dataset.candidateAudits[1],
        "short"
      )
    ];


    assert.notDeepEqual(
      secondCodes,
      firstCodes
    );

    assert.ok(
      firstCodes.every(
        code =>
          code.startsWith(
            "A"
          )
      )
    );

    assert.ok(
      secondCodes.every(
        code =>
          code.startsWith(
            "B"
          )
      )
    );

  }
);


test(
  "replay candidate codes equal the daily builder audit and selector",
  () => {

    const input =
      rawHistoricalInput();

    const dataset =
      buildHistoricalReplayDataset(
        input
      );

    const report =
      runBacktest(
        dataset
      );


    dataset.candidateAudits.forEach(
      (
        audit,
        index
      ) => {

        const selectorCandidates =
          getCandidatesBySide(
            input.dailySnapshots[
              index
            ].stocks.map(
              stock => ({
                ...stock
              })
            )
          );


        [
          "long",
          "short"
        ].forEach(
          side => {

            const selectorCodes =
              selectorCandidates[side].map(
                stock =>
                  stock.Code
              );


            assert.deepEqual(
              auditCodes(
                audit,
                side
              ),
              selectorCodes
            );

            assert.deepEqual(
              reportCodes(
                report,
                index,
                side
              ),
              selectorCodes
            );

          }
        );

      }
    );

  }
);


test(
  "builder audit preserves identical long and short Top10 limits",
  () => {

    const dataset =
      buildHistoricalReplayDataset(
        rawHistoricalInput()
      );


    dataset.candidateAudits.forEach(
      audit => {

        assert.equal(
          audit.long.length,
          10
        );

        assert.equal(
          audit.short.length,
          10
        );

        [
          ...audit.long,
          ...audit.short
        ].forEach(
          candidate => {

            assert.ok(
              Number.isFinite(
                candidate.strategyScore
              )
            );

            assert.ok(
              candidate.liquidityRank > 0
            );

            assert.ok(
              candidate.observation > 0
            );

          }
        );

      }
    );

  }
);


test(
  "missing previousTradingDate rejects the session",
  () => {

    const input =
      rawHistoricalInput();

    delete input.sessions[0].previousTradingDate;


    assertValidationError(
      () =>
        buildHistoricalReplayDataset(
          input
        ),
      "MISSING_PREVIOUS_TRADING_DATE"
    );

  }
);


test(
  "missing 5m data fails closed with an explicit rejection log",
  () => {

    const input =
      rawHistoricalInput();

    input.sessions[0].barsByCode =
      {};


    assertValidationError(
      () =>
        buildHistoricalReplayDataset(
          input
        ),
      "MISSING_5M_DATA"
    );

  }
);


test(
  "future snapshot is rejected before candidate selection",
  () => {

    const input =
      rawHistoricalInput();

    input.sessions[0].previousTradingDate =
      input.sessions[0].date;


    assertValidationError(
      () =>
        buildHistoricalReplayDataset(
          input
        ),
      "FUTURE_SNAPSHOT"
    );

  }
);


test(
  "future candle is rejected",
  () => {

    const input =
      rawHistoricalInput();

    const firstCode =
      input.dailySnapshots[0]
      .stocks[0]
      .Code;

    input.sessions[0]
    .barsByCode[firstCode][0]
    .timestamp =
      "2026-08-19T09:00:00+08:00";


    assertValidationError(
      () =>
        buildHistoricalReplayDataset(
          input
        ),
      "FUTURE_CANDLE"
    );

  }
);


test(
  "unused snapshot at or beyond the last session is rejected",
  () => {

    const input =
      rawHistoricalInput();

    input.dailySnapshots.push(
      {
        date:
          "2026-08-19",
        stocks: [
          ...createLongStocks(
            "FUTURE"
          ),
          ...createShortStocks(
            "FUTURE"
          )
        ]
      }
    );


    assertValidationError(
      () =>
        buildHistoricalReplayDataset(
          input
        ),
      "FUTURE_SNAPSHOT"
    );

  }
);


test(
  "candle completeness timeframe ordering duplication and code are fail closed",
  () => {

    const cases = [
      {
        code:
          "INCOMPLETE_CANDLE",
        mutate:
          (
            input,
            firstCode
          ) => {
            input.sessions[0]
            .barsByCode[firstCode][0]
            .isComplete =
              false;
          }
      },
      {
        code:
          "INVALID_TIMEFRAME",
        mutate:
          (
            input,
            firstCode
          ) => {
            input.sessions[0]
            .barsByCode[firstCode][0]
            .timeframeMinutes =
              1;
          }
      },
      {
        code:
          "DUPLICATE_CANDLE",
        mutate:
          (
            input,
            firstCode
          ) => {
            input.sessions[0]
            .barsByCode[firstCode]
            .push(
              clone(
                input.sessions[0]
                .barsByCode[firstCode][0]
              )
            );
          }
      },
      {
        code:
          "CANDLE_ORDER_REVERSED",
        mutate:
          (
            input,
            firstCode
          ) => {
            input.sessions[0]
            .barsByCode[firstCode]
            .push(
              fiveMinuteBar(
                "2026-08-18",
                firstCode,
                {
                  timestamp:
                    "2026-08-18T08:55:00+08:00"
                }
              )
            );
          }
      },
      {
        code:
          "STOCK_CODE_MISMATCH",
        mutate:
          (
            input,
            firstCode
          ) => {
            input.sessions[0]
            .barsByCode[firstCode][0]
            .code =
              "OTHER";
          }
      }
    ];


    cases.forEach(
      validationCase => {

        const input =
          rawHistoricalInput();

        const firstCode =
          input.dailySnapshots[0]
          .stocks[0]
          .Code;


        validationCase.mutate(
          input,
          firstCode
        );

        assertValidationError(
          () =>
            buildHistoricalReplayDataset(
              input
            ),
          validationCase.code
        );

      }
    );

  }
);


test(
  "historical dataset builder is deterministic for identical input",
  () => {

    const input =
      rawHistoricalInput();

    const builder =
      new HistoricalDatasetBuilder();

    const first =
      builder.build(
        clone(
          input
        )
      );

    const second =
      builder.build(
        clone(
          input
        )
      );


    assert.deepEqual(
      second,
      first
    );

    assert.equal(
      first.metadata.validationStatus,
      "VALIDATED"
    );

    assert.deepEqual(
      first.metadata.historicalStats,
      {
        dataFrom:
          "2026-08-18",
        dataTo:
          "2026-08-19",
        dailySnapshotCount: 2,
        sessionCount: 2,
        fiveMinuteBarCount: 48,
        stockCount: 48
      }
    );

  }
);


test(
  "validated historical data reports daily weekly and monthly performance",
  () => {

    const report =
      runBacktest(
        buildHistoricalReplayDataset(
          rawHistoricalInput()
        )
      );


    assert.equal(
      report.daily.length,
      2
    );

    assert.equal(
      report.weekly.length,
      1
    );

    assert.equal(
      report.monthly.length,
      1
    );

    assert.equal(
      report.weekly[0].candidateCount,
      report.summary.totalCandidates
    );

    assert.equal(
      report.monthly[0].candidateCount,
      report.summary.totalCandidates
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

  }
);


test(
  "JSON and separated CSV records use the same validated contract",
  () => {

    const input = {
      metadata: {
        sourceType:
          HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA
      },
      dailySnapshots: [
        {
          date:
            "2026-08-17",
          stocks: [
            createLongStocks(
              "CSV",
              1
            )[0]
          ]
        }
      ],
      sessions: [
        {
          date:
            "2026-08-18",
          previousTradingDate:
            "2026-08-17",
          barsByCode: {
            CSVL01: [
              fiveMinuteBar(
                "2026-08-18",
                "CSVL01"
              )
            ]
          }
        }
      ]
    };

    const jsonDataset =
      new JsonHistorical5mProvider()
      .toReplayDataset(
        input
      );

    const csv = [
      "sourceType,recordType,snapshotDate,sessionDate,previousTradingDate,code,name,market,openingPrice,highestPrice,lowestPrice,closingPrice,change,tradeVolume,dayTradeEligible,sellFirstDayTradeAllowed,timestamp,timeframeMinutes,isComplete,open,high,low,close,volume",
      "REAL_HISTORICAL_DATA,SNAPSHOT,2026-08-17,,,CSVL01,CSV 多方 1,TWSE,100,112,98,110,0.5,1000000,true,true,,,,,,,,",
      "REAL_HISTORICAL_DATA,BAR,,2026-08-18,2026-08-17,CSVL01,,,,,,,,,,,2026-08-18T09:00:00+08:00,5,true,100,101,99,100,1000"
    ].join(
      "\n"
    );

    const csvDataset =
      parseHistorical5mCsv(
        csv
      );


    assert.equal(
      jsonDataset.metadata.sourceLabel,
      "REAL HISTORICAL DATA"
    );

    assert.equal(
      csvDataset.metadata.sourceLabel,
      "REAL HISTORICAL DATA"
    );

    assert.deepEqual(
      csvDataset.candidateAudits,
      jsonDataset.candidateAudits
    );

    assert.deepEqual(
      csvDataset.metadata.historicalStats,
      jsonDataset.metadata.historicalStats
    );

  }
);
