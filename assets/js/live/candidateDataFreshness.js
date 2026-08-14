import {
  getPreviousTradingDate,
  isTradingDate,
  normalizeTradingDate
} from "../utils/tradingCalendar.js";


export const CANDIDATE_DATA_STATUS = {
  FRESH:
    "FRESH",
  DATA_STALE:
    "DATA_STALE"
};


function staleResult(
  reason,
  candidateDataDate,
  liveSessionDate
) {

  return {
    status:
      CANDIDATE_DATA_STATUS.DATA_STALE,
    isFresh:
      false,
    reason,
    candidateDataDate,
    liveSessionDate
  };

}


export function evaluateCandidateDataFreshness(
  metadata,
  liveSessionDate
) {

  const sessionDate =
    normalizeTradingDate(
      liveSessionDate
    );


  const candidateDataDate =
    normalizeTradingDate(
      metadata?.tradeDateISO
      ??
      metadata?.tradeDate
    );


  if (
    !sessionDate
  ) {

    return staleResult(
      "無法確認 Live 交易日",
      candidateDataDate,
      null
    );

  }


  if (
    isTradingDate(
      sessionDate,
      metadata?.tradingCalendar
    ) !== true
  ) {

    return staleResult(
      "官方交易日曆無法確認目前 Live 交易日",
      candidateDataDate,
      sessionDate
    );

  }


  if (
    !candidateDataDate
  ) {

    return staleResult(
      "候選資料缺少有效交易日期",
      null,
      sessionDate
    );

  }


  if (
    metadata?.syncStatus !==
      "SYNCED"
  ) {

    return staleResult(
      "候選資料尚未完成官方同步",
      candidateDataDate,
      sessionDate
    );

  }


  if (
    candidateDataDate >=
      sessionDate
  ) {

    return staleResult(
      "候選資料不是已完成交易日",
      candidateDataDate,
      sessionDate
    );

  }


  const rawMarketDates =
    Object.values(
      metadata?.marketTradeDates
      ??
      {}
    );


  const marketDates =
    rawMarketDates
    .map(
      normalizeTradingDate
    )
    .filter(
      Boolean
    );


  if (
    marketDates.length !==
      rawMarketDates.length
  ) {

    return staleResult(
      "候選資料包含無效的市場交易日期",
      candidateDataDate,
      sessionDate
    );

  }


  if (
    marketDates.some(
      marketDate =>
        marketDate !==
          candidateDataDate
    )
  ) {

    return staleResult(
      "上市與上櫃候選日期不同步",
      candidateDataDate,
      sessionDate
    );

  }


  const declaredSessionDate =
    normalizeTradingDate(
      metadata?.validForTradingDate
      ??
      metadata?.candidateForTradingDate
      ??
      metadata?.nextTradingDate
    );


  if (
    !declaredSessionDate
  ) {

    return staleResult(
      "候選資料缺少官方 Live 交易日確認",
      candidateDataDate,
      sessionDate
    );

  }


  if (
    declaredSessionDate !==
      sessionDate
  ) {

    return staleResult(
      "候選資料不適用目前 Live 交易日",
      candidateDataDate,
      sessionDate
    );

  }


  const expectedPreviousTradingDate =
    getPreviousTradingDate(
      sessionDate,
      metadata?.tradingCalendar
    );


  if (
    !expectedPreviousTradingDate
  ) {

    return staleResult(
      "無法確認最近一個已完成交易日",
      candidateDataDate,
      sessionDate
    );

  }


  const declaredPreviousTradingDate =
    normalizeTradingDate(
      metadata?.expectedPreviousTradingDate
    );


  if (
    metadata?.expectedPreviousTradingDate
    &&
    declaredPreviousTradingDate !==
      expectedPreviousTradingDate
  ) {

    return staleResult(
      "候選資料的前一交易日宣告不一致",
      candidateDataDate,
      sessionDate
    );

  }


  if (
    candidateDataDate !==
      expectedPreviousTradingDate
  ) {

    return staleResult(
      "候選資料不是最近一個已完成交易日",
      candidateDataDate,
      sessionDate
    );

  }


  return {
    status:
      CANDIDATE_DATA_STATUS.FRESH,
    isFresh:
      true,
    reason:
      "候選資料交易日已確認",
    candidateDataDate,
    expectedPreviousTradingDate,
    liveSessionDate:
      sessionDate,
    confirmation:
      "DECLARED_TRADING_DATE"
  };

}
