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
  setMaxRiskAmount,
  setCandidateDataFreshness,
  setReplayDataset,
  setReplayProgress,
  setReplayRange,
  setReplayReport,
  setReplayUiState
} from "./core/state.js";

import {
  getInitialView,
  writeViewToHash,
  bindHashNavigation
} from "./core/router.js";

import {
  installMockBrowserApi,
  installReplayBrowserApi
} from "./core/publicApi.js";

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
  renderReplayPanel
} from "./panels/replayPanel.js";

import {
  renderDashboardPanel
} from "./panels/dashboardPanel.js";

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
  MockLiveDataProvider
} from "./live/mockProvider.js";

import {
  createLiveCandidateIndex
} from "./live/candidateIndex.js";

import {
  applyLiveQuoteToState,
  getTradingSessionDate
} from "./live/signalEngine.js";

import {
  evaluateCandidateDataFreshness
} from "./live/candidateDataFreshness.js";

import {
  resetLiveStates
} from "./live/liveState.js";

import {
  runBacktest
} from "./replay/replayEngine.js";

import {
  normalizeReplayDataset
} from "./replay/historical5mProvider.js";

import {
  HISTORICAL_AUTO_STAGE
} from "./replay/historicalAutoBacktest.js";

import {
  resolveReplayControlRange
} from "./replay/replayUiState.js";


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


const viewHeadingRoot =
  document.querySelector(
    ".view-heading"
  );


const validViews =
  Object.keys(
    VIEW_CONFIG
  );


let liveProvider =
  null;


let liveRenderTimer =
  null;


let historicalAutoPipeline =
  null;


const liveCandidateIndex =
  createLiveCandidateIndex();


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


  reloadBtn.classList.toggle(
    "hidden",
    state.currentView ===
    "replay"
  );


  summaryRoot.classList.toggle(
    "hidden",
    [
      "dashboard",
      "replay"
    ].includes(
      state.currentView
    )
  );

  executionRoot.classList.toggle(
    "hidden",
    [
      "dashboard",
      "replay"
    ].includes(
      state.currentView
    )
  );


  viewHeadingRoot?.classList.toggle(
    "hidden",
    [
      "dashboard",
      "replay"
    ].includes(
      state.currentView
    )
  );

}


function getReplaySessionDates() {

  return (
    Array.isArray(
      state.replay.dataset?.sessions
    )

      ? state.replay.dataset.sessions

      : []
  )
  .map(
    session =>
      session.date
  )
  .filter(
    Boolean
  )
  .sort();

}


function resolveReplayRange(
  mode,
  from,
  to
) {

  return resolveReplayControlRange(
    {
      mode,
      from,
      to,
      sessionDates:
        getReplaySessionDates()
    }
  );

}


function rerunReplay(
  {
    mode =
      state.replay.mode,
    from =
      state.replay.from,
    to =
      state.replay.to,
    exitTarget =
      state.replay.exitTarget,
    slippageTicks =
      state.replay.slippageTicks
  } = {}
) {

  const range =
    resolveReplayRange(
      mode,
      from,
      to
    );


  setReplayRange(
    {
      mode,
      from:
        range.from,
      to:
        range.to,
      exitTarget,
      slippageTicks
    }
  );

  if (
    !state.replay.dataset
  ) {

    setReplayReport(
      null,
      null
    );

    return null;

  }


  try {
    const report =
      runBacktest(
        state.replay.dataset,
        {
          from:
            range.from
            ||
            null,
          to:
            range.to
            ||
            null,
          maxRiskAmount:
            state.riskSettings.maxRiskAmount,
          exitTarget,
          slippageTicks
        }
      );


    setReplayReport(
      report,
      null
    );


    return report;
  }
  catch (
    error
  ) {

    setReplayReport(
      null,
      error.message
      ||
      String(
        error
      )
    );


    return null;
  }

}


function handleReplayDataset(
  dataset,
  fileName,
  inputError =
    null
) {

  if (
    inputError
    ||
    !dataset
  ) {

    setReplayDataset(
      null,
      fileName
    );

    setReplayReport(
      null,
      inputError?.message
      ||
      "Replay JSON 格式錯誤"
    );

    renderCurrentView();

    return;

  }


  let normalizedDataset;


  try {

    normalizedDataset =
      normalizeReplayDataset(
        dataset,
        {
          adapter:
            dataset.metadata?.adapter
            ??
            "UI_IMPORT"
        }
      );

  }

  catch (
    error
  ) {

    setReplayDataset(
      null,
      fileName
    );

    setReplayReport(
      null,
      error.message
    );

    renderCurrentView();

    return;

  }


  setReplayDataset(
    normalizedDataset,
    fileName
  );

  rerunReplay(
    {
      mode:
        "week"
    }
  );

  renderCurrentView();

}


function handleReplayRangeChange(
  options
) {

  rerunReplay(
    options
  );

  renderCurrentView();

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

    case "dashboard":

      return renderDashboardPanel(
        panelRoot,
        state.stocks,
        {
          metadata:
            state.metadata,
          freshness:
            state.candidateDataFreshness,
          onNavigate:
            navigateTo
        }
      );

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


    case "replay":

      return renderReplayPanel(
        panelRoot,
        state.replay,
        {
          riskSettings:
            state.riskSettings,
          onLoadDataset:
            handleReplayDataset,
          onRangeChange:
            handleReplayRangeChange,
          onAutoRun:
            handleReplayAutoRun,
          onClear:
            handleReplayClear,
          onRiskChange:
            handleRiskChange,
          onUiChange:
            handleReplayUiChange
        }
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


function renderExecutionControls() {

  renderExecutionBar(
    executionRoot,
    {
      stocks:
        state.stocks,
      metadata:
        state.metadata,
      candidateDataFreshness:
        state.candidateDataFreshness,
      riskSettings:
        state.riskSettings,
      onRiskChange:
        handleRiskChange
    }
  );

}


function handleReplayUiChange(
  patch,
  shouldRender =
    true
) {

  setReplayUiState(
    patch
  );


  if (
    shouldRender
  ) {

    renderCurrentView();

  }

}


function handleReplayClear() {

  setReplayDataset(
    null,
    ""
  );

  setReplayReport(
    null,
    null
  );

  setReplayProgress(
    null,
    false
  );

  renderCurrentView();

}


async function handleReplayAutoRun(
  options
) {

  setReplayRange(
    options
  );

  setReplayDataset(
    null,
    ""
  );

  setReplayReport(
    null,
    null
  );


  if (
    !historicalAutoPipeline
  ) {

    const progress = {
      stage:
        HISTORICAL_AUTO_STAGE.FAILED,
      errorCode:
        "AUTO_PROVIDER_NOT_CONFIGURED",
      errorMessage:
        "尚未設定正式歷史 Daily / Eligibility / Intraday Provider；系統不會以假資料冒充真實績效。",
      progressPercent: 0,
      completedSessions: 0,
      validatedSessions: 0
    };

    setReplayProgress(
      progress,
      false
    );

    setReplayReport(
      null,
      progress.errorMessage
    );

    renderCurrentView();

    return null;

  }


  historicalAutoPipeline.onProgress =
    progress => {

      const running =
        ![
          HISTORICAL_AUTO_STAGE.COMPLETED,
          HISTORICAL_AUTO_STAGE.FAILED
        ].includes(
          progress.stage
        );

      setReplayProgress(
        progress,
        running
      );

      renderCurrentView(
        {
          renderShell: false
        }
      );

    };


  try {

    const result =
      await historicalAutoPipeline.run(
        {
          fromDate:
            options.from,
          toDate:
            options.to,
          tradingCalendar:
            state.metadata.tradingCalendar,
          replayOptions: {
            from:
              options.from,
            to:
              options.to,
            maxRiskAmount:
              state.riskSettings.maxRiskAmount,
            exitTarget:
              options.exitTarget,
            slippageTicks:
              options.slippageTicks
          }
        }
      );

    setReplayDataset(
      result.dataset,
      "Auto Historical Collector"
    );

    setReplayReport(
      result.report,
      null
    );

    setReplayProgress(
      result.progress,
      false
    );

    renderCurrentView();


    return result.report;

  }
  catch (
    error
  ) {

    setReplayProgress(
      historicalAutoPipeline.progress
      ??
      {
        stage:
          HISTORICAL_AUTO_STAGE.FAILED,
        errorCode:
          error.code
          ??
          "HISTORICAL_AUTO_BACKTEST_FAILED",
        errorMessage:
          error.message
      },
      false
    );

    setReplayReport(
      null,
      error.message
      ??
      String(
        error
      )
    );

    renderCurrentView();


    return null;

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


    renderExecutionControls();
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

      : state.currentView ===
        "replay"

        ? state.replay.report

          ? `${state.replay.report.summary.actualTrades} 筆交易`

          : "等待 Replay 資料"

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
      "dashboard";

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


  liveCandidateIndex.refreshIfNeeded(
    state.stocks
  );


  const candidateSides =
    liveCandidateIndex.get(
      stock.Code
    );


  if (
    !candidateSides
  ) {

    return;

  }


  const candidateDataFreshness =
    evaluateCandidateDataFreshness(
      state.metadata,
      getTradingSessionDate(
        quote.timestamp
      )
    );


  const freshnessChanged =
    candidateDataFreshness.status !==
      state.candidateDataFreshness?.status
    ||
    candidateDataFreshness.reason !==
      state.candidateDataFreshness?.reason
    ||
    candidateDataFreshness.liveSessionDate !==
      state.candidateDataFreshness?.liveSessionDate;


  setCandidateDataFreshness(
    candidateDataFreshness
  );


  if (
    freshnessChanged
  ) {

    renderExecutionControls();

  }


  candidateSides.forEach(
    side => {

      applyLiveQuoteToState(
        stock,
        side,
        quote,
        {
          maxRiskAmount:
            state.riskSettings.maxRiskAmount,
          candidateDataFreshness
        }
      );

    }
  );


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


function initializeReplayApi() {

  installReplayBrowserApi(
    {
      target:
        window,
      rerunReplay,
      navigateTo,
      renderCurrentView,
      getHistoricalAutoPipeline:
        () =>
          historicalAutoPipeline,
      setHistoricalAutoPipeline:
        pipeline => {

          historicalAutoPipeline =
            pipeline;

        }
    }
  );

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
  installMockBrowserApi(
    {
      target:
        window,
      provider:
        liveProvider,
      reset() {

        resetLiveStates();
        renderCurrentView();

      }
    }
  );

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


    setCandidateDataFreshness(
      evaluateCandidateDataFreshness(
        result.metadata,
        getTradingSessionDate(
          new Date()
        )
      )
    );


    liveCandidateIndex.rebuild(
      result.stocks
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


initializeReplayApi();


initializeLiveProvider();


refreshData();
