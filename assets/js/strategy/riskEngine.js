import {
  LIVE_CONFIG
} from "../core/config.js";

import {
  getPriceTick,
  roundToTick
} from "../utils/priceTick.js";

import {
  calculateCostAdjustedExitPrice,
  calculateDayTradeCosts
} from "./tradingCosts.js";


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


  const priceRiskPerLot =
    riskPerShare
    *
    lotSize;


  const stopOutcome =
    calculateDayTradeCosts(
      {
        entry:
          entryPrice,
        exit:
          stopPrice,
        side,
        shares:
          lotSize
      }
    );


  const riskPerLot =
    stopOutcome

      ? Math.max(
          0,
          -stopOutcome.netPnlAfterRebate
        )

      : priceRiskPerLot;


  const cashRiskPerLot =
    stopOutcome

      ? Math.max(
          0,
          -stopOutcome.pnlBeforeRebate
        )

      : riskPerLot;


  const exitDirection =
    side === "long"
      ? "up"
      : "down";


  const breakEvenPrice =
    roundToTick(
      calculateCostAdjustedExitPrice(
        {
          entry:
            entryPrice,
          side,
          shares:
            lotSize
        }
      ),
      exitDirection
    );


  const tp1 =
    roundToTick(
      calculateCostAdjustedExitPrice(
        {
          entry:
            entryPrice,
          side,
          shares:
            lotSize,
          desiredNetPnl:
            riskPerLot
        }
      ),
      exitDirection
    );


  const tp2 =
    roundToTick(
      calculateCostAdjustedExitPrice(
        {
          entry:
            entryPrice,
          side,
          shares:
            lotSize,
          desiredNetPnl:
            riskPerLot
            *
            2
        }
      ),
      exitDirection
    );


  const breakEvenOutcome =
    calculateDayTradeCosts(
      {
        entry:
          entryPrice,
        exit:
          breakEvenPrice,
        side,
        shares:
          lotSize
      }
    );


  const tp1Outcome =
    calculateDayTradeCosts(
      {
        entry:
          entryPrice,
        exit:
          tp1,
        side,
        shares:
          lotSize
      }
    );


  const tp2Outcome =
    calculateDayTradeCosts(
      {
        entry:
          entryPrice,
        exit:
          tp2,
        side,
        shares:
          lotSize
      }
    );


  let maxLots =
    null;


  if (
    Number.isFinite(
      maxRiskAmount
    )
    &&
    maxRiskAmount > 0
    &&
    cashRiskPerLot > 0
  ) {

    maxLots =
      Math.floor(
        maxRiskAmount
        /
        cashRiskPerLot
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

    priceRiskPerLot,

    riskPerLot,

    cashRiskPerLot,

    breakEvenPrice,

    tp1,

    tp2,

    stopOutcome,

    breakEvenOutcome,

    tp1Outcome,

    tp2Outcome,

    maxRiskAmount,

    maxLots

  };

}
