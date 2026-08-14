export const state = {

  stocks: [],

  stockMap:
    new Map(),

  metadata: {},

  pageReadAt: "",

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
    exitTarget: "tp1"
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
    exitTarget
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
