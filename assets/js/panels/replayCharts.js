import {
  escapeHtml,
  formatCurrency
} from "../utils/format.js";


export function renderReplayLineChart(
  values,
  {
    title,
    valueFormatter =
      formatCurrency,
    tone =
      "accent"
  }
) {

  if (
    values.length ===
      0
  ) {

    return `
      <section class="replay-chart-card">
        <header><h3>${title}</h3><span>尚無交易</span></header>
        <div class="replay-chart-empty">沒有可繪製的資料</div>
      </section>
    `;

  }

  const cumulative = [];
  let total =
    0;

  values.forEach(
    value => {

      total +=
        Number(
          value
          ??
          0
        );

      cumulative.push(
        total
      );

    }
  );

  const minimum =
    Math.min(
      0,
      ...cumulative
    );

  const maximum =
    Math.max(
      0,
      ...cumulative
    );

  const range =
    Math.max(
      1,
      maximum
      -
      minimum
    );

  const points =
    cumulative.map(
      (
        value,
        index
      ) => {

        const x =
          cumulative.length ===
            1

            ? 50

            : index
              /
              (
                cumulative.length
                -
                1
              )
              *
              100;

        const y =
          88
          -
          (
            value
            -
            minimum
          )
          /
          range
          *
          72;


        return `${x.toFixed(2)},${y.toFixed(2)}`;

      }
    )
    .join(" ");


  return `
    <section class="replay-chart-card">
      <header><h3>${title}</h3><strong class="${total >= 0 ? "positive-text" : "negative-text"}">${valueFormatter(total)}</strong></header>
      <svg class="replay-line-chart ${tone}" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${title}">
        <line x1="0" y1="88" x2="100" y2="88"></line>
        <line x1="0" y1="52" x2="100" y2="52"></line>
        <line x1="0" y1="16" x2="100" y2="16"></line>
        <polyline points="${points}"></polyline>
      </svg>
    </section>
  `;

}


export function renderReplayDailyBarChart(
  daily
) {

  const maximum =
    Math.max(
      1,
      ...daily.map(
        row =>
          Math.abs(
            Number(
              row.totalPnl
              ??
              0
            )
          )
      )
    );


  return `
    <section class="replay-chart-card">
      <header><h3>Daily P&L</h3><span>${daily.length} Sessions</span></header>
      <div class="replay-bar-chart">
        ${daily.map(row => {
          const value = Number(row.totalPnl ?? 0);
          return `<div class="replay-bar-column" title="${escapeHtml(row.date)} ${formatCurrency(value)}"><span class="${value >= 0 ? "positive" : "negative"}" style="height:${Math.max(4, Math.abs(value) / maximum * 82)}%"></span><small>${escapeHtml(row.date.slice(5))}</small></div>`;
        }).join("") || '<div class="replay-chart-empty">尚無每日績效</div>'}
      </div>
    </section>
  `;

}
