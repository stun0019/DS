import {
  escapeHtml,
  formatPrice,
  formatCompactMoney,
  formatNumber,
  formatPercent,
  formatSignedNumber
} from "../utils/format.js";

import {
  getVolumeLots
} from "../data/stockData.js";

import {
  calculatePreviousClose,
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
  marketBadge,
  strategyBadge
} from "./badges.js";


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


function formatVolume(
  stock
) {

  return (
    Math.round(
      getVolumeLots(
        stock
      )
    )
    .toLocaleString(
      "zh-TW"
    )
    +
    "張"
  );

}


function strategyPriceHtml(
  prices,
  side
) {

  if (
    !prices
  ) {

    return "";

  }


  return `

    <div class="strategy-price-row">

      <div class="strategy-price">

        <div class="strategy-price-label">
          觸發
        </div>

        <div
          class="
            strategy-price-value
            ${
              side === "long"
                ? "long-text"
                : "short-text"
            }
          "
        >
          ${formatPrice(
            prices.entry
          )}
        </div>

      </div>


      <div class="strategy-price">

        <div class="strategy-price-label">
          防守
        </div>

        <div class="strategy-price-value">
          ${formatPrice(
            prices.stop
          )}
        </div>

      </div>


      <div class="strategy-price">

        <div class="strategy-price-label">
          TP1
        </div>

        <div class="strategy-price-value">
          ${formatPrice(
            prices.tp1
          )}
        </div>

      </div>


      <div class="strategy-price">

        <div class="strategy-price-label">
          TP2
        </div>

        <div class="strategy-price-value">
          ${formatPrice(
            prices.tp2
          )}
        </div>

      </div>

    </div>

  `;

}


export function renderStockCards(
  container,
  data,
  {
    side = null,
    rankMode = false
  } = {}
) {

  container.classList.toggle(
    "rank-mode",
    rankMode
  );


  if (
    data.length === 0
  ) {

    container.innerHTML =
      `
        <div class="empty">
          ${
            side
              ? "目前沒有符合篩選規則的候選股"
              : "沒有資料"
          }
        </div>
      `;


    return;

  }


  container.innerHTML =
    data
    .map(
      (
        stock,
        index
      ) => {

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

          <article
            class="
              mobile-stock-card
              ${
                side
                  ? `strategy-${side}`
                  : ""
              }
            "
            tabindex="0"
          >

            <div class="mobile-card-summary">

              <div
                class="
                  mobile-line
                  mobile-line-primary
                "
              >

                <span class="mobile-rank">
                  #${index + 1}
                </span>

                <span class="mobile-name">
                  ${escapeHtml(
                    stock.Name || ""
                  )}
                </span>

                <span class="mobile-code">
                  ${escapeHtml(
                    stock.Code || ""
                  )}
                </span>

                ${marketBadge(
                  stock
                )}

                ${strategyBadge(
                  side
                )}

                ${
                  side

                    ? `
                        <span
                          class="
                            mobile-score
                            ${
                              side ===
                              "long"
                                ? "long-text"
                                : "short-text"
                            }
                          "
                        >
                          ${score}分
                        </span>
                      `

                    : `
                        <span
                          class="
                            mobile-change-percent
                            ${getChangeClass(
                              changePercent
                            )}
                          "
                        >
                          ${formatPercent(
                            changePercent
                          )}
                        </span>
                      `
                }

              </div>


              <div
                class="
                  mobile-line
                  mobile-line-secondary
                "
              >

                <span class="mobile-industry-inline">
                  ${escapeHtml(
                    stock.Industry ||
                    "未分類"
                  )}
                </span>

                <span class="mobile-divider">
                  |
                </span>

                <span class="mobile-stat-inline">
                  成交量
                  ${formatVolume(
                    stock
                  )}
                </span>

                <span class="mobile-divider">
                  |
                </span>

                <span class="mobile-stat-inline">

                  ${
                    side
                      ? `漲跌 ${formatPercent(
                          changePercent
                        )}`
                      : `成交金額 ${formatCompactMoney(
                          stock.TradeValue
                        )}`
                  }

                </span>

              </div>


              <div class="mobile-ohlc-row">

                開
                ${formatPrice(
                  stock.OpeningPrice
                )}

                ｜高
                ${formatPrice(
                  stock.HighestPrice
                )}

                ｜低
                ${formatPrice(
                  stock.LowestPrice
                )}

                ｜收
                ${formatPrice(
                  stock.ClosingPrice
                )}

              </div>


              ${strategyPriceHtml(
                prices,
                side
              )}

            </div>


            <span class="mobile-arrow"></span>


            <div class="mobile-card-details">

              <div class="detail-grid">

                <div class="detail-item">

                  <div class="detail-label">
                    漲跌幅
                  </div>

                  <div
                    class="
                      detail-value
                      ${getChangeClass(
                        changePercent
                      )}
                    "
                  >
                    ${formatPercent(
                      changePercent
                    )}
                  </div>

                </div>


                <div class="detail-item">

                  <div class="detail-label">
                    振幅
                  </div>

                  <div class="detail-value">
                    ${amplitude.toFixed(2)}%
                  </div>

                </div>


                <div class="detail-item">

                  <div class="detail-label">
                    收盤位置
                  </div>

                  <div class="detail-value">
                    ${(
                      closePosition
                      *
                      100
                    ).toFixed(0)}%
                  </div>

                </div>


                <div class="detail-item">

                  <div class="detail-label">
                    流動性排名
                  </div>

                  <div class="detail-value">
                    #${(
                      stock.__liquidityRank
                      ||
                      0
                    ).toLocaleString(
                      "zh-TW"
                    )}
                  </div>

                </div>


                <div class="detail-item">

                  <div class="detail-label">
                    昨收
                  </div>

                  <div class="detail-value">
                    ${formatPrice(
                      calculatePreviousClose(
                        stock
                      )
                    )}
                  </div>

                </div>


                <div class="detail-item">

                  <div class="detail-label">
                    漲跌價差
                  </div>

                  <div
                    class="
                      detail-value
                      ${getChangeClass(
                        Number(
                          stock.Change
                        )
                      )}
                    "
                  >
                    ${formatSignedNumber(
                      stock.Change
                    )}
                  </div>

                </div>


                <div class="detail-item">

                  <div class="detail-label">
                    成交筆數
                  </div>

                  <div class="detail-value">
                    ${formatNumber(
                      stock.Transaction
                    )}
                  </div>

                </div>


                <div class="detail-item">

                  <div class="detail-label">
                    成交金額
                  </div>

                  <div class="detail-value">
                    ${formatCompactMoney(
                      stock.TradeValue
                    )}
                  </div>

                </div>


                <div class="detail-item">

                  <div class="detail-label">
                    券商可比成交量
                  </div>

                  <div class="detail-value">
                    ${formatVolume(
                      stock
                    )}
                  </div>

                </div>


                ${
                  side
                    ? `

                        <div class="detail-item">

                          <div class="detail-label">
                            候選分數
                          </div>

                          <div
                            class="
                              detail-value
                              ${
                                side ===
                                "long"
                                  ? "long-text"
                                  : "short-text"
                              }
                            "
                          >
                            ${score} / 100
                          </div>

                        </div>


                        <div class="detail-item">

                          <div class="detail-label">
                            觸發參考
                          </div>

                          <div class="detail-value">
                            ${prices
                              ? formatPrice(
                                  prices.entry
                                )
                              : "-"
                            }
                          </div>

                        </div>


                        <div class="detail-item">

                          <div class="detail-label">
                            防守參考
                          </div>

                          <div class="detail-value">
                            ${prices
                              ? formatPrice(
                                  prices.stop
                                )
                              : "-"
                            }
                          </div>

                        </div>


                        <div class="detail-item">

                          <div class="detail-label">
                            TP1 / 1R
                          </div>

                          <div class="detail-value">
                            ${prices
                              ? formatPrice(
                                  prices.tp1
                                )
                              : "-"
                            }
                          </div>

                        </div>


                        <div class="detail-item">

                          <div class="detail-label">
                            TP2 / 2R
                          </div>

                          <div class="detail-value">
                            ${prices
                              ? formatPrice(
                                  prices.tp2
                                )
                              : "-"
                            }
                          </div>

                        </div>

                      `
                    : ""
                }

              </div>

            </div>

          </article>

        `;

      }
    )
    .join("");


  container
  .querySelectorAll(
    ".mobile-stock-card"
  )
  .forEach(
    card => {

      const toggle =
        () => {

          card.classList.toggle(
            "expanded"
          );

        };


      card.addEventListener(
        "click",
        toggle
      );


      card.addEventListener(
        "keydown",
        event => {

          if (
            event.key ===
            "Enter"
            ||
            event.key ===
            " "
          ) {

            event.preventDefault();

            toggle();

          }

        }
      );

    }
  );

}
