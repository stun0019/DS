import {
  HISTORICAL_SOURCE_TYPE
} from "./historical5mProvider.js";


export const REPLAY_TABS = [
  "overview",
  "candidates",
  "trades",
  "daily",
  "periods",
  "logs"
];

export const REPLAY_DATA_MODE = {
  AUTO:
    "auto",
  IMPORT:
    "import",
  SAMPLE:
    "sample"
};


function weekStart(
  dateValue
) {

  const date =
    new Date(
      `${dateValue}T00:00:00Z`
    );

  const offset =
    (
      date.getUTCDay()
      +
      6
    )
    %
    7;

  date.setUTCDate(
    date.getUTCDate()
    -
    offset
  );

  return date.toISOString()
  .slice(
    0,
    10
  );

}


function monthStart(
  dateValue,
  months
) {

  const date =
    new Date(
      `${dateValue}T00:00:00Z`
    );

  const originalDay =
    date.getUTCDate();

  date.setUTCDate(
    1
  );

  date.setUTCMonth(
    date.getUTCMonth()
    -
    months
  );

  const daysInTargetMonth =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        0
      )
    )
    .getUTCDate();

  date.setUTCDate(
    Math.min(
      originalDay,
      daysInTargetMonth
    )
  );

  date.setUTCDate(
    date.getUTCDate()
    +
    1
  );

  return date.toISOString()
  .slice(
    0,
    10
  );

}


export function resolveReplayControlRange(
  {
    mode,
    from,
    to,
    sessionDates =
      []
  }
) {

  const dates =
    [...sessionDates]
    .filter(
      Boolean
    )
    .sort();

  const earliest =
    dates[0]
    ??
    "";

  const latest =
    dates[
      dates.length - 1
    ]
    ??
    "";


  if (
    mode ===
      "today"
  ) {

    return {
      from:
        latest,
      to:
        latest
    };

  }


  if (
    mode ===
      "week"
  ) {

    return {
      from:
        latest

          ? weekStart(
              latest
            )

          : "",
      to:
        latest
    };

  }


  if (
    mode ===
      "month1"
    ||
    mode ===
      "month3"
  ) {

    return {
      from:
        latest

          ? monthStart(
              latest,
              mode ===
                "month1"

                ? 1

                : 3
            )

          : "",
      to:
        latest
    };

  }


  return {
    from:
      from
      ||
      earliest,
    to:
      to
      ||
      latest
  };

}


export function createReplayUiState(
  value =
    {}
) {

  return {
    dataMode:
      Object.values(
        REPLAY_DATA_MODE
      ).includes(
        value.dataMode
      )

        ? value.dataMode

        : REPLAY_DATA_MODE.AUTO,
    activeTab:
      REPLAY_TABS.includes(
        value.activeTab
      )

        ? value.activeTab

        : "overview",
    candidateDate:
      value.candidateDate
      ??
      "",
    candidateSide:
      [
        "all",
        "long",
        "short"
      ].includes(
        value.candidateSide
      )

        ? value.candidateSide

        : "all",
    candidateSearch:
      value.candidateSearch
      ??
      "",
    tradeSide:
      [
        "all",
        "long",
        "short"
      ].includes(
        value.tradeSide
      )

        ? value.tradeSide

        : "all",
    tradeResult:
      [
        "all",
        "WIN",
        "LOSS"
      ].includes(
        value.tradeResult
      )

        ? value.tradeResult

        : "all",
    tradeSearch:
      value.tradeSearch
      ??
      "",
    candidatePage:
      Math.max(
        1,
        Number(
          value.candidatePage
          ??
          1
        )
      ),
    tradePage:
      Math.max(
        1,
        Number(
          value.tradePage
          ??
          1
        )
      ),
    logLimit:
      Math.max(
        25,
        Number(
          value.logLimit
          ??
          100
        )
      )
  };

}


export function getReplayDataSourceState(
  {
    dataset,
    progress,
    error
  }
) {

  const sourceType =
    dataset?.metadata?.sourceType
    ??
    HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK;


  return {
    sourceType,
    sourceLabel:
      sourceType ===
        HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA

        ? "REAL HISTORICAL DATA"

        : "SAMPLE / MOCK",
    validationStatus:
      error

        ? "FAILED"

        : dataset?.metadata?.validationStatus
          ??
          "NOT VALIDATED",
    volumeMode:
      dataset?.metadata?.volumeMode
      ??
      "VOLUME_MODE_UNDECLARED",
    universeMode:
      dataset?.metadata?.universeMode
      ??
      "UNIVERSE_MODE_UNDECLARED",
    universeValidated:
      dataset?.metadata?.universeValidated ===
        true,
    progressStage:
      progress?.stage
      ??
      null
  };

}


export function filterCandidateAudits(
  audits,
  uiState
) {

  const search =
    String(
      uiState.candidateSearch
      ??
      ""
    )
    .trim()
    .toLowerCase();


  return (
    audits
    ??
    []
  )
  .filter(
    audit =>
      !uiState.candidateDate
      ||
      audit.date ===
        uiState.candidateDate
  )
  .flatMap(
    audit => [
      ...(
        audit.long
        ??
        []
      ),
      ...(
        audit.short
        ??
        []
      )
    ]
    .filter(
      candidate =>
        uiState.candidateSide ===
          "all"
        ||
        candidate.side ===
          uiState.candidateSide
    )
    .filter(
      candidate =>
        !search
        ||
        `${candidate.code} ${candidate.name}`
        .toLowerCase()
        .includes(
          search
        )
    )
    .map(
      candidate => ({
        ...candidate,
        date:
          audit.date,
        previousTradingDate:
          audit.previousTradingDate
      })
    )
  );

}


export function filterReplayTrades(
  trades,
  uiState
) {

  const search =
    String(
      uiState.tradeSearch
      ??
      ""
    )
    .trim()
    .toLowerCase();


  return (
    trades
    ??
    []
  )
  .filter(
    trade =>
      uiState.tradeSide ===
        "all"
      ||
      trade.side ===
        uiState.tradeSide
  )
  .filter(
    trade =>
      uiState.tradeResult ===
        "all"
      ||
      trade.result ===
        uiState.tradeResult
  )
  .filter(
    trade =>
      !search
      ||
      `${trade.code} ${trade.name}`
      .toLowerCase()
      .includes(
        search
      )
  );

}


export function paginateReplayRows(
  rows,
  page,
  pageSize
) {

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rows.length
        /
        pageSize
      )
    );

  const currentPage =
    Math.min(
      totalPages,
      Math.max(
        1,
        Number(
          page
          ??
          1
        )
      )
    );

  const offset =
    (
      currentPage
      -
      1
    )
    *
    pageSize;


  return {
    rows:
      rows.slice(
        offset,
        offset
        +
        pageSize
      ),
    currentPage,
    totalPages,
    totalRows:
      rows.length
  };

}
