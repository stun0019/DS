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
