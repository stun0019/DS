import {
  LIVE_CONFIG,
  TRADING_COST_CONFIG
} from "../core/config.js";

import {
  escapeHtml
} from "../utils/format.js";


function countEligibility(
  stocks
) {

  return stocks.reduce(
    (
      result,
      stock
    ) => {

      if (
        stock.DayTradeEligible ===
        true
      ) {
        result.dayTrade += 1;
      }


      if (
        stock.SellFirstDayTradeAllowed ===
        true
      ) {
        result.sellFirst += 1;
      }


      if (
        typeof stock.DayTradeEligible !==
        "boolean"
      ) {
        result.unknown += 1;
      }


      return result;

    },
    {
      dayTrade: 0,
      sellFirst: 0,
      unknown: 0
    }
  );

}


export function renderExecutionBar(
  root,
  {
    stocks = [],
    metadata = {},
    riskSettings = {},
    onRiskChange = () => {}
  } = {}
) {

  const eligibility =
    countEligibility(
      stocks
    );


  const eligibilityUpdatedAt =
    metadata
    .dayTradeEligibility
    ?.updatedAt
    ||
    "尚未同步";


  const maxRiskAmount =
    riskSettings.maxRiskAmount
    ||
    "";


  root.innerHTML = `

    <div class="execution-bar">

      <div class="execution-mode">
        <span class="system-pill premarket">
          盤前候選
        </span>

        <span class="system-pill mock">
          ${LIVE_CONFIG.mode === "mock" ? "模擬行情" : "即時行情"}
        </span>

        <span
          class="system-pill rebate"
          title="成交先收原始手續費，月退 72%，最終負擔 28 折"
        >
          手續費
          ${Math.round(
            TRADING_COST_CONFIG.commissionDiscountMultiplier
            *
            100
          )}
          折月退
        </span>
      </div>


      <div class="execution-metric">
        <span class="execution-label">
          當沖資格
        </span>

        <strong>
          ${eligibility.dayTrade.toLocaleString("zh-TW")}
        </strong>

        <span class="execution-separator">/</span>

        <span>
          可先賣
          ${eligibility.sellFirst.toLocaleString("zh-TW")}
        </span>

        <small title="官方資格資料更新時間">
          ${escapeHtml(
            eligibilityUpdatedAt
          )}
        </small>
      </div>


      <label class="risk-control">
        <span>
          單筆風險
        </span>

        <span class="risk-input-wrap">
          <span>NT$</span>

          <input
            type="number"
            inputmode="numeric"
            min="0"
            step="1000"
            value="${maxRiskAmount}"
            placeholder="未設定"
            data-role="max-risk-amount"
            aria-label="單筆最大風險金額"
          >
        </span>
      </label>

    </div>

  `;


  const input =
    root.querySelector(
      '[data-role="max-risk-amount"]'
    );


  input.addEventListener(
    "input",
    () => {
      onRiskChange(
        input.value
      );
    }
  );

}
