import {
  escapeHtml,
  formatCurrency,
  formatPrice,
  formatSignedNumber
} from "../utils/format.js";

import {
  JsonHistorical5mProvider,
  importHistorical5mFile
} from "../replay/historical5mProvider.js";

import {
  REPLAY_DATA_MODE,
  REPLAY_TABS,
  createReplayUiState,
  filterCandidateAudits,
  filterReplayTrades,
  getReplayDataSourceState,
  paginateReplayRows
} from "../replay/replayUiState.js";

import {
  renderReplayDailyBarChart,
  renderReplayLineChart
} from "./replayCharts.js";


const TAB_LABELS = {
  overview: "Overview",
  candidates: "Candidates",
  trades: "Trades",
  daily: "Daily",
  periods: "Weekly / Monthly",
  logs: "Logs"
};


function formatPercent(
  value
) {

  return `${Number(value ?? 0).toFixed(1)}%`;

}


function formatR(
  value
) {

  return `${formatSignedNumber(value ?? 0)}R`;

}


function formatProfitFactor(
  value
) {

  return value ===
    null

    ? "∞"

    : Number(
        value
        ??
        0
      )
      .toFixed(
        2
      );

}


function kpi(
  label,
  value,
  tone =
    ""
) {

  return `
    <div class="replay-kpi ${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;

}


function statusBadge(
  label,
  value,
  tone =
    "neutral"
) {

  return `
    <span class="replay-status-badge ${tone}">
      <small>${label}</small>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `;

}


function renderHeader(
  replayState
) {

  const source =
    getReplayDataSourceState(
      {
        dataset:
          replayState.dataset,
        progress:
          replayState.autoProgress,
        error:
          replayState.error
      }
    );

  const sourceTone =
    source.sourceType ===
      "REAL_HISTORICAL_DATA"

      ? "valid"

      : "warning";

  const validationTone =
    source.validationStatus ===
      "VALIDATED"

      ? "valid"

      : source.validationStatus ===
          "FAILED"

        ? "invalid"

        : "neutral";


  return `
    <header class="replay-header">
      <div>
        <span class="replay-overline">HISTORICAL BACKTEST</span>
        <h2>Replay 回測</h2>
        <p>D-1 公司股票母體 → Candidate → Completed 5m → Replay</p>
      </div>
      <div class="replay-header-status">
        ${statusBadge("SOURCE", source.sourceLabel, sourceTone)}
        ${statusBadge("VALIDATION", source.validationStatus, validationTone)}
        ${statusBadge("VOLUME", source.volumeMode)}
        ${statusBadge("UNIVERSE", source.universeMode, source.universeValidated ? "valid" : "warning")}
      </div>
    </header>
  `;

}


function renderControls(
  replayState,
  uiState,
  riskSettings
) {

  const modeButton =
    (
      value,
      label
    ) => `
      <button
        type="button"
        class="${uiState.dataMode === value ? "active" : ""}"
        data-replay-data-mode="${value}"
      >${label}</button>
    `;

  const rangeButton =
    (
      value,
      label
    ) => `
      <button
        type="button"
        class="${replayState.mode === value ? "active" : ""}"
        data-replay-range="${value}"
      >${label}</button>
    `;


  return `
    <section class="replay-control-panel">
      <div class="replay-control-row source-row">
        <div class="replay-control-group">
          <label>資料模式</label>
          <div class="replay-segmented">
            ${modeButton(REPLAY_DATA_MODE.AUTO, "自動歷史資料")}
            ${modeButton(REPLAY_DATA_MODE.IMPORT, "JSON / CSV")}
            ${modeButton(REPLAY_DATA_MODE.SAMPLE, "模擬範例")}
          </div>
        </div>

        <div class="replay-secondary-actions">
          <label class="replay-file-button ${uiState.dataMode === REPLAY_DATA_MODE.IMPORT ? "" : "muted"}">
            匯入資料
            <input type="file" accept="application/json,text/csv,.json,.csv" data-role="replay-file">
          </label>
          <button type="button" data-role="replay-sample">載入範例</button>
          <button type="button" data-role="replay-clear">清除</button>
          <span class="replay-file-name">${escapeHtml(replayState.fileName || "尚未載入資料")}</span>
        </div>
      </div>

      <div class="replay-control-grid">
        <div class="replay-control-group range-group">
          <label>日期範圍</label>
          <div class="replay-range-presets">
            ${rangeButton("today", "今日")}
            ${rangeButton("week", "本週")}
            ${rangeButton("month1", "1 個月")}
            ${rangeButton("month3", "3 個月")}
            ${rangeButton("custom", "自訂")}
          </div>
          <div class="replay-date-inputs">
            <input type="date" data-role="replay-from" value="${escapeHtml(replayState.from)}" aria-label="開始日期">
            <span>→</span>
            <input type="date" data-role="replay-to" value="${escapeHtml(replayState.to)}" aria-label="結束日期">
          </div>
        </div>

        <label class="replay-field">
          <span>Exit Mode</span>
          <select data-role="replay-target">
            <option value="tp1" ${replayState.exitTarget === "tp1" ? "selected" : ""}>TP1</option>
            <option value="tp2" ${replayState.exitTarget === "tp2" ? "selected" : ""}>TP2</option>
          </select>
        </label>

        <label class="replay-field">
          <span>Slippage</span>
          <select data-role="replay-slippage">
            ${[0, 1, 2].map(value => `<option value="${value}" ${replayState.slippageTicks === value ? "selected" : ""}>${value} Tick</option>`).join("")}
          </select>
        </label>

        <label class="replay-field">
          <span>單筆風險</span>
          <input type="number" min="0" step="1000" data-role="replay-risk" value="${riskSettings?.maxRiskAmount ?? ""}" placeholder="未設定">
        </label>

        <button type="button" class="replay-primary-action" data-role="replay-run" ${replayState.autoRunning ? "disabled" : ""}>
          ${replayState.autoRunning ? "資料準備中…" : "開始歷史回測"}
        </button>
      </div>
    </section>
  `;

}


function renderProgress(
  progress
) {

  if (
    !progress
  ) {

    return "";

  }

  const percent =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          progress.progressPercent
          ??
          0
        )
      )
    );

  const finished =
    progress.stage ===
      "COMPLETED";


  return `
    <section class="replay-progress-panel ${finished ? "completed" : ""}">
      <div class="replay-progress-heading">
        <div>
          <span>HISTORICAL DATA PREPARATION</span>
          <strong>${escapeHtml(progress.stage ?? "PREPARING")}</strong>
        </div>
        <strong>${percent}%</strong>
      </div>
      <div class="replay-progress-track"><span style="width:${percent}%"></span></div>
      <div class="replay-progress-details">
        <span>日期 <strong>${escapeHtml(progress.currentDate ?? "-")}</strong></span>
        <span>Candidate <strong>${escapeHtml([progress.currentCode, progress.currentName].filter(Boolean).join(" ") || "-")}</strong></span>
        <span>Sessions <strong>${progress.completedSessions ?? 0} / ${progress.totalSessions ?? 0}</strong></span>
        <span>Validated <strong>${progress.validatedSessions ?? progress.completedSessions ?? 0} / ${progress.totalSessions ?? 0}</strong></span>
      </div>
    </section>
  `;

}


function renderKpis(
  summary
) {

  return `
    <section class="replay-kpi-grid">
      ${kpi("實際出手", summary.actualTrades)}
      ${kpi("勝率", formatPercent(summary.winRate))}
      ${kpi("Net P&L", formatCurrency(summary.totalPnl), summary.totalPnl >= 0 ? "positive" : "negative")}
      ${kpi("Total R", formatR(summary.totalR), summary.totalR >= 0 ? "positive" : "negative")}
      ${kpi("Profit Factor", formatProfitFactor(summary.profitFactor))}
      ${kpi("Max Drawdown", formatCurrency(summary.maxDrawdown), "negative")}
      ${kpi("平均 R", formatR(summary.averageR), summary.averageR >= 0 ? "positive" : "negative")}
      ${kpi("Slippage Cost", formatCurrency(summary.totalSlippageCost), "warning")}
    </section>
  `;

}


function renderDatasetSummary(
  dataset
) {

  const metadata =
    dataset?.metadata
    ??
    {};

  const stats =
    metadata.historicalStats
    ??
    {};


  return `
    <section class="replay-validation-card">
      <header><h3>Source / Validation</h3><span>${escapeHtml(stats.dataFrom ?? "-")} → ${escapeHtml(stats.dataTo ?? "-")}</span></header>
      <dl>
        <div><dt>Validation</dt><dd>${escapeHtml(metadata.validationStatus ?? "-")}</dd></div>
        <div><dt>Universe</dt><dd>${metadata.universeValidated ? "VALIDATED" : "NOT VALIDATED"}</dd></div>
        <div><dt>Snapshots</dt><dd>${stats.dailySnapshotCount ?? 0}</dd></div>
        <div><dt>Sessions</dt><dd>${stats.sessionCount ?? 0}</dd></div>
        <div><dt>5m Bars</dt><dd>${Number(stats.fiveMinuteBarCount ?? 0).toLocaleString("zh-TW")}</dd></div>
        <div><dt>Stocks</dt><dd>${Number(stats.stockCount ?? 0).toLocaleString("zh-TW")}</dd></div>
        <div><dt>TWSE</dt><dd>${Number(metadata.twseStockCount ?? 0).toLocaleString("zh-TW")}</dd></div>
        <div><dt>TPEx</dt><dd>${Number(metadata.tpexStockCount ?? 0).toLocaleString("zh-TW")}</dd></div>
      </dl>
    </section>
  `;

}


function renderOverview(
  report,
  dataset
) {

  return `
    <div class="replay-overview-grid">
      <div class="replay-chart-grid">
        ${renderReplayLineChart(report.trades.map(trade => trade.netPnl), {title: "Equity Curve"})}
        ${renderReplayDailyBarChart(report.daily)}
        ${renderReplayLineChart(report.trades.map(trade => trade.rMultiple), {title: "Cumulative R", valueFormatter: formatR, tone: "r"})}
      </div>
      <div class="replay-side-summary">
        <section class="replay-breakdown-card">
          <header><h3>Trade Breakdown</h3></header>
          <dl>
            <div><dt>Long / Short</dt><dd>${report.summary.longTrades} / ${report.summary.shortTrades}</dd></div>
            <div><dt>Wins / Losses</dt><dd>${report.summary.wins} / ${report.summary.losses}</dd></div>
            <div><dt>TP1 / TP2 / Stop</dt><dd>${report.summary.tp1Count} / ${report.summary.tp2Count} / ${report.summary.stopCount}</dd></div>
            <div><dt>Risk Blocked</dt><dd>${report.summary.riskBlockedCount}</dd></div>
          </dl>
        </section>
        ${renderDatasetSummary(dataset)}
      </div>
    </div>
  `;

}


function pagination(
  key,
  page
) {

  if (
    page.totalPages <=
      1
  ) {

    return "";

  }


  return `
    <div class="replay-pagination">
      <button type="button" data-page-key="${key}" data-page="${page.currentPage - 1}" ${page.currentPage === 1 ? "disabled" : ""}>上一頁</button>
      <span>${page.currentPage} / ${page.totalPages} · ${page.totalRows} 筆</span>
      <button type="button" data-page-key="${key}" data-page="${page.currentPage + 1}" ${page.currentPage === page.totalPages ? "disabled" : ""}>下一頁</button>
    </div>
  `;

}


function table(
  headers,
  rows,
  emptyMessage
) {

  return rows

    ? `
        <div class="replay-table-wrap">
          <table class="replay-table">
            <thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `

    : `<div class="replay-tab-empty">${emptyMessage}</div>`;

}


function renderCandidates(
  dataset,
  uiState
) {

  const filtered =
    filterCandidateAudits(
      dataset?.candidateAudits,
      uiState
    );

  const page =
    paginateReplayRows(
      filtered,
      uiState.candidatePage,
      50
    );

  const dates =
    [...new Set((dataset?.candidateAudits ?? []).map(audit => audit.date))];

  const rows =
    page.rows.map(
      candidate => `
        <tr>
          <td>${escapeHtml(candidate.date)}</td>
          <td>${escapeHtml(candidate.previousTradingDate)}</td>
          <td><span class="replay-side ${candidate.side}">${candidate.side.toUpperCase()}</span></td>
          <td><strong>${escapeHtml(candidate.code)}</strong><small>${escapeHtml(candidate.name)}</small></td>
          <td>${candidate.strategyScore}</td>
          <td>${candidate.liquidityRank}</td>
          <td>${formatPrice(candidate.observation)}</td>
          <td>${formatPrice(candidate.previousHigh)}</td>
          <td>${formatPrice(candidate.previousLow)}</td>
        </tr>
      `
    )
    .join("");


  return `
    <div class="replay-tab-toolbar">
      <select data-filter="candidateDate"><option value="">全部日期</option>${dates.map(date => `<option value="${date}" ${uiState.candidateDate === date ? "selected" : ""}>${date}</option>`).join("")}</select>
      <select data-filter="candidateSide"><option value="all">Long + Short</option><option value="long" ${uiState.candidateSide === "long" ? "selected" : ""}>Long</option><option value="short" ${uiState.candidateSide === "short" ? "selected" : ""}>Short</option></select>
      <input type="search" data-filter="candidateSearch" value="${escapeHtml(uiState.candidateSearch)}" placeholder="搜尋代號或名稱">
    </div>
    ${table(["Date", "D-1 Snapshot", "Side", "Code / Name", "Score", "Liquidity", "Observation", "High", "Low"], rows, "沒有符合條件的 Candidate")}
    ${pagination("candidatePage", page)}
  `;

}


function renderTrades(
  report,
  uiState
) {

  const filtered =
    filterReplayTrades(
      report.trades,
      uiState
    );

  const page =
    paginateReplayRows(
      filtered,
      uiState.tradePage,
      30
    );

  const rows =
    page.rows.map(
      trade => `
        <tr>
          <td>${escapeHtml(trade.date)}</td>
          <td><strong>${escapeHtml(trade.code)}</strong><small>${escapeHtml(trade.name)}</small></td>
          <td><span class="replay-side ${trade.side}">${trade.side.toUpperCase()}</span></td>
          <td>${formatPrice(trade.rawEntry)} / ${formatPrice(trade.filledEntry)}</td>
          <td>${formatPrice(trade.structuralStop ?? trade.stop)}</td>
          <td>${formatPrice(trade.tp1)} / ${formatPrice(trade.tp2)}</td>
          <td>${formatPrice(trade.rawExit)} / ${formatPrice(trade.filledExit)}</td>
          <td>${trade.lots}</td>
          <td>${formatCurrency(trade.grossPnl)}</td>
          <td>${formatCurrency(trade.originalCommission)}</td>
          <td>${formatCurrency(trade.monthlyRebate)}</td>
          <td>${formatCurrency(trade.transactionTax)}</td>
          <td>${formatCurrency(trade.slippageCost)}</td>
          <td class="${trade.netPnl >= 0 ? "positive-text" : "negative-text"}">${formatCurrency(trade.netPnl)}</td>
          <td>${formatR(trade.rMultiple)}</td>
          <td>${escapeHtml(trade.exitReason)}</td>
        </tr>
      `
    )
    .join("");


  return `
    <div class="replay-tab-toolbar">
      <select data-filter="tradeSide"><option value="all">Long + Short</option><option value="long" ${uiState.tradeSide === "long" ? "selected" : ""}>Long</option><option value="short" ${uiState.tradeSide === "short" ? "selected" : ""}>Short</option></select>
      <select data-filter="tradeResult"><option value="all">Win + Loss</option><option value="WIN" ${uiState.tradeResult === "WIN" ? "selected" : ""}>Win</option><option value="LOSS" ${uiState.tradeResult === "LOSS" ? "selected" : ""}>Loss</option></select>
      <input type="search" data-filter="tradeSearch" value="${escapeHtml(uiState.tradeSearch)}" placeholder="搜尋代號或名稱">
    </div>
    ${table(["Date", "Code / Name", "Side", "Raw / Filled Entry", "Stop", "TP1 / TP2", "Raw / Filled Exit", "Lots", "Gross P&L", "Commission", "Rebate", "Tax", "Slippage", "Net P&L", "R", "Exit"], rows, "尚無完成交易")}
    ${pagination("tradePage", page)}
  `;

}


function performanceRows(
  rows,
  firstColumn
) {

  return rows.map(
    row => `
      <tr>
        <td>${escapeHtml(row[firstColumn])}</td>
        <td>${row.tradingDays ?? 1}</td>
        <td>${row.candidateCount}</td>
        <td>${row.actualTrades}</td>
        <td>${row.wins}</td>
        <td>${row.losses}</td>
        <td>${formatPercent(row.winRate)}</td>
        <td class="${row.totalPnl >= 0 ? "positive-text" : "negative-text"}">${formatCurrency(row.totalPnl)}</td>
        <td>${formatR(row.totalR)}</td>
        <td>${formatProfitFactor(row.profitFactor)}</td>
        <td>${formatCurrency(row.maxDrawdown)}</td>
      </tr>
    `
  )
  .join("");

}


function renderDaily(
  report
) {

  return table(
    ["Date", "Days", "Candidates", "Trades", "Wins", "Losses", "Win Rate", "P&L", "R", "PF", "Drawdown"],
    performanceRows(report.daily, "date"),
    "尚無每日績效"
  );

}


function renderPeriods(
  report
) {

  const headers =
    ["Period", "Days", "Candidates", "Trades", "Wins", "Losses", "Win Rate", "P&L", "R", "PF", "Drawdown"];


  return `
    <section class="replay-period-block"><h3>Weekly</h3>${table(headers, performanceRows(report.weekly, "period"), "尚無每週績效")}</section>
    <section class="replay-period-block"><h3>Monthly</h3>${table(headers, performanceRows(report.monthly, "period"), "尚無每月績效")}</section>
  `;

}


function renderLogs(
  report,
  uiState
) {

  const logs =
    report.logs.slice(
      -uiState.logLimit
    )
    .reverse();


  return `
    <div class="replay-log-list">
      ${logs.map(log => `
        <details class="replay-log-row">
          <summary>
            <span>${escapeHtml(log.date ?? String(log.timestamp ?? "").slice(0, 10))}</span>
            <strong>${escapeHtml(log.code ?? "-")}</strong>
            <span class="replay-side ${log.side}">${String(log.side ?? "").toUpperCase()}</span>
            <span>${escapeHtml(log.eventType ?? "STATE")}</span>
            <span>${escapeHtml(log.previousStatus ?? "-")} → ${escapeHtml(log.newStatus ?? "-")}</span>
            <span>${escapeHtml(log.triggerReason ?? log.blockReason ?? log.exitReason ?? "-")}</span>
          </summary>
          <div class="replay-log-detail">
            <span>5m OHLC <strong>O ${formatPrice(log.candle?.open)} H ${formatPrice(log.candle?.high)} L ${formatPrice(log.candle?.low)} C ${formatPrice(log.candle?.close)}</strong></span>
            <span>Observation <strong>${formatPrice(log.observation)}</strong></span>
            <span>Pullback <strong>${log.pullback ? "YES" : "-"}</strong></span>
            <span>Swing <strong>${log.swing ? `${escapeHtml(log.swing.type)} ${formatPrice(log.swing.price)}` : "-"}</strong></span>
            <span>Direction <strong>${log.directionConfirmation ? formatPrice(log.directionConfirmation.price) : "-"}</strong></span>
            <span>Entry / Stop <strong>${formatPrice(log.entry)} / ${formatPrice(log.stop)}</strong></span>
            <span>TP1 / TP2 <strong>${formatPrice(log.tp1)} / ${formatPrice(log.tp2)}</strong></span>
            <span>Lots / Slippage <strong>${log.maxLots ?? log.lots ?? "-"} / ${log.slippageTicks ?? 0} Tick</strong></span>
          </div>
        </details>
      `).join("") || '<div class="replay-tab-empty">尚無 Replay Logs</div>'}
    </div>
    ${report.logs.length > uiState.logLimit ? `<button type="button" class="replay-show-more" data-role="replay-more-logs">顯示更多（目前 ${uiState.logLimit} / ${report.logs.length}）</button>` : ""}
  `;

}


function renderTabContent(
  activeTab,
  report,
  dataset,
  uiState
) {

  switch (
    activeTab
  ) {

    case "candidates":
      return renderCandidates(
        dataset,
        uiState
      );

    case "trades":
      return renderTrades(
        report,
        uiState
      );

    case "daily":
      return renderDaily(
        report
      );

    case "periods":
      return renderPeriods(
        report
      );

    case "logs":
      return renderLogs(
        report,
        uiState
      );

    case "overview":
    default:
      return renderOverview(
        report,
        dataset
      );

  }

}


function renderResults(
  replayState,
  uiState
) {

  const report =
    replayState.report;


  if (
    !report
  ) {

    return `
      <section class="replay-empty-state">
        <span>5m</span>
        <h2>選擇日期並開始歷史回測</h2>
        <p>自動模式會依 Trading Calendar 取得 D-1 Daily、建立公司股票 Universe、選出 Long / Short Candidate，再只取得候選股的 D 日 Intraday。</p>
        <p>JSON / CSV 保留為 Advanced / Offline Import；SAMPLE / MOCK 不代表真實歷史績效。</p>
      </section>
    `;

  }


  return `
    ${renderKpis(report.summary)}
    <section class="replay-results-shell">
      <nav class="replay-tabs" aria-label="Replay 結果">
        ${REPLAY_TABS.map(tab => `<button type="button" data-replay-tab="${tab}" class="${uiState.activeTab === tab ? "active" : ""}">${TAB_LABELS[tab]}</button>`).join("")}
      </nav>
      <div class="replay-tab-content">
        ${renderTabContent(uiState.activeTab, report, replayState.dataset, uiState)}
      </div>
    </section>
  `;

}


function collectControlValues(
  root
) {

  return {
    mode:
      "custom",
    from:
      root.querySelector(
        '[data-role="replay-from"]'
      ).value,
    to:
      root.querySelector(
        '[data-role="replay-to"]'
      ).value,
    exitTarget:
      root.querySelector(
        '[data-role="replay-target"]'
      ).value,
    slippageTicks:
      Number(
        root.querySelector(
          '[data-role="replay-slippage"]'
        ).value
      ),
    maxRiskAmount:
      root.querySelector(
        '[data-role="replay-risk"]'
      ).value
  };

}


export function renderReplayPanel(
  root,
  replayState,
  {
    riskSettings =
      {},
    onLoadDataset,
    onRangeChange,
    onAutoRun,
    onClear,
    onRiskChange,
    onUiChange
  }
) {

  const uiState =
    createReplayUiState(
      replayState.ui
    );

  root.innerHTML = `
    <div class="replay-panel">
      ${renderHeader(replayState)}
      ${renderControls(replayState, uiState, riskSettings)}
      ${renderProgress(replayState.autoProgress)}
      ${replayState.error ? `<section class="replay-error-panel"><strong>${escapeHtml(replayState.autoProgress?.errorCode ?? "REPLAY_FAILED")}</strong><span>${escapeHtml(replayState.autoProgress?.errorContext?.date ?? replayState.autoProgress?.currentDate ?? "-")} · ${escapeHtml(replayState.error)}</span></section>` : ""}
      ${renderResults(replayState, uiState)}
    </div>
  `;

  root.querySelectorAll(
    "[data-replay-data-mode]"
  )
  .forEach(
    button =>
      button.addEventListener(
        "click",
        () =>
          onUiChange(
            {
              dataMode:
                button.dataset.replayDataMode
            }
          )
      )
  );

  root.querySelectorAll(
    "[data-replay-range]"
  )
  .forEach(
    button =>
      button.addEventListener(
        "click",
        () =>
          onRangeChange(
            {
              mode:
                button.dataset.replayRange
            }
          )
      )
  );

  root.querySelectorAll(
    "[data-replay-tab]"
  )
  .forEach(
    button =>
      button.addEventListener(
        "click",
        () =>
          onUiChange(
            {
              activeTab:
                button.dataset.replayTab
            }
          )
      )
  );

  root.querySelectorAll(
    "[data-filter]"
  )
  .forEach(
    input =>
      input.addEventListener(
        "change",
        () =>
          onUiChange(
            {
              [input.dataset.filter]:
                input.value,
              ...(
                input.dataset.filter.startsWith("candidate")

                  ? {
                      candidatePage: 1
                    }

                  : {
                      tradePage: 1
                    }
              )
            }
          )
      )
  );

  root.querySelectorAll(
    "[data-page-key]"
  )
  .forEach(
    button =>
      button.addEventListener(
        "click",
        () =>
          onUiChange(
            {
              [button.dataset.pageKey]:
                Number(
                  button.dataset.page
                )
            }
          )
      )
  );

  root.querySelector(
    '[data-role="replay-file"]'
  )
  .addEventListener(
    "change",
    async event => {

      const file =
        event.target.files?.[0];


      if (
        !file
      ) {

        return;

      }


      try {
        onLoadDataset(
          await importHistorical5mFile(
            file
          ),
          file.name
        );
      }
      catch (
        error
      ) {

        onLoadDataset(
          null,
          file.name,
          error
        );

      }

    }
  );

  root.querySelector(
    '[data-role="replay-sample"]'
  )
  .addEventListener(
    "click",
    async () => {

      try {
        const response =
          await fetch(
            "./replay-sample.json",
            {
              cache:
                "no-store"
            }
          );


        if (
          !response.ok
        ) {

          throw new Error(
            `HTTP ${response.status}`
          );

        }


        onUiChange(
          {
            dataMode:
              REPLAY_DATA_MODE.SAMPLE
          },
          false
        );

        onLoadDataset(
          new JsonHistorical5mProvider()
          .toReplayDataset(
            await response.text()
          ),
          "replay-sample.json"
        );
      }
      catch (
        error
      ) {

        onLoadDataset(
          null,
          "replay-sample.json",
          error
        );

      }

    }
  );

  root.querySelector(
    '[data-role="replay-clear"]'
  )
  .addEventListener(
    "click",
    onClear
  );

  root.querySelector(
    '[data-role="replay-run"]'
  )
  .addEventListener(
    "click",
    () => {

      const values =
        collectControlValues(
          root
        );

      onRiskChange(
        values.maxRiskAmount
      );


      if (
        uiState.dataMode ===
          REPLAY_DATA_MODE.AUTO
      ) {

        onAutoRun(
          values
        );

      }
      else {

        onRangeChange(
          values
        );

      }

    }
  );

  root.querySelector(
    '[data-role="replay-more-logs"]'
  )
  ?.addEventListener(
    "click",
    () =>
      onUiChange(
        {
          logLimit:
            uiState.logLimit
            +
            100
        }
      )
  );


  return [];

}
