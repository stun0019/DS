export const CANDIDATE_DATA_STATUS = {
  FRESH:
    "FRESH",
  DATA_STALE:
    "DATA_STALE"
};


function buildValidDate(
  year,
  month,
  day
) {

  const date =
    new Date(
      Date.UTC(
        Number(
          year
        ),
        Number(
          month
        ) - 1,
        Number(
          day
        )
      )
    );


  if (
    date.getUTCFullYear() !==
      Number(
        year
      )
    ||
    date.getUTCMonth() !==
      Number(
        month
      ) - 1
    ||
    date.getUTCDate() !==
      Number(
        day
      )
  ) {

    return null;

  }


  return (
    `${String(year).padStart(4, "0")}-`
    +
    `${String(month).padStart(2, "0")}-`
    +
    String(day).padStart(2, "0")
  );

}


function normalizeDate(
  value
) {

  const text =
    String(
      value
      ??
      ""
    )
    .trim();


  const isoMatch =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );


  if (
    isoMatch
  ) {

    return buildValidDate(
      isoMatch[1],
      isoMatch[2],
      isoMatch[3]
    );

  }


  const rocMatch =
    text.match(
      /^(\d{3})(\d{2})(\d{2})$/
    );


  if (
    rocMatch
  ) {

    return buildValidDate(
      Number(
        rocMatch[1]
      ) + 1911,
      rocMatch[2],
      rocMatch[3]
    );

  }


  return null;

}


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
    normalizeDate(
      liveSessionDate
    );


  const candidateDataDate =
    normalizeDate(
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


  const sessionWeekday =
    new Date(
      `${sessionDate}T00:00:00Z`
    )
    .getUTCDay();


  if (
    sessionWeekday === 0
    ||
    sessionWeekday === 6
  ) {

    return staleResult(
      "目前日期不是 Live 交易日",
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
      normalizeDate
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
    normalizeDate(
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


  return {
    status:
      CANDIDATE_DATA_STATUS.FRESH,
    isFresh:
      true,
    reason:
      "候選資料交易日已確認",
    candidateDataDate,
    liveSessionDate:
      sessionDate,
    confirmation:
      "DECLARED_TRADING_DATE"
  };

}
