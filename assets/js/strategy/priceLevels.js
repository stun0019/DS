import {
  toNumber
} from "../utils/number.js";

import {
  getPriceTick,
  roundToTick
} from "../utils/priceTick.js";


export function calculateObservationPrice(
  stock,
  side
) {

  const high =
    toNumber(
      stock.HighestPrice
    );


  const low =
    toNumber(
      stock.LowestPrice
    );


  if (
    high <= 0
    ||
    low <= 0
  ) {

    return 0;

  }


  if (
    side ===
    "long"
  ) {

    const tick =
      getPriceTick(
        high
      );


    return roundToTick(
      high
      +
      tick,
      "up"
    );

  }


  if (
    side ===
    "short"
  ) {

    const tick =
      getPriceTick(
        low
      );


    return roundToTick(
      low
      -
      tick,
      "down"
    );

  }


  return 0;

}


export function calculatePremarketPlan(
  stock,
  side
) {

  const previousHigh =
    toNumber(
      stock.HighestPrice
    );


  const previousLow =
    toNumber(
      stock.LowestPrice
    );


  const previousClose =
    toNumber(
      stock.ClosingPrice
    );


  const observationPrice =
    calculateObservationPrice(
      stock,
      side
    );


  if (
    previousHigh <= 0
    ||
    previousLow <= 0
    ||
    observationPrice <= 0
  ) {

    return null;

  }


  return {

    side,

    observationPrice,

    previousHigh,

    previousLow,

    previousClose

  };

}
