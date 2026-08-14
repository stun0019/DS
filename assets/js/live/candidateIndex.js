import {
  STRATEGY
} from "../core/config.js";

import {
  getCandidatesBySide
} from "../strategy/candidateSelector.js";


function getStrategySignature() {

  return JSON.stringify(
    STRATEGY
  );

}


function addCandidates(
  candidateIndex,
  stocks,
  side
) {

  stocks.forEach(
    stock => {

      const code =
        String(
          stock?.Code
          ??
          ""
        );


      if (
        !code
      ) {

        return;

      }


      if (
        !candidateIndex.has(
          code
        )
      ) {

        candidateIndex.set(
          code,
          new Set()
        );

      }


      candidateIndex.get(
        code
      ).add(
        side
      );

    }
  );

}


export function createLiveCandidateIndex(
  {
    selectCandidates =
      getCandidatesBySide
  } = {}
) {

  let candidateIndex =
    new Map();


  let indexedStocks =
    null;


  let indexedStrategySignature =
    null;


  function rebuild(
    stocks,
    strategySignature =
      getStrategySignature()
  ) {

    const candidates =
      selectCandidates(
        stocks
      )
      ??
      {};


    const nextCandidateIndex =
      new Map();


    addCandidates(
      nextCandidateIndex,
      Array.isArray(
        candidates.long
      )

        ? candidates.long

        : [],
      "long"
    );


    addCandidates(
      nextCandidateIndex,
      Array.isArray(
        candidates.short
      )

        ? candidates.short

        : [],
      "short"
    );


    candidateIndex =
      nextCandidateIndex;

    indexedStocks =
      stocks;

    indexedStrategySignature =
      strategySignature;


    return candidateIndex;

  }


  function refreshIfNeeded(
    stocks
  ) {

    const strategySignature =
      getStrategySignature();


    if (
      stocks ===
        indexedStocks
      &&
      strategySignature ===
        indexedStrategySignature
    ) {

      return false;

    }


    rebuild(
      stocks,
      strategySignature
    );


    return true;

  }


  function get(
    code
  ) {

    return candidateIndex.get(
      String(
        code
        ??
        ""
      )
    )
    ??
    null;

  }


  function entries() {

    return candidateIndex.entries();

  }


  return {
    rebuild,
    refreshIfNeeded,
    get,
    entries
  };

}
