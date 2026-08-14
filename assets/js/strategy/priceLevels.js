import {
  STRATEGY
} from "../core/config.js";

import {
  toNumber
} from "../utils/number.js";

import {
  getPriceTick,
  roundToTick
} from "../utils/priceTick.js";


export function calculateStrategyPrices(
  stock,
  side
) {

  const open =
    toNumber(
      stock.OpeningPrice
    );


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
    high <= 0
    ||
    low <= 0
    ||
    close <= 0
    ||
    range <= 0
  ) {

    return null;

  }


  if (
    side ===
    "long"
  ) {

    const tick =
      getPriceTick(
        high
      );


    const entry =
      roundToTick(
        high
        +
        tick,
        "up"
      );


    const rawStop =

      Math.max(

        low,

        Math.min(

          open,

          close
          -
          range
          *
          STRATEGY.stopRangeRatio

        )

      );


    const stop =
      roundToTick(
        rawStop,
        "down"
      );


    const risk =
      entry
      -
      stop;


    if (
      risk <= 0
    ) {

      return null;

    }


    return {

      entry,

      stop,

      tp1:
        roundToTick(
          entry
          +
          risk
        ),

      tp2:
        roundToTick(
          entry
          +
          risk
          *
          2
        )

    };

  }


  if (
    side ===
    "short"
  ) {

    const tick =
      getPriceTick(
        low
      );


    const entry =
      roundToTick(
        low
        -
        tick,
        "down"
      );


    const rawStop =

      Math.min(

        high,

        Math.max(

          open,

          close
          +
          range
          *
          STRATEGY.stopRangeRatio

        )

      );


    const stop =
      roundToTick(
        rawStop,
        "up"
      );


    const risk =
      stop
      -
      entry;


    if (
      risk <= 0
    ) {

      return null;

    }


    return {

      entry,

      stop,

      tp1:
        roundToTick(
          entry
          -
          risk
        ),

      tp2:
        roundToTick(
          entry
          -
          risk
          *
          2
        )

    };

  }


  return null;

}
