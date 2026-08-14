import {
  STRATEGY
} from "../core/config.js";

import {
  assignLiquidityRanks
} from "../data/stockData.js";

import {
  isLongCandidate,
  isShortCandidate
} from "./candidateRules.js";

import {
  calculateLongScore,
  calculateShortScore
} from "./scoring.js";


function prepareStocks(
  stocks
) {

  const preparedStocks =
    Array.isArray(
      stocks
    )

      ? stocks.filter(
          stock =>
            stock
            &&
            typeof stock ===
              "object"
        )

      : [];


  assignLiquidityRanks(
    preparedStocks
  );


  return preparedStocks;

}


function getCandidateLimit() {

  const limit =
    Number(
      STRATEGY.candidateLimit
    );


  if (
    !Number.isFinite(
      limit
    )
    ||
    limit <= 0
  ) {

    return 0;

  }


  return Math.floor(
    limit
  );

}


function selectCandidates(
  stocks,
  isCandidate,
  calculateScore
) {

  return stocks
    .filter(
      isCandidate
    )
    .map(
      (
        stock,
        sourceIndex
      ) => ({
        stock,
        sourceIndex,
        score:
          calculateScore(
            stock
          )
      })
    )
    .sort(
      (
        first,
        second
      ) =>

        second.score
        -
        first.score

        ||

        first.sourceIndex
        -
        second.sourceIndex
    )
    .slice(
      0,
      getCandidateLimit()
    )
    .map(
      candidate =>
        candidate.stock
    );

}


function selectPreparedCandidates(
  stocks
) {

  return {
    long:
      selectCandidates(
        stocks,
        isLongCandidate,
        calculateLongScore
      ),
    short:
      selectCandidates(
        stocks,
        isShortCandidate,
        calculateShortScore
      )
  };

}


export function getLongCandidates(
  stocks
) {

  return selectCandidates(
    prepareStocks(
      stocks
    ),
    isLongCandidate,
    calculateLongScore
  );

}


export function getShortCandidates(
  stocks
) {

  return selectCandidates(
    prepareStocks(
      stocks
    ),
    isShortCandidate,
    calculateShortScore
  );

}


export function getCandidatesBySide(
  stocks
) {

  return selectPreparedCandidates(
    prepareStocks(
      stocks
    )
  );

}


export function getCandidateSidesForCode(
  stocks,
  code
) {

  const targetCode =
    String(
      code
      ??
      ""
    );


  if (
    !targetCode
  ) {

    return [];

  }


  const candidates =
    getCandidatesBySide(
      stocks
    );


  return [
    candidates.long.some(
      stock =>
        String(
          stock.Code
          ??
          ""
        ) ===
        targetCode
    )

      ? "long"

      : null,
    candidates.short.some(
      stock =>
        String(
          stock.Code
          ??
          ""
        ) ===
        targetCode
    )

      ? "short"

      : null
  ]
  .filter(
    Boolean
  );

}
