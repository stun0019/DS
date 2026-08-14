import {
  getCandidatesBySide
} from "../strategy/candidateSelector.js";

import {
  calculateAmplitude,
  calculateChangePercent
} from "../strategy/candidateRules.js";

import {
  getStrategyScore
} from "../strategy/scoring.js";

import {
  calculatePremarketPlan
} from "../strategy/priceLevels.js";

import {
  getVolumeLots
} from "../data/stockData.js";

import {
  escapeHtml,
  formatPercent,
  formatPrice
} from "../utils/format.js";


function candidateRows(
  candidates,
  side
) {

  return candidates.map(
    (
      stock,
      index
    ) => {

      const plan =
        calculatePremarketPlan(
          stock,
          side
        );

      const change =
        calculateChangePercent(
          stock
        );


      return `
        <article class="dashboard-candidate-row">
          <span class="dashboard-rank">${index + 1}</span>
          <div class="dashboard-symbol">
            <strong>${escapeHtml(stock.Code)}</strong>
            <span>${escapeHtml(stock.Name ?? "")}</span>
          </div>
          <span class="dashboard-industry">${escapeHtml(stock.Industry ?? "未分類")}</span>
          <strong class="dashboard-score">${getStrategyScore(stock, side)}</strong>
          <span class="dashboard-price">${formatPrice(stock.ClosingPrice)}</span>
          <span class="${change >= 0 ? "long-text" : "short-text"}">${formatPercent(change)}</span>
          <span>${Math.round(getVolumeLots(stock)).toLocaleString("zh-TW")} 張</span>
          <span>${formatPercent(calculateAmplitude(stock))}</span>
          <strong class="${side === "long" ? "long-text" : "short-text"}">${formatPrice(plan?.observationPrice)}</strong>
          <span>${stock.DayTradeEligible ? "可當沖" : "不可當沖"}</span>
        </article>
      `;

    }
  )
  .join("");

}


function candidateSection(
  title,
  side,
  candidates
) {

  return `
    <section class="dashboard-candidate-section ${side}">
      <header>
        <div>
          <span>${side.toUpperCase()} CANDIDATES</span>
          <h2>${title}</h2>
        </div>
        <span>${candidates.length} 檔</span>
      </header>
      <div class="dashboard-candidate-head" aria-hidden="true">
        <span>#</span><span>股票</span><span>產業</span><span>分數</span><span>收盤</span>
        <span>漲跌</span><span>成交量</span><span>振幅</span><span>觀察價</span><span>當沖</span>
      </div>
      <div class="dashboard-candidate-list">
        ${candidateRows(candidates, side)}
      </div>
    </section>
  `;

}


export function renderDashboardPanel(
  root,
  stocks,
  {
    metadata =
      {},
    freshness =
      null,
    onNavigate
  } =
    {}
) {

  const candidates =
    getCandidatesBySide(
      stocks
    );

  const marketCounts =
    metadata.marketCounts
    ??
    {
      TWSE:
        stocks.filter(
          stock =>
            stock.Market ===
              "TWSE"
        ).length,
      TPEX:
        stocks.filter(
          stock =>
            stock.Market ===
              "TPEX"
        ).length
    };


  root.innerHTML = `
    <div class="dashboard-panel">
      <section class="dashboard-market-strip">
        <div><span>資料日期</span><strong>${escapeHtml(metadata.tradeDateISO ?? metadata.tradeDate ?? "-")}</strong></div>
        <div><span>下一交易日</span><strong>${escapeHtml(metadata.validForTradingDate ?? "-")}</strong></div>
        <div><span>Data Freshness</span><strong class="${freshness?.isFresh ? "short-text" : "warning-text"}">${freshness?.isFresh ? "READY" : freshness?.status ?? "UNKNOWN"}</strong></div>
        <div><span>TWSE / TPEx</span><strong>${Number(marketCounts.TWSE ?? 0).toLocaleString("zh-TW")} / ${Number(marketCounts.TPEX ?? 0).toLocaleString("zh-TW")}</strong></div>
      </section>

      <nav class="dashboard-segments" aria-label="候選方向">
        <button type="button" data-dashboard-view="long">Long Candidates</button>
        <button type="button" data-dashboard-view="short">Short Candidates</button>
        <button type="button" data-dashboard-view="replay">Replay Backtest</button>
      </nav>

      <div class="dashboard-candidate-grid">
        ${candidateSection("多方候選", "long", candidates.long)}
        ${candidateSection("空方候選", "short", candidates.short)}
      </div>
    </div>
  `;

  root.querySelectorAll(
    "[data-dashboard-view]"
  )
  .forEach(
    button =>
      button.addEventListener(
        "click",
        () =>
          onNavigate?.(
            button.dataset.dashboardView
          )
      )
  );


  return [
    ...candidates.long,
    ...candidates.short
  ];

}
