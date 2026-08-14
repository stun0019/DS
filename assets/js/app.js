import {
  VIEW_CONFIG,
  LIVE_CONFIG
} from "./core/config.js";

import {
  state,
  resetSort,
  setSort,
  setStocks,
  setCurrentItems,
  setMaxRiskAmount
} from "./core/state.js";

import {
  getInitialView,
  writeViewToHash,
  bindHashNavigation
} from "./core/router.js";

import {
  loadStockData,
  assignLiquidityRanks
} from "./data/stockData.js";

import {
  initDrawer,
  closeDrawer,
  setDrawerActive
} from "./ui/drawer.js";

import {
  renderSummary
} from "./ui/summary.js";

import {
  renderExecutionBar
} from "./ui/executionBar.js";

import {
  renderLongPanel
} from "./panels/longPanel.js";

import {
  renderShortPanel
} from "./panels/shortPanel.js";

import {
  renderVolumePanel
} from "./panels/volumePanel.js";

import {
  renderRulesPanel
} from "./panels/rulesPanel.js";

import {
  renderAllStocksPanel
} from "./panels/allStocksPanel.js";

import {
  renderTwsePanel
} from "./panels/twsePanel.js";

import {
  renderTpexPanel
} from "./panels/tpexPanel.js";

import {
  isLongCandidate,
  isShortCandidate
} from "./strategy/candidateRules.js";

import {
  MockLiveDataProvider
} from "./live/mockProvider.js";

import {
  applyLiveQuoteToState
} from "./live/signalEngine.js";

import {
  resetLiveStates
} from "./live/liveState.js";


const panelRoot =
  document.getElementById(
    "panelRoot"
  );


const summaryRoot =
  document.getElementById(
    "summaryRoot"
  );


const executionRoot =
  document.getElementById(
    "executionRoot"
  );


const viewName =
  document.getElementById(
    "viewName"
  );


const viewDescription =
  document.getElementById(
    "viewDescription"
  );


const viewChip =
  document.getElementById(
    "viewChip"
  );


const reloadBtn =
  document.getElementById(
    "reloadBtn"
  );


const menuBtn =
  document.getElementById(
    "menuBtn"
  );


const validViews =
  Object.keys(
    VIEW_CONFIG
  );


let liveProvider =
  null;


let liveRenderTimer =
  null;


function updateViewHeader() {

  const config =
    VIEW_CONFIG[
      state.currentView
    ];


  viewName.textContent =
    config.name;


  viewDescription.textContent =
    config.description;


  viewChip.className =
    "view-chip";


  viewChip.textContent =
    "";


  if (
    config.chip
  ) {

    viewChip.textContent =
      config.chip;


    viewChip.classList.add(
      "show"
    );


    if (
      config.chipClass
    ) {

      viewChip.classList.add(
        config.chipClass
      );

    }

  }


  setDrawerActive(
    state.currentView
  );

}


function handleSort(
  key,
  direction,
  type
) {

  setSort(
    key,
    direction,
    type
  );


  renderCurrentView();

}


function renderCurrentPanel() {

  const options = {

    sortState:
      state.sortState,

    onSort:
      handleSort

  };


  switch (
    state.currentView
  ) {

    case "long":

      return renderLongPanel(
        panelRoot,
        state.stocks,
        options
      );


    case "short":

      return renderShortPanel(
        panelRoot,
        state.stocks,
        options
      );


    case "candidate":

      return renderVolumePanel(
        panelRoot,
        state.stocks,
        options
      );


    case "rules":

      return renderRulesPanel(
        panelRoot
      );


    case "twse":

      return renderTwsePanel(
        panelRoot,
        state.stocks,
        options
      );


    case "tpex":

      return renderTpexPanel(
        panelRoot,
        state.stocks,
        options
      );


    case "all":

    default:

      return renderAllStocksPanel(
        panelRoot,
        state.stocks,
        options
      );

  }

}


function handleRiskChange(
  value
) {

  setMaxRiskAmount(
    value
  );


  try {
    localStorage.setItem(
      "stockDaybyday.maxRiskAmount",
      state.riskSettings.maxRiskAmount
      ||
      ""
    );
  }
  catch (
    error
  ) {
    console.warn(
      "Risk preference could not be stored",
      error
    );
  }

}


function renderCurrentView(
  {
    renderShell = true
  } = {}
) {

  if (
    renderShell
  ) {
    updateViewHeader();


    renderExecutionBar(
      executionRoot,
      {
        stocks:
          state.stocks,
        metadata:
          state.metadata,
        riskSettings:
          state.riskSettings,
        onRiskChange:
          handleRiskChange
      }
    );
  }


  const items =
    renderCurrentPanel()
    ||
    [];


  setCurrentItems(
    items
  );


  const countLabel =

    state.currentView ===
    "rules"

      ? "規則說明"

      : `${items.length.toLocaleString(
          "zh-TW"
        )} 檔`;


  if (
    renderShell
  ) {
    renderSummary(
      summaryRoot,
      {

        metadata:
          state.metadata,

        pageReadAt:
          state.pageReadAt,

        stocks:
          state.stocks,

        countLabel

      }
    );
  }

}


function navigateTo(
  view,
  updateHash = true
) {

  if (
    !VIEW_CONFIG[
      view
    ]
  ) {

    view =
      "long";

  }


  state.currentView =
    view;


  resetSort();


  if (
    updateHash
  ) {

    writeViewToHash(
      view
    );

  }


  renderCurrentView();


  closeDrawer();

}


function findStockByCode(
  code
) {

  const target =
    String(
      code || ""
    );


  return state.stockMap.get(
    target
  );

}


function handleLiveQuote(
  quote
) {

  const stock =
    findStockByCode(
      quote.code
    );


  if (
    !stock
  ) {

    return;

  }


  if (
    isLongCandidate(
      stock
    )
  ) {

    applyLiveQuoteToState(
      stock,
      "long",
      quote,
      {
        maxRiskAmount:
          state.riskSettings.maxRiskAmount
      }
    );

  }


  if (
    isShortCandidate(
      stock
    )
  ) {

    applyLiveQuoteToState(
      stock,
      "short",
      quote,
      {
        maxRiskAmount:
          state.riskSettings.maxRiskAmount
      }
    );

  }


  scheduleLiveRender();

}


function scheduleLiveRender() {

  if (
    liveRenderTimer !==
    null
  ) {
    return;
  }


  liveRenderTimer =
    setTimeout(
      () => {

        liveRenderTimer =
          null;


        requestAnimationFrame(
          () => {
            renderCurrentView(
              {
                renderShell: false
              }
            );
          }
        );

      },
      LIVE_CONFIG.renderThrottleMs
    );

}


function initializeRiskSettings() {

  try {
    setMaxRiskAmount(
      localStorage.getItem(
        "stockDaybyday.maxRiskAmount"
      )
    );
  }
  catch (
    error
  ) {
    console.warn(
      "Risk preference could not be read",
      error
    );
  }

}


function initializeLiveProvider() {

  if (
    LIVE_CONFIG.mode !==
    "mock"
  ) {

    return;

  }


  liveProvider =
    new MockLiveDataProvider();


  liveProvider.subscribe(
    handleLiveQuote
  );


  liveProvider.start();


  /*
  V3.0 Mock 測試工具

  Chrome Console：

  stockDaybydayMock.push({
    code: "2327",
    timestamp: "2026-08-14T09:15:05+08:00",
    open: 650,
    high: 664,
    low: 648,
    last: 663,
    volume: 8000
  });
  */
  window.stockDaybydayMock = {

    push(
      quote
    ) {

      liveProvider.pushQuote(
        quote
      );

    },


    play(
      quotes,
      intervalMs = 1000
    ) {

      return liveProvider.play(
        quotes,
        {
          intervalMs
        }
      );

    },


    reset() {

      resetLiveStates();


      renderCurrentView();

    },


    stop() {

      liveProvider.stop();

    },


    start() {

      liveProvider.start();

    }

  };

}


async function refreshData() {

  panelRoot.innerHTML =
    `
      <div class="loading">
        載入資料中...
      </div>
    `;


  try {

    const result =
      await loadStockData();


    assignLiquidityRanks(
      result.stocks
    );


    resetLiveStates();


    setStocks(
      result.stocks,
      result.metadata,
      result.pageReadAt
    );


    renderCurrentView();

  }

  catch (
    error
  ) {

    console.error(
      error
    );


    panelRoot.innerHTML =
      `
        <div class="error-message">
          stocks.json 讀取失敗：
          ${error.message}
        </div>
      `;


    renderSummary(
      summaryRoot,
      {

        metadata: {},

        pageReadAt: "-",

        stocks: [],

        countLabel: "-"

      }
    );

  }

}


initDrawer(
  document.getElementById(
    "drawer-root"
  ),
  menuBtn,
  view => {

    navigateTo(
      view
    );

  }
);


state.currentView =
  getInitialView(
    validViews
  );


reloadBtn.addEventListener(
  "click",
  refreshData
);


bindHashNavigation(
  validViews,
  view => {

    if (
      view !==
      state.currentView
    ) {

      navigateTo(
        view,
        false
      );

    }

  }
);


initializeRiskSettings();


initializeLiveProvider();


refreshData();
