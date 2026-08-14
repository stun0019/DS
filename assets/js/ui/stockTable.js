import {
  SORT_OPTIONS
} from "../core/config.js";

import {
  toNumber
} from "../utils/number.js";

import {
  escapeHtml,
  formatPrice,
  formatPercent
} from "../utils/format.js";

import {
  getTradeVolumeShares,
  getVolumeLots,
  getMarketName
} from "../data/stockData.js";

import {
  calculateChangePercent,
  calculateAmplitude,
  calculateClosePosition
} from "../strategy/candidateRules.js";

import {
  getStrategyScore
} from "../strategy/scoring.js";

import {
  calculateStrategyPrices
} from "../strategy/priceLevels.js";

import {
  marketBadge
} from "./badges.js";

import {
  renderStockCards
} from "./stockCard.js";


function getChangeClass(
  value
) {

  if (
    value > 0
  ) {

    return "up";

  }


  if (
    value < 0
  ) {

    return "down";

  }


  return "neutral";

}


function getSortValue(
  stock,
  key,
  type,
  side
) {

  switch (
    key
  ) {

    case "TradeVolume":

      return getTradeVolumeShares(
        stock
      );


    case "ChangePercent":

      return calculateChangePercent(
        stock
      );


    case "Amplitude":

      return calculateAmplitude(
        stock
      );


    case "ClosePosition":

      return calculateClosePosition(
        stock
      );


    case "StrategyScore":

      return getStrategyScore(
        stock,
        side
      );


    case "MarketName":

      return getMarketName(
        stock
      );


    default:

      if (
        type ===
        "number"
      ) {

        return toNumber(
          stock[key]
        );

      }


      return String(
        stock[key]
        ||
        ""
      );

  }

}


function sortRows(
  data,
  sortState,
  side
) {

  if (
    !sortState.key
  ) {

    return [
      ...data
    ];

  }


  return [...data]
  .sort(
    (
      a,
      b
    ) => {

      const aValue =
        getSortValue(
          a,
          sortState.key,
          sortState.type,
          side
        );


      const bValue =
        getSortValue(
          b,
          sortState.key,
          sortState.type,
          side
        );


      let result;


      if (
        sortState.type ===
        "number"
      ) {

        result =
          aValue
          -
          bValue;

      }

      else {

        result =
          String(
            aValue
          )
          .localeCompare(
            String(
              bValue
            ),
            "zh-Hant"
          );

      }


      return (
        sortState.direction ===
        "asc"
      )
        ? result
        : -result;

    }
  );

}


function buildSortOptions(
  side
) {

  return SORT_OPTIONS
  .filter(
    option => {

      if (
        option.strategyOnly
        &&
        !side
      ) {

        return false;

      }


      return true;

    }
  )
  .map(
    option => `

      <option
        value="${option.value}"
      >
        ${option.label}
      </option>

    `
  )
  .join("");

}


function renderTable(
  container,
  data,
  {
    side,
    sortState,
    onSort
  }
) {

  container.innerHTML = `

    <div class="table-scroll">

      <table class="stock-table">

        <thead>

          <tr>

            ${tableHeader(
              "MarketName",
              "text",
              "市場",
              sortState
            )}

            ${tableHeader(
              "Code",
              "text",
              "代號",
              sortState
            )}

            ${tableHeader(
              "Name",
              "text",
              "名稱",
              sortState
            )}

            ${tableHeader(
              "Industry",
              "text",
              "產業",
              sortState
            )}

            ${tableHeader(
              "TradeVolume",
              "number",
              "成交量／張",
              sortState
            )}

            ${tableHeader(
              "ClosingPrice",
              "number",
              "收盤",
              sortState
            )}

            ${tableHeader(
              "ChangePercent",
              "number",
              "漲跌幅",
              sortState
            )}

            ${tableHeader(
              "Amplitude",
              "number",
              "振幅",
              sortState
            )}

            ${tableHeader(
              "ClosePosition",
              "number",
              "收盤位置",
              sortState
            )}

            ${
              side
                ? tableHeader(
                    "StrategyScore",
                    "number",
                    "候選分數",
                    sortState
                  )
                : "<th>候選分數</th>"
            }

            <th>
              觸發參考
            </th>

            <th>
              防守參考
            </th>

            <th>
              TP1
            </th>

            <th>
              TP2
            </th>

          </tr>

        </thead>

        <tbody>
          ${renderRows(
            data,
            side
          )}
        </tbody>

      </table>

    </div>

  `;


  container
  .querySelectorAll(
    ".sortable"
  )
  .forEach(
    header => {

      header.addEventListener(
        "click",
        () => {

          const key =
            header.dataset.key;


          const type =
            header.dataset.type;


          let direction;


          if (
            sortState.key ===
            key
          ) {

            direction =

              sortState.direction ===
              "desc"

                ? "asc"

                : "desc";

          }

          else {

            direction =

              type ===
              "number"

                ? "desc"

                : "asc";

          }


          onSort(
            key,
            direction,
            type
          );

        }
      );

    }
  );

}


function tableHeader(
  key,
  type,
  label,
  sortState
) {

  const active =
    sortState.key ===
    key;


  const icon =
    active

      ? (
          sortState.direction ===
          "desc"
            ? "↓"
            : "↑"
        )

      : "";


  return `

    <th
      class="
        sortable
        ${active ? "active" : ""}
      "
      data-key="${key}"
      data-type="${type}"
    >

      ${label}

      <span class="sort-icon">
        ${icon}
      </span>

    </th>

  `;

}


function renderRows(
  data,
  side
) {

  if (
    data.length === 0
  ) {

    return `
      <tr>
        <td colspan="14">
          沒有資料
        </td>
      </tr>
    `;

  }


  return data
  .map(
    stock => {

      const changePercent =
        calculateChangePercent(
          stock
        );


      const amplitude =
        calculateAmplitude(
          stock
        );


      const closePosition =
        calculateClosePosition(
          stock
        );


      const score =
        side
          ? getStrategyScore(
              stock,
              side
            )
          : null;


      const prices =
        side
          ? calculateStrategyPrices(
              stock,
              side
            )
          : null;


      return `

        <tr>

          <td>
            ${marketBadge(
              stock
            )}
          </td>

          <td class="code">
            ${escapeHtml(
              stock.Code || ""
            )}
          </td>

          <td class="stock-name">
            ${escapeHtml(
              stock.Name || ""
            )}
          </td>

          <td class="industry">
            ${escapeHtml(
              stock.Industry ||
              "未分類"
            )}
          </td>

          <td>
            ${Math.round(
              getVolumeLots(
                stock
              )
            ).toLocaleString(
              "zh-TW"
            )}
          </td>

          <td>
            ${formatPrice(
              stock.ClosingPrice
            )}
          </td>

          <td
            class="${getChangeClass(
              changePercent
            )}"
          >
            ${formatPercent(
              changePercent
            )}
          </td>

          <td>
            ${amplitude.toFixed(2)}%
          </td>

          <td>
            ${(
              closePosition
              *
              100
            ).toFixed(0)}%
          </td>

          <td
            class="
              score
              ${side || ""}
            "
          >
            ${
              side
                ? score
                : "-"
            }
          </td>

          <td
            class="
              price-trigger
              ${
                side === "long"
                  ? "long-text"
                  : side === "short"
                    ? "short-text"
                    : ""
              }
            "
          >
            ${
              prices
                ? formatPrice(
                    prices.entry
                  )
                : "-"
            }
          </td>

          <td>
            ${
              prices
                ? formatPrice(
                    prices.stop
                  )
                : "-"
            }
          </td>

          <td>
            ${
              prices
                ? formatPrice(
                    prices.tp1
                  )
                : "-"
            }
          </td>

          <td>
            ${
              prices
                ? formatPrice(
                    prices.tp2
                  )
                : "-"
            }
          </td>

        </tr>

      `;

    }
  )
  .join("");

}


export function renderStockPanel(
  root,
  {
    data,
    side = null,
    rankMode = false,
    statusText = "",
    sortState,
    onSort,
    panelClass = ""
  }
) {

  const sortedRows =
    sortRows(
      data,
      sortState,
      side
    );


  root.innerHTML = `

    <div
      class="
        stock-panel
        ${panelClass}
      "
    >

      <section class="panel-controls">

        <div class="panel-status">
          ${statusText}
        </div>

        <div class="panel-hint">
          點擊欄位名稱排序
        </div>

        <div class="mobile-sort">

          <select
            class="sort-select"
            data-role="mobile-sort"
          >

            <option value="">
              排序方式
            </option>

            ${buildSortOptions(
              side
            )}

          </select>

        </div>

      </section>


      <section
        class="desktop-table"
        data-role="desktop-table"
      ></section>


      <section
        class="mobile-list"
        data-role="mobile-list"
      ></section>

    </div>

  `;


  const desktopTable =
    root.querySelector(
      '[data-role="desktop-table"]'
    );


  const mobileList =
    root.querySelector(
      '[data-role="mobile-list"]'
    );


  const mobileSort =
    root.querySelector(
      '[data-role="mobile-sort"]'
    );


  renderTable(
    desktopTable,
    sortedRows,
    {
      side,
      sortState,
      onSort
    }
  );


  renderStockCards(
    mobileList,
    sortedRows,
    {
      side,
      rankMode
    }
  );


  if (
    sortState.key
  ) {

    mobileSort.value =
      `${sortState.key}:`
      +
      `${sortState.direction}:`
      +
      `${sortState.type}`;

  }


  mobileSort.addEventListener(
    "change",
    () => {

      const value =
        mobileSort.value;


      if (
        !value
      ) {

        onSort(
          null,
          null,
          null
        );


        return;

      }


      const [
        key,
        direction,
        type
      ] =
        value.split(
          ":"
        );


      onSort(
        key,
        direction,
        type
      );

    }
  );


  return sortedRows;

}
