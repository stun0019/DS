import test from "node:test";
import assert from "node:assert/strict";

import {
  STRATEGY
} from "../assets/js/core/config.js";

import {
  getLongPanelCandidates
} from "../assets/js/panels/longPanel.js";

import {
  getShortPanelCandidates
} from "../assets/js/panels/shortPanel.js";

import {
  runBacktest
} from "../assets/js/replay/replayEngine.js";

import {
  getCandidateSidesForCode
} from "../assets/js/strategy/candidateSelector.js";

import {
  isLongCandidate,
  isShortCandidate
} from "../assets/js/strategy/candidateRules.js";

import {
  calculateLongScore,
  calculateShortScore
} from "../assets/js/strategy/scoring.js";


function createLongStocks(
  count = 20
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
        `L${String(
          index + 1
        ).padStart(
          2,
          "0"
        )}`,
      Name:
        `多方 ${index + 1}`,
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
  count = 20
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
        `S${String(
          index + 1
        ).padStart(
          2,
          "0"
        )}`,
      Name:
        `空方 ${index + 1}`,
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


function createReplayDataset(
  stocks
) {

  return {
    dailySnapshots: [
      {
        date:
          "2026-08-13",
        stocks
      }
    ],
    sessions: [
      {
        date:
          "2026-08-14",
        previousTradingDate:
          "2026-08-13",
        barsByCode: {}
      }
    ]
  };

}


function getReplayCodes(
  report,
  side
) {

  return report.sessions[0].candidates
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


function getCodes(
  stocks
) {

  return stocks.map(
    stock =>
      stock.Code
  );

}


function withCandidateLimit(
  limit,
  callback
) {

  const originalLimit =
    STRATEGY.candidateLimit;


  STRATEGY.candidateLimit =
    limit;


  try {

    callback();

  }

  finally {

    STRATEGY.candidateLimit =
      originalLimit;

  }

}


test(
  "replay selects only the ten highest-scoring long candidates",
  () => {

    withCandidateLimit(
      10,
      () => {

        const stocks =
          createLongStocks();


        const uiCandidates =
          getLongPanelCandidates(
            stocks
          );


        assert.equal(
          stocks.length,
          20
        );

        assert.equal(
          stocks.every(
            isLongCandidate
          ),
          true
        );


        const expectedCodes =
          [...stocks]
          .sort(
            (
              first,
              second
            ) =>
              calculateLongScore(
                second
              )
              -
              calculateLongScore(
                first
              )
          )
          .slice(
            0,
            10
          )
          .map(
            stock =>
              stock.Code
          );


        const report =
          runBacktest(
            createReplayDataset(
              stocks
            )
          );


        assert.deepEqual(
          getCodes(
            uiCandidates
          ),
          expectedCodes
        );

        assert.deepEqual(
          getReplayCodes(
            report,
            "long"
          ),
          expectedCodes
        );

      }
    );

  }
);


test(
  "UI and replay candidate codes are identical",
  () => {

    withCandidateLimit(
      10,
      () => {

        const stocks = [
          ...createLongStocks(),
          ...createShortStocks()
        ];


        const uiLongCodes =
          getCodes(
            getLongPanelCandidates(
              stocks
            )
          );


        const uiShortCodes =
          getCodes(
            getShortPanelCandidates(
              stocks
            )
          );


        const report =
          runBacktest(
            createReplayDataset(
              stocks
            )
          );


        assert.deepEqual(
          getReplayCodes(
            report,
            "long"
          ),
          uiLongCodes
        );

        assert.deepEqual(
          getReplayCodes(
            report,
            "short"
          ),
          uiShortCodes
        );

      }
    );

  }
);


test(
  "replay selects only the ten highest-scoring short candidates",
  () => {

    withCandidateLimit(
      10,
      () => {

        const stocks =
          createShortStocks();


        const uiCandidates =
          getShortPanelCandidates(
            stocks
          );


        assert.equal(
          stocks.length,
          20
        );

        assert.equal(
          stocks.every(
            isShortCandidate
          ),
          true
        );


        const expectedCodes =
          [...stocks]
          .sort(
            (
              first,
              second
            ) =>
              calculateShortScore(
                second
              )
              -
              calculateShortScore(
                first
              )
          )
          .slice(
            0,
            10
          )
          .map(
            stock =>
              stock.Code
          );


        const report =
          runBacktest(
            createReplayDataset(
              stocks
            )
          );


        assert.deepEqual(
          getCodes(
            uiCandidates
          ),
          expectedCodes
        );

        assert.deepEqual(
          getReplayCodes(
            report,
            "short"
          ),
          expectedCodes
        );

      }
    );

  }
);


test(
  "candidateLimit changes UI replay and live selection together",
  () => {

    const stocks = [
      ...createLongStocks(),
      ...createShortStocks()
    ];


    [
      4,
      7
    ].forEach(
      limit => {

        withCandidateLimit(
          limit,
          () => {

            const uiLongCandidates =
              getLongPanelCandidates(
                stocks
              );


            const uiShortCandidates =
              getShortPanelCandidates(
                stocks
              );


            const report =
              runBacktest(
                createReplayDataset(
                  stocks
                )
              );


            assert.equal(
              uiLongCandidates.length,
              limit
            );

            assert.equal(
              uiShortCandidates.length,
              limit
            );

            assert.deepEqual(
              getReplayCodes(
                report,
                "long"
              ),
              getCodes(
                uiLongCandidates
              )
            );

            assert.deepEqual(
              getReplayCodes(
                report,
                "short"
              ),
              getCodes(
                uiShortCandidates
              )
            );


            const selectedLongCode =
              uiLongCandidates[
                limit - 1
              ].Code;


            const selectedShortCode =
              uiShortCandidates[
                limit - 1
              ].Code;


            const selectedLongCodes =
              new Set(
                getCodes(
                  uiLongCandidates
                )
              );


            const selectedShortCodes =
              new Set(
                getCodes(
                  uiShortCandidates
                )
              );


            const excludedLongCode =
              stocks.find(
                stock =>
                  stock.Code.startsWith(
                    "L"
                  )
                  &&
                  !selectedLongCodes.has(
                    stock.Code
                  )
              ).Code;


            const excludedShortCode =
              stocks.find(
                stock =>
                  stock.Code.startsWith(
                    "S"
                  )
                  &&
                  !selectedShortCodes.has(
                    stock.Code
                  )
              ).Code;


            assert.deepEqual(
              getCandidateSidesForCode(
                stocks,
                selectedLongCode
              ),
              [
                "long"
              ]
            );

            assert.deepEqual(
              getCandidateSidesForCode(
                stocks,
                selectedShortCode
              ),
              [
                "short"
              ]
            );

            assert.deepEqual(
              getCandidateSidesForCode(
                stocks,
                excludedLongCode
              ),
              []
            );

            assert.deepEqual(
              getCandidateSidesForCode(
                stocks,
                excludedShortCode
              ),
              []
            );

          }
        );

      }
    );

  }
);
