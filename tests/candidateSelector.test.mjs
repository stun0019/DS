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
  getCandidatesBySide,
  getLongCandidates,
  getShortCandidates
} from "../assets/js/strategy/candidateSelector.js";

import {
  createLiveCandidateIndex
} from "../assets/js/live/candidateIndex.js";

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


function getIndexCodes(
  candidateIndex,
  side
) {

  return Array.from(
    candidateIndex.entries()
  )
  .filter(
    (
      [
        ,
        sides
      ]
    ) =>
      sides.has(
        side
      )
  )
  .map(
    (
      [
        code
      ]
    ) =>
      code
  )
  .sort();

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


    const liveCandidateIndex =
      createLiveCandidateIndex();


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


            liveCandidateIndex.refreshIfNeeded(
              stocks
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
              Array.from(
                liveCandidateIndex.get(
                  selectedLongCode
                )
              ),
              [
                "long"
              ]
            );

            assert.deepEqual(
              Array.from(
                liveCandidateIndex.get(
                  selectedShortCode
                )
              ),
              [
                "short"
              ]
            );

            assert.equal(
              liveCandidateIndex.get(
                excludedLongCode
              ),
              null
            );

            assert.equal(
              liveCandidateIndex.get(
                excludedShortCode
              ),
              null
            );

          }
        );

      }
    );

  }
);


test(
  "live candidate index codes match the shared candidate selector",
  () => {

    withCandidateLimit(
      10,
      () => {

        const stocks = [
          ...createLongStocks(),
          ...createShortStocks()
        ];


        const candidateIndex =
          createLiveCandidateIndex();


        candidateIndex.rebuild(
          stocks
        );


        assert.deepEqual(
          getIndexCodes(
            candidateIndex,
            "long"
          ),
          getCodes(
            getLongCandidates(
              stocks
            )
          ).sort()
        );

        assert.deepEqual(
          getIndexCodes(
            candidateIndex,
            "short"
          ),
          getCodes(
            getShortCandidates(
              stocks
            )
          ).sort()
        );

      }
    );

  }
);


test(
  "quote bursts do not rerun the candidate selector",
  () => {

    withCandidateLimit(
      10,
      () => {

        const stocks = [
          ...createLongStocks(),
          ...createShortStocks()
        ];


        let selectorCalls =
          0;


        const candidateIndex =
          createLiveCandidateIndex(
            {
              selectCandidates(
                sourceStocks
              ) {

                selectorCalls +=
                  1;


                return getCandidatesBySide(
                  sourceStocks
                );

              }
            }
          );


        candidateIndex.rebuild(
          stocks
        );


        for (
          let index = 0;
          index < 10_000;
          index += 1
        ) {

          assert.equal(
            candidateIndex.refreshIfNeeded(
              stocks
            ),
            false
          );


          candidateIndex.get(
            stocks[
              index
              %
              stocks.length
            ].Code
          );

        }


        assert.equal(
          selectorCalls,
          1
        );


        STRATEGY.candidateLimit =
          9;


        assert.equal(
          candidateIndex.refreshIfNeeded(
            stocks
          ),
          true
        );

        assert.equal(
          selectorCalls,
          2
        );

        assert.equal(
          candidateIndex.refreshIfNeeded(
            stocks
          ),
          false
        );

        assert.equal(
          selectorCalls,
          2
        );

      }
    );

  }
);


test(
  "reloading stock data refreshes the live candidate index",
  () => {

    withCandidateLimit(
      10,
      () => {

        const firstStocks = [
          ...createLongStocks(),
          ...createShortStocks()
        ];


        const reloadedStocks = [
          ...createLongStocks().map(
            stock => ({
              ...stock,
              Code:
                stock.Code.replace(
                  "L",
                  "N"
                )
            })
          ),
          ...createShortStocks().map(
            stock => ({
              ...stock,
              Code:
                stock.Code.replace(
                  "S",
                  "T"
                )
            })
          )
        ];


        let selectorCalls =
          0;


        const candidateIndex =
          createLiveCandidateIndex(
            {
              selectCandidates(
                stocks
              ) {

                selectorCalls +=
                  1;


                return getCandidatesBySide(
                  stocks
                );

              }
            }
          );


        candidateIndex.rebuild(
          firstStocks
        );


        const firstLongCode =
          getLongCandidates(
            firstStocks
          )[0].Code;


        assert.deepEqual(
          Array.from(
            candidateIndex.get(
              firstLongCode
            )
          ),
          [
            "long"
          ]
        );


        candidateIndex.rebuild(
          reloadedStocks
        );


        assert.equal(
          selectorCalls,
          2
        );

        assert.equal(
          candidateIndex.get(
            firstLongCode
          ),
          null
        );

        assert.deepEqual(
          getIndexCodes(
            candidateIndex,
            "long"
          ),
          getCodes(
            getLongCandidates(
              reloadedStocks
            )
          ).sort()
        );

        assert.deepEqual(
          getIndexCodes(
            candidateIndex,
            "short"
          ),
          getCodes(
            getShortCandidates(
              reloadedStocks
            )
          ).sort()
        );

      }
    );

  }
);
