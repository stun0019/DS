import {
  LIVE_CONFIG,
  TRADING_COST_CONFIG
} from "../core/config.js";


function positiveNumber(
  value
) {

  const number =
    Number(
      value
      ||
      0
    );


  return Number.isFinite(
    number
  )
  &&
  number > 0

    ? number

    : 0;

}


export function calculateDayTradeCosts(
  {
    entry,
    exit,
    side,
    shares =
      LIVE_CONFIG.lotSize,
    commissionRate =
      TRADING_COST_CONFIG.commissionRate,
    commissionDiscountMultiplier =
      TRADING_COST_CONFIG.commissionDiscountMultiplier,
    transactionTaxRate =
      TRADING_COST_CONFIG.dayTradingTaxRate
  }
) {

  const entryPrice =
    positiveNumber(
      entry
    );


  const exitPrice =
    positiveNumber(
      exit
    );


  const shareCount =
    positiveNumber(
      shares
    );


  if (
    !entryPrice
    ||
    !exitPrice
    ||
    !shareCount
    ||
    ![
      "long",
      "short"
    ]
    .includes(
      side
    )
  ) {

    return null;

  }


  const buyPrice =
    side === "long"

      ? entryPrice

      : exitPrice;


  const sellPrice =
    side === "long"

      ? exitPrice

      : entryPrice;


  const buyAmount =
    buyPrice
    *
    shareCount;


  const sellAmount =
    sellPrice
    *
    shareCount;


  const originalBuyCommission =
    buyAmount
    *
    commissionRate;


  const originalSellCommission =
    sellAmount
    *
    commissionRate;


  const originalCommission =
    originalBuyCommission
    +
    originalSellCommission;


  const effectiveBuyCommission =
    originalBuyCommission
    *
    commissionDiscountMultiplier;


  const effectiveSellCommission =
    originalSellCommission
    *
    commissionDiscountMultiplier;


  const effectiveCommission =
    effectiveBuyCommission
    +
    effectiveSellCommission;


  const monthlyRebate =
    originalCommission
    -
    effectiveCommission;


  const transactionTax =
    sellAmount
    *
    transactionTaxRate;


  const costBeforeRebate =
    originalCommission
    +
    transactionTax;


  const netCostAfterRebate =
    effectiveCommission
    +
    transactionTax;


  const grossPnl =
    sellAmount
    -
    buyAmount;


  return {

    side,

    shares:
      shareCount,

    entry:
      entryPrice,

    exit:
      exitPrice,

    buyPrice,

    sellPrice,

    buyAmount,

    sellAmount,

    commissionRate,

    commissionDiscountMultiplier,

    commissionRebateRate:
      1
      -
      commissionDiscountMultiplier,

    transactionTaxRate,

    originalBuyCommission,

    originalSellCommission,

    originalCommission,

    effectiveBuyCommission,

    effectiveSellCommission,

    effectiveCommission,

    monthlyRebate,

    transactionTax,

    costBeforeRebate,

    netCostAfterRebate,

    grossPnl,

    pnlBeforeRebate:
      grossPnl
      -
      costBeforeRebate,

    netPnlAfterRebate:
      grossPnl
      -
      netCostAfterRebate

  };

}


export function calculateCostAdjustedExitPrice(
  {
    entry,
    side,
    desiredNetPnl = 0,
    shares =
      LIVE_CONFIG.lotSize,
    commissionRate =
      TRADING_COST_CONFIG.commissionRate,
    commissionDiscountMultiplier =
      TRADING_COST_CONFIG.commissionDiscountMultiplier,
    transactionTaxRate =
      TRADING_COST_CONFIG.dayTradingTaxRate
  }
) {

  const entryPrice =
    positiveNumber(
      entry
    );


  const shareCount =
    positiveNumber(
      shares
    );


  if (
    !entryPrice
    ||
    !shareCount
  ) {

    return null;

  }


  const effectiveCommissionRate =
    commissionRate
    *
    commissionDiscountMultiplier;


  const pnlPerShare =
    Number(
      desiredNetPnl
      ||
      0
    )
    /
    shareCount;


  if (
    side === "long"
  ) {

    const denominator =
      1
      -
      effectiveCommissionRate
      -
      transactionTaxRate;


    return denominator > 0

      ? (
          pnlPerShare
          +
          entryPrice
          *
          (
            1
            +
            effectiveCommissionRate
          )
        )
        /
        denominator

      : null;

  }


  if (
    side === "short"
  ) {

    return (
      entryPrice
      *
      (
        1
        -
        effectiveCommissionRate
        -
        transactionTaxRate
      )
      -
      pnlPerShare
    )
    /
    (
      1
      +
      effectiveCommissionRate
    );

  }


  return null;

}
