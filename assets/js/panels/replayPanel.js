import {
  escapeHtml,
  formatCurrency,
  formatPrice,
  formatSignedNumber
} from "../utils/format.js";

import {
  HISTORICAL_SOURCE_TYPE,
  JsonHistorical5mProvider,
  getHistoricalSourceLabel,
  importHistorical5mFile
} from "../replay/historical5mProvider.js";


function formatPercentValue(
  value
) {

  return `${Number(value || 0).toFixed(1)}%`;

}


function formatR(
  value
) {

  return `${formatSignedNumber(value)}R`;

}


function formatOptionalCurrency(
  value
) {

  return value ===
    null
  ||
  value ===
    undefined

    ? "-"

    : formatCurrency(
        value
      );

}


function formatTime(
  timestamp
) {

  if (
    !timestamp
  ) {

    return "-";

  }


  return new Date(
    timestamp
  )
  .toLocaleTimeString(
    "zh-TW",
    {
      timeZone:
        "Asia/Taipei",
      hour12:
        false,
      hour:
        "2-digit",
      minute:
        "2-digit"
    }
  );

}


function metric(
  label,
  value,
  className =
    ""
) {

  return `
    <div class="replay-metric ${className}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;

}


function renderSourceBadge(
  replayState
) {

  if (
    !replayState.dataset
  ) {

    return "";

  }


  const sourceType =
    replayState.dataset.metadata?.sourceType
    ??
    HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK;


  const className =
    sourceType ===
      HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA

      ? "real"

      : "sample";


  return `
    <span class="replay-source-badge ${className}">
      ${escapeHtml(
        getHistoricalSourceLabel(
          sourceType
        )
      )}
    </span>
  `;

}


function renderSummary(
  summary,
  settings = {}
) {

  return `
    <section class="replay-section">
      <div class="replay-section-heading">
        <div>
          <span class="replay-kicker">PERFORMANCE</span>
          <h2>回測績效摘要</h2>
        </div>
        <span class="replay-range-label">完成 ${summary.tradingDays} 個交易日</span>
      </div>

      <div class="replay-metrics-grid">
        ${metric("交易日數", summary.tradingDays)}
        ${metric("總候選數", summary.totalCandidates)}
        ${metric("實際出手", summary.actualTrades)}
        ${metric("未出手候選", summary.noTradeCandidates)}
        ${metric("Long / Short", `${summary.longTrades} / ${summary.shortTrades}`)}
        ${metric("勝 / 敗", `${summary.wins} / ${summary.losses}`)}
        ${metric("勝率", formatPercentValue(summary.winRate))}
        ${metric("總 P&L", formatCurrency(summary.totalPnl), summary.totalPnl >= 0 ? "positive" : "negative")}
        ${metric("滑價設定", `${settings.slippageTicks ?? 0} Tick`)}
        ${metric("滑價成本", formatCurrency(summary.totalSlippageCost), summary.totalSlippageCost > 0 ? "warning" : "")}
        ${metric("平均 P&L", formatCurrency(summary.averagePnl), summary.averagePnl >= 0 ? "positive" : "negative")}
        ${metric("總 R", formatR(summary.totalR), summary.totalR >= 0 ? "positive" : "negative")}
        ${metric("平均 R", formatR(summary.averageR), summary.averageR >= 0 ? "positive" : "negative")}
        ${metric("Profit Factor", summary.profitFactor === null ? "∞" : Number(summary.profitFactor).toFixed(2))}
        ${metric("最大單筆獲利", formatCurrency(summary.maxWin), "positive")}
        ${metric("最大單筆虧損", formatCurrency(summary.maxLoss), "negative")}
        ${metric("最大回撤", formatCurrency(summary.maxDrawdown), "negative")}
        ${metric("TP1 / TP2 / Stop", `${summary.tp1Count} / ${summary.tp2Count} / ${summary.stopCount}`)}
        ${metric("RISK_BLOCKED", summary.riskBlockedCount, "warning")}
        ${metric("INVALIDATED", summary.invalidatedCount, "negative")}
      </div>
    </section>
  `;

}


function renderDailyTable(
  daily,
  summary
) {

  const rows =
    daily.map(
      day => `
        <tr>
          <td>${escapeHtml(day.date)}</td>
          <td>${day.actualTrades}</td>
          <td>${formatPercentValue(day.winRate)}</td>
          <td class="${day.totalPnl >= 0 ? "positive-text" : "negative-text"}">${formatCurrency(day.totalPnl)}</td>
          <td>${formatR(day.totalR)}</td>
          <td>${formatCurrency(day.totalSlippageCost)}</td>
          <td>${formatCurrency(day.maxDrawdown)}</td>
        </tr>
      `
    )
    .join("");


  return `
    <section class="replay-section">
      <div class="replay-section-heading">
        <div>
          <span class="replay-kicker">DAILY / WEEKLY</span>
          <h2>每日與本週績效</h2>
        </div>
      </div>

      <div class="replay-table-wrap">
        <table class="replay-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>出手次數</th>
              <th>勝率</th>
              <th>P&L</th>
              <th>R</th>
              <th>滑價成本</th>
              <th>最大回撤</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="replay-total-row">
              <td>區間合計</td>
              <td>${summary.actualTrades}</td>
              <td>${formatPercentValue(summary.winRate)}</td>
              <td class="${summary.totalPnl >= 0 ? "positive-text" : "negative-text"}">${formatCurrency(summary.totalPnl)}</td>
              <td>${formatR(summary.totalR)}</td>
              <td>${formatCurrency(summary.totalSlippageCost)}</td>
              <td>${formatCurrency(summary.maxDrawdown)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

}


function renderTrades(
  trades
) {

  const rows =
    trades.map(
      trade => `
        <tr>
          <td>${escapeHtml(trade.date)}</td>
          <td><strong>${escapeHtml(trade.code)}</strong><small>${escapeHtml(trade.name)}</small></td>
          <td><span class="replay-side ${trade.side}">${trade.side.toUpperCase()}</span></td>
          <td>${formatPrice(trade.observation)}</td>
          <td>${formatTime(trade.breakoutTime)}</td>
          <td>${formatTime(trade.entryTime)}<small>Raw ${formatPrice(trade.rawEntry)} / Filled ${formatPrice(trade.filledEntry)}</small></td>
          <td>${formatPrice(trade.stop)}</td>
          <td>${formatPrice(trade.tp1)} / ${formatPrice(trade.tp2)}</td>
          <td>${formatTime(trade.exitTime)}<small>Raw ${formatPrice(trade.rawExit)} / Filled ${formatPrice(trade.filledExit)}</small></td>
          <td>${escapeHtml(trade.exitReason)}</td>
          <td>${trade.slippageTicks}</td>
          <td>${formatCurrency(trade.slippageCost)}</td>
          <td>${trade.maxLots}</td>
          <td>${formatCurrency(trade.grossPnl)}</td>
          <td>${formatCurrency(trade.tradingCost)}</td>
          <td>${formatCurrency(trade.monthlyRebate)}</td>
          <td>${formatCurrency(trade.transactionTax)}</td>
          <td class="${trade.netPnl >= 0 ? "positive-text" : "negative-text"}">${formatCurrency(trade.netPnl)}</td>
          <td>${formatR(trade.rMultiple)}</td>
        </tr>
      `
    )
    .join("");


  return `
    <section class="replay-section">
      <div class="replay-section-heading">
        <div>
          <span class="replay-kicker">TRADE JOURNAL</span>
          <h2>每筆交易紀錄</h2>
        </div>
        <span class="replay-range-label">${trades.length} 筆</span>
      </div>

      ${trades.length > 0
        ? `
            <div class="replay-table-wrap wide">
              <table class="replay-table">
                <thead>
                  <tr>
                    <th>日期</th><th>股票</th><th>方向</th><th>Observation</th>
                    <th>Breakout</th><th>Entry Raw / Filled</th><th>Stop</th><th>TP1 / TP2</th>
                    <th>Exit Raw / Filled</th><th>原因</th><th>滑價 Tick</th><th>滑價成本</th><th>張數</th><th>毛損益</th>
                    <th>交易成本</th><th>月退</th><th>證交稅</th><th>淨 P&L</th><th>R</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          `
        : '<div class="replay-empty-inline">此區間沒有實際出手。</div>'
      }
    </section>
  `;

}


function renderInstruments(
  instruments
) {

  const rows =
    instruments.map(
      item => `
        <tr>
          <td><strong>${escapeHtml(item.code)}</strong></td>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.actualTrades}</td>
          <td>${item.longTrades}</td>
          <td>${item.shortTrades}</td>
          <td>${item.wins}</td>
          <td>${item.losses}</td>
          <td>${formatPercentValue(item.winRate)}</td>
          <td class="${item.totalPnl >= 0 ? "positive-text" : "negative-text"}">${formatCurrency(item.totalPnl)}</td>
          <td>${formatR(item.totalR)}</td>
        </tr>
      `
    )
    .join("");


  return `
    <section class="replay-section">
      <div class="replay-section-heading">
        <div>
          <span class="replay-kicker">INSTRUMENTS</span>
          <h2>交易標的統計</h2>
        </div>
      </div>

      ${instruments.length > 0
        ? `
            <div class="replay-table-wrap">
              <table class="replay-table">
                <thead>
                  <tr><th>股票</th><th>名稱</th><th>出手</th><th>Long</th><th>Short</th><th>勝</th><th>敗</th><th>勝率</th><th>P&L</th><th>總 R</th></tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          `
        : '<div class="replay-empty-inline">尚無標的績效。</div>'
      }
    </section>
  `;

}


function renderLogBox(
  logs
) {

  const entries =
    logs.map(
      log => {

        const candle =
          log.candle
          ??
          {};

        const swing =
          log.swing

            ? `${log.swing.type} ${formatPrice(log.swing.price)}`

            : "-";


        return `
          <article class="replay-log-entry ${String(log.newStatus || "").toLowerCase()}">
            <div class="replay-log-main">
              <time>${formatTime(log.timestamp)}</time>
              <strong>${escapeHtml(log.code)} ${escapeHtml(log.name)}</strong>
              <span class="replay-side ${log.side}">${String(log.side || "").toUpperCase()}</span>
              <span class="replay-transition">${escapeHtml(log.previousStatus)} → ${escapeHtml(log.newStatus)}</span>
            </div>

            <div class="replay-log-grid">
              <span>5分K <strong>O ${formatPrice(candle.open)} H ${formatPrice(candle.high)} L ${formatPrice(candle.low)} C ${formatPrice(candle.close)}</strong></span>
              <span>Observation <strong>${formatPrice(log.observation)}</strong></span>
              <span>Pullback <strong>${log.pullback ? "YES" : "-"}</strong></span>
              <span>Swing <strong>${escapeHtml(swing)}</strong></span>
              <span>Direction <strong>${log.directionConfirmation ? `YES @ ${formatPrice(log.directionConfirmation.price)}` : "-"}</strong></span>
              <span>Entry / Stop <strong>${formatPrice(log.entry)} / ${formatPrice(log.stop)}</strong></span>
              <span>TP1 / TP2 <strong>${formatPrice(log.tp1)} / ${formatPrice(log.tp2)}</strong></span>
              <span>maxLots <strong>${log.maxLots ?? "-"}</strong></span>
              <span>現金 / 淨風險 <strong>${formatOptionalCurrency(log.cashRiskPerLot)} / ${formatOptionalCurrency(log.riskPerLot)}</strong></span>
            </div>

            <div class="replay-log-reason">
              ${escapeHtml(log.triggerReason || "-")}
              ${log.blockReason ? `<span>阻擋：${escapeHtml(log.blockReason)}</span>` : ""}
              ${log.exitReason ? `<span>出場 ${escapeHtml(log.exitReason)} @ ${formatPrice(log.exitPrice)}｜${formatCurrency(log.pnl)}｜${formatR(log.rMultiple)}</span>` : ""}
            </div>
          </article>
        `;

      }
    )
    .join("");


  return `
    <section class="replay-section replay-log-section">
      <div class="replay-section-heading">
        <div>
          <span class="replay-kicker">STATE STREAM</span>
          <h2>Replay LogBox</h2>
        </div>
        <span class="replay-range-label">${logs.length} 筆狀態／交易事件</span>
      </div>

      <div class="replay-logbox" role="log" aria-label="Replay 狀態變化紀錄">
        ${entries || '<div class="replay-empty-inline">此區間沒有 Replay Log。</div>'}
      </div>
    </section>
  `;

}


function renderEmptyState() {

  return `
    <section class="replay-empty-state">
      <span class="replay-empty-icon">5m</span>
      <h2>載入 Historical 5m JSON / CSV 開始回測</h2>
      <p>資料必須包含 dailySnapshots 與 sessions；每根盤中 K 棒需提供 timestamp、timeframeMinutes: 5、isComplete 與 OHLC。</p>
      <p>引擎會逐根送入同一套 Signal / Structure / Risk 邏輯，不會一次讀取整天資料，也不會使用當日或未來盤後資料。</p>
    </section>
  `;

}


export function renderReplayPanel(
  root,
  replayState,
  {
    onLoadDataset,
    onRangeChange
  }
) {

  const report =
    replayState.report;


  root.innerHTML = `
    <div class="replay-panel">
      <section class="replay-toolbar">
        <div class="replay-upload-group">
          <label class="replay-upload-button">
            載入 Historical 5m
            <input type="file" accept="application/json,text/csv,.json,.csv" data-role="replay-file">
          </label>
          <button type="button" class="replay-sample-button" data-role="replay-sample">載入模擬範例</button>
          <span>${escapeHtml(replayState.fileName || "尚未載入資料")}</span>
          ${renderSourceBadge(replayState)}
        </div>

        <div class="replay-range-controls" aria-label="回測日期區間">
          <button type="button" data-mode="today" class="${replayState.mode === "today" ? "active" : ""}">今日</button>
          <button type="button" data-mode="week" class="${replayState.mode === "week" ? "active" : ""}">本週</button>
          <button type="button" data-mode="custom" class="${replayState.mode === "custom" ? "active" : ""}">自訂</button>
          <input type="date" data-role="replay-from" value="${escapeHtml(replayState.from)}" aria-label="回測開始日期">
          <span>→</span>
          <input type="date" data-role="replay-to" value="${escapeHtml(replayState.to)}" aria-label="回測結束日期">
          <select data-role="replay-target" aria-label="回測出場目標">
            <option value="tp1" ${replayState.exitTarget === "tp1" ? "selected" : ""}>TP1 全數出場</option>
            <option value="tp2" ${replayState.exitTarget === "tp2" ? "selected" : ""}>TP2 全數出場</option>
          </select>
          <select data-role="replay-slippage" aria-label="Replay 滑價 Tick">
            <option value="0" ${replayState.slippageTicks === 0 ? "selected" : ""}>0 Tick 滑價</option>
            <option value="1" ${replayState.slippageTicks === 1 ? "selected" : ""}>1 Tick 滑價</option>
            <option value="2" ${replayState.slippageTicks === 2 ? "selected" : ""}>2 Tick 滑價</option>
          </select>
          <button type="button" class="replay-run-button" data-role="replay-run">重新計算</button>
        </div>
      </section>

      ${replayState.error
        ? `<div class="error-message replay-error">${escapeHtml(replayState.error)}</div>`
        : ""
      }

      ${report
        ? `
            ${renderSummary(report.summary, report.settings)}
            ${renderDailyTable(report.daily, report.summary)}
            ${renderTrades(report.trades)}
            ${renderInstruments(report.instruments)}
            ${renderLogBox(report.logs)}
          `
        : renderEmptyState()
      }
    </div>
  `;


  const fileInput =
    root.querySelector(
      '[data-role="replay-file"]'
    );


  fileInput.addEventListener(
    "change",
    async () => {

      const file =
        fileInput.files?.[0];


      if (
        !file
      ) {

        return;

      }


      try {
        const dataset =
          await importHistorical5mFile(
            file
          );


        onLoadDataset(
          dataset,
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


  root
  .querySelectorAll(
    "[data-mode]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {
          onRangeChange(
            {
              mode:
                button.dataset.mode
            }
          );
        }
      );

    }
  );


  root.querySelector(
    '[data-role="replay-run"]'
  )
  .addEventListener(
    "click",
    () => {
      onRangeChange(
        {
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
            )
        }
      );
    }
  );


  return [];

}
