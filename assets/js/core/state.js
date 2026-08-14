export const state = {

  stocks: [],

  metadata: {},

  pageReadAt: "",

  currentView: "long",

  currentItems: [],

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


  state.metadata =
    metadata;


  state.pageReadAt =
    pageReadAt;

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
