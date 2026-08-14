import {
  formatTradeDate
} from "../utils/format.js";

import {
  countMarkets
} from "../data/stockData.js";


export function renderSummary(
  root,
  {
    metadata = {},
    pageReadAt = "-",
    stocks = [],
    countLabel = "-"
  }
) {

  const markets =
    countMarkets(
      stocks
    );


  const tradeDate =

    metadata.tradeDateISO

      ? metadata.tradeDateISO.replace(
          /-/g,
          "/"
        )

      : formatTradeDate(
          metadata.tradeDate
        );


  const updatedAt =
    metadata.updatedAt
    ||
    "-";


  root.innerHTML = `

    <div class="summary-card">

      <div class="summary-label">
        交易日期
      </div>

      <div class="summary-value">
        ${tradeDate}
      </div>

    </div>


    <div class="summary-card">

      <div class="summary-label">
        目前顯示
      </div>

      <div class="summary-value">
        ${countLabel}
      </div>

    </div>


    <div class="summary-card">

      <div class="summary-label">
        資料產生
      </div>

      <div class="summary-value">
        ${updatedAt}
      </div>

    </div>


    <div class="summary-card">

      <div class="summary-label">
        頁面讀取
      </div>

      <div
        class="summary-value"
        title="
          上市 ${markets.twse}
          /
          上櫃 ${markets.tpex}
        "
      >
        ${pageReadAt || "-"}
      </div>

    </div>

  `;

}
