import {
  LIVE_CONFIG
} from "../core/config.js";

import {
  getPriceTick,
  roundToTick
} from "../utils/priceTick.js";


export function calculateRiskPlan(
  {
    entry,
    stop,
    side,
    lotSize =
      LIVE_CONFIG.lotSize,
    maxRiskAmount =
      null
  }
) {

  const entryPrice =
    Number(
      entry
      ||
      0
    );


  const stopPrice =
    Number(
      stop
      ||
      0
    );


  if (
    entryPrice <= 0
    ||
    stopPrice <= 0
  ) {

    return null;

  }


  let riskPerShare;


  if (
    side ===
    "long"
  ) {

    riskPerShare =
      entryPrice
      -
      stopPrice;

  }

  else if (
    side ===
    "short"
  ) {

    riskPerShare =
      stopPrice
      -
      entryPrice;

  }

  else {

    return null;

  }


  if (
    riskPerShare <= 0
  ) {

    return null;

  }


  const tick =
    getPriceTick(
      entryPrice
    );


  const approximateRiskTicks =
    tick > 0

      ? Math.round(
          riskPerShare
          /
          tick
        )

      : null;


  const riskPerLot =
    riskPerShare
    *
    lotSize;


  let tp1;

  let tp2;


  if (
    side ===
    "long"
  ) {

    tp1 =
      roundToTick(
        entryPrice
        +
        riskPerShare,
        "up"
      );


    tp2 =
      roundToTick(
        entryPrice
        +
        riskPerShare
        *
        2,
        "up"
      );

  }

  else {

    tp1 =
      roundToTick(
        entryPrice
        -
        riskPerShare,
        "down"
      );


    tp2 =
      roundToTick(
        entryPrice
        -
        riskPerShare
        *
        2,
        "down"
      );

  }


  let maxLots =
    null;


  if (
    Number.isFinite(
      maxRiskAmount
    )
    &&
    maxRiskAmount > 0
    &&
    riskPerLot > 0
  ) {

    maxLots =
      Math.floor(
        maxRiskAmount
        /
        riskPerLot
      );

  }


  return {

    side,

    entry:
      entryPrice,

    stop:
      stopPrice,

    tick,

    riskPerShare,

    approximateRiskTicks,

    lotSize,

    riskPerLot,

    tp1,

    tp2,

    maxRiskAmount,

    maxLots

  };

}
