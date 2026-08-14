import {
  escapeHtml
} from "../utils/format.js";

import {
  getMarketName
} from "../data/stockData.js";


export function marketBadge(
  stock
) {

  const className =

    stock.Market ===
    "TPEX"

      ? "market-tpex"

      : "market-twse";


  return `

    <span
      class="
        market-badge
        ${className}
      "
    >
      ${escapeHtml(
        getMarketName(
          stock
        )
      )}
    </span>

  `;

}


export function strategyBadge(
  side
) {

  if (
    side ===
    "long"
  ) {

    return `

      <span
        class="
          strategy-badge
          long
        "
      >
        做多
      </span>

    `;

  }


  if (
    side ===
    "short"
  ) {

    return `

      <span
        class="
          strategy-badge
          short
        "
      >
        做空
      </span>

    `;

  }


  return "";

}
