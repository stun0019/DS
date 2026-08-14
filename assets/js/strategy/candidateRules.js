import {
  STRATEGY
} from "../core/config.js";

import {
  toNumber,
  clamp
} from "../utils/number.js";

import {
  isDayTradeEligible,
  isSellFirstAllowed
} from "./tradingEligibility.js";


export function calculatePreviousClose(
  stock
) {

  return (

    toNumber(
      stock.ClosingPrice
    )

    -

    toNumber(
      stock.Change
    )

  );

}


export function calculateChangePercent(
  stock
) {

  const previousClose =
    calculatePreviousClose(
      stock
    );


  if (
    previousClose <= 0
  ) {

    return 0;

  }


  return (

    toNumber(
      stock.Change
    )

    /

    previousClose

    *

    100

  );

}


export function calculateAmplitude(
  stock
) {

  const high =
    toNumber(
      stock.HighestPrice
    );


  const low =
    toNumber(
      stock.LowestPrice
    );


  const open =
    toNumber(
      stock.OpeningPrice
    );


  if (
    high <= 0
    ||
    low <= 0
    ||
    open <= 0
  ) {

    return 0;

  }


  return (

    (
      high
      -
      low
    )

    /

    open

    *

    100

  );

}


export function calculateClosePosition(
  stock
) {

  const high =
    toNumber(
      stock.HighestPrice
    );


  const low =
    toNumber(
      stock.LowestPrice
    );


  const close =
    toNumber(
      stock.ClosingPrice
    );


  const range =
    high
    -
    low;


  if (
    range <= 0
  ) {

    return 0.5;

  }


  return clamp(

    (
      close
      -
      low
    )

    /

    range,

    0,

    1

  );

}


export function calculateBodyRatio(
  stock
) {

  const open =
    toNumber(
      stock.OpeningPrice
    );


  const close =
    toNumber(
      stock.ClosingPrice
    );


  const high =
    toNumber(
      stock.HighestPrice
    );


  const low =
    toNumber(
      stock.LowestPrice
    );


  const range =
    high
    -
    low;


  if (
    range <= 0
  ) {

    return 0;

  }


  return (

    close
    -
    open

  )
  /
  range;

}


export function isLongCandidate(
  stock
) {

  const rank =
    stock.__liquidityRank
    ||
    999999;


  const open =
    toNumber(
      stock.OpeningPrice
    );


  const close =
    toNumber(
      stock.ClosingPrice
    );


  return (

    isDayTradeEligible(
      stock
    )

    &&

    rank
    <=
    STRATEGY.liquidityPoolSize

    &&

    calculateChangePercent(
      stock
    ) > 0

    &&

    close > open

    &&

    calculateClosePosition(
      stock
    )
    >=
    STRATEGY.longClosePosition

    &&

    calculateAmplitude(
      stock
    )
    >=
    STRATEGY.minimumAmplitude

  );

}


export function isShortCandidate(
  stock
) {

  const rank =
    stock.__liquidityRank
    ||
    999999;


  const open =
    toNumber(
      stock.OpeningPrice
    );


  const close =
    toNumber(
      stock.ClosingPrice
    );


  return (

    isSellFirstAllowed(
      stock
    )

    &&

    rank
    <=
    STRATEGY.liquidityPoolSize

    &&

    calculateChangePercent(
      stock
    ) < 0

    &&

    close < open

    &&

    calculateClosePosition(
      stock
    )
    <=
    STRATEGY.shortClosePosition

    &&

    calculateAmplitude(
      stock
    )
    >=
    STRATEGY.minimumAmplitude

  );

}
