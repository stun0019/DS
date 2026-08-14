import {
  STRATEGY
} from "../core/config.js";

import {
  clamp
} from "../utils/number.js";

import {
  calculateChangePercent,
  calculateBodyRatio,
  calculateClosePosition,
  calculateAmplitude
} from "./candidateRules.js";


export function liquidityScore(
  stock
) {

  const rank =
    stock.__liquidityRank
    ||
    999999;


  if (
    rank >
    STRATEGY.liquidityPoolSize
  ) {

    return 0;

  }


  const maxIndex =
    Math.max(
      1,
      STRATEGY.liquidityPoolSize
      -
      1
    );


  return (

    STRATEGY.weights.liquidity

    *

    (
      1
      -
      (
        rank
        -
        1
      )
      /
      maxIndex
    )

  );

}


export function calculateLongScore(
  stock
) {

  const change =
    calculateChangePercent(
      stock
    );


  const body =
    calculateBodyRatio(
      stock
    );


  const closePosition =
    calculateClosePosition(
      stock
    );


  const amplitude =
    calculateAmplitude(
      stock
    );


  const scoreLiquidity =
    liquidityScore(
      stock
    );


  const scoreChange =

    clamp(
      change
      /
      5,
      0,
      1
    )

    *

    STRATEGY.weights.change;


  const scoreBody =

    clamp(
      body,
      0,
      1
    )

    *

    STRATEGY.weights.body;


  const scoreClose =

    closePosition

    *

    STRATEGY.weights.closePosition;


  const scoreAmplitude =

    clamp(
      amplitude
      /
      6,
      0,
      1
    )

    *

    STRATEGY.weights.amplitude;


  return Math.round(

    clamp(

      scoreLiquidity
      +
      scoreChange
      +
      scoreBody
      +
      scoreClose
      +
      scoreAmplitude,

      0,

      100

    )

  );

}


export function calculateShortScore(
  stock
) {

  const change =
    calculateChangePercent(
      stock
    );


  const body =
    calculateBodyRatio(
      stock
    );


  const closePosition =
    calculateClosePosition(
      stock
    );


  const amplitude =
    calculateAmplitude(
      stock
    );


  const scoreLiquidity =
    liquidityScore(
      stock
    );


  const scoreChange =

    clamp(
      -change
      /
      5,
      0,
      1
    )

    *

    STRATEGY.weights.change;


  const scoreBody =

    clamp(
      -body,
      0,
      1
    )

    *

    STRATEGY.weights.body;


  const scoreClose =

    (
      1
      -
      closePosition
    )

    *

    STRATEGY.weights.closePosition;


  const scoreAmplitude =

    clamp(
      amplitude
      /
      6,
      0,
      1
    )

    *

    STRATEGY.weights.amplitude;


  return Math.round(

    clamp(

      scoreLiquidity
      +
      scoreChange
      +
      scoreBody
      +
      scoreClose
      +
      scoreAmplitude,

      0,

      100

    )

  );

}


export function getStrategyScore(
  stock,
  side
) {

  if (
    side ===
    "long"
  ) {

    return calculateLongScore(
      stock
    );

  }


  if (
    side ===
    "short"
  ) {

    return calculateShortScore(
      stock
    );

  }


  return 0;

}
