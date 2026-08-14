export const TRADING_ELIGIBILITY = {
  ELIGIBLE: "ELIGIBLE",
  BUY_FIRST_ONLY: "BUY_FIRST_ONLY",
  INELIGIBLE: "INELIGIBLE",
  UNKNOWN: "UNKNOWN"
};


export function getTradingEligibility(
  stock
) {

  if (
    stock?.DayTradeEligible ===
    true
  ) {

    if (
      stock.SellFirstDayTradeAllowed ===
      false
    ) {

      return TRADING_ELIGIBILITY.BUY_FIRST_ONLY;

    }


    return TRADING_ELIGIBILITY.ELIGIBLE;

  }


  if (
    stock?.DayTradeEligible ===
    false
  ) {

    return TRADING_ELIGIBILITY.INELIGIBLE;

  }


  return TRADING_ELIGIBILITY.UNKNOWN;

}


export function isDayTradeEligible(
  stock
) {

  const status =
    getTradingEligibility(
      stock
    );


  return (
    status ===
    TRADING_ELIGIBILITY.ELIGIBLE
    ||
    status ===
    TRADING_ELIGIBILITY.BUY_FIRST_ONLY
  );

}


export function isSellFirstAllowed(
  stock
) {

  return getTradingEligibility(
    stock
  ) ===
  TRADING_ELIGIBILITY.ELIGIBLE;

}


export function getEligibilityLabel(
  stock
) {

  switch (
    getTradingEligibility(
      stock
    )
  ) {

    case TRADING_ELIGIBILITY.ELIGIBLE:
      return "可先賣";

    case TRADING_ELIGIBILITY.BUY_FIRST_ONLY:
      return "僅先買";

    case TRADING_ELIGIBILITY.INELIGIBLE:
      return "不可當沖";

    default:
      return "資格未知";

  }

}
