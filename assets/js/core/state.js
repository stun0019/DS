export const state = {

  stocks: [],

  stockMap:
    new Map(),

  metadata: {},

  pageReadAt: "",

  candidateDataFreshness:
    null,

  currentView: "long",

  currentItems: [],

  riskSettings: {
    maxRiskAmount: null
  },

  replay: {
    dataset: null,
    report: null,
    error: null,
    fileName: "",
    mode: "week",
    from: "",
    to: "",
    exitTarget: "tp1",
    slippageTicks: 0,
    autoProgress: null,
    autoRunning: false,
    ui: {
      dataMode: "auto",
      activeTab: "overview",
      candidateDate: "",
      candidateSide: "all",
      candidateSearch: "",
      tradeSide: "all",
      tradeResult: "all",
      tradeSearch: "",
      candidatePage: 1,
      tradePage: 1,
      logLimit: 100
    }
  },

  sortState: {
    key: null,
    direction: null,
    type: null
  }

};


export function setStocks(
  stocks,
  metadata,
  pageReadAt
) {

  state.stocks =
    stocks;


  state.stockMap =
    new Map(
      stocks.map(
        stock => [
          String(
            stock.Code || ""
          ),
          stock
        ]
      )
    );


  state.metadata =
    metadata;


  state.pageReadAt =
    pageReadAt;

}


export function setMaxRiskAmount(
  value
) {

  const amount =
    Number(
      value
    );


  state.riskSettings.maxRiskAmount =
    Number.isFinite(
      amount
    )
    &&
    amount > 0

      ? Math.round(
          amount
        )

      : null;

}


export function setCandidateDataFreshness(
  freshness
) {

  state.candidateDataFreshness =
    freshness
    ??
    null;

}


export function setReplayDataset(
  dataset,
  fileName =
    ""
) {

  state.replay.dataset =
    dataset;

  state.replay.fileName =
    fileName;

  state.replay.error =
    null;

}


export function setReplayReport(
  report,
  error =
    null
) {

  state.replay.report =
    report;

  state.replay.error =
    error;

}


export function setReplayRange(
  {
    mode,
    from,
    to,
    exitTarget,
    slippageTicks
  }
) {

  state.replay.mode =
    mode
    ??
    state.replay.mode;

  state.replay.from =
    from
    ??
    state.replay.from;

  state.replay.to =
    to
    ??
    state.replay.to;

  state.replay.exitTarget =
    exitTarget
    ??
    state.replay.exitTarget;

  state.replay.slippageTicks =
    slippageTicks ===
      undefined
    ||
    slippageTicks ===
      null

      ? state.replay.slippageTicks

      : Number(
          slippageTicks
        );

}


export function setReplayProgress(
  progress,
  running =
    false
) {

  state.replay.autoProgress =
    progress
    ??
    null;

  state.replay.autoRunning =
    Boolean(
      running
    );

}


export function setReplayUiState(
  patch
) {

  state.replay.ui = {
    ...state.replay.ui,
    ...patch
  };

}


export function setCurrentItems(
  items
) {

  state.currentItems =
    items;

}


export function setSort(
  key,
  direction,
  type
) {

  state.sortState = {
    key,
    direction,
    type
  };

}


export function resetSort() {

  state.sortState = {
    key: null,
    direction: null,
    type: null
  };

}
