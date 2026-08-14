import {
  toNumber
} from "./number.js";


export function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )

  .replace(
    /&/g,
    "&amp;"
  )

  .replace(
    /</g,
    "&lt;"
  )

  .replace(
    />/g,
    "&gt;"
  )

  .replace(
    /"/g,
    "&quot;"
  )

  .replace(
    /'/g,
    "&#039;"
  );

}


export function formatNumber(
  value
) {

  return toNumber(
    value
  )
  .toLocaleString(
    "zh-TW"
  );

}


export function formatPrice(
  value
) {

  const number =
    toNumber(
      value
    );


  if (
    number <= 0
  ) {

    return "-";

  }


  return number.toLocaleString(
    "zh-TW",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  );

}


export function formatCompactMoney(
  value
) {

  const number =
    toNumber(
      value
    );


  if (
    number >=
    100000000
  ) {

    const result =
      number
      /
      100000000;


    return (
      result.toFixed(
        result >= 100
          ? 1
          : 2
      )
      +
      "億"
    );

  }


  if (
    number >=
    10000
  ) {

    const result =
      number
      /
      10000;


    return (
      result.toFixed(
        result >= 100
          ? 0
          : 1
      )
      +
      "萬"
    );

  }


  return formatNumber(
    number
  );

}


export function formatCurrency(
  value,
  {
    maximumFractionDigits = 0
  } = {}
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "-";

  }


  return (
    "NT$"
    +
    number.toLocaleString(
      "zh-TW",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits
      }
    )
  );

}


export function formatTradeDate(
  value
) {

  const raw =
    String(
      value || ""
    )
    .replace(
      /\D/g,
      ""
    );


  if (
    raw.length === 8
  ) {

    return (
      `${raw.slice(0, 4)}/`
      +
      `${raw.slice(4, 6)}/`
      +
      `${raw.slice(6, 8)}`
    );

  }


  if (
    raw.length !== 7
  ) {

    return value || "-";

  }


  const year =
    Number(
      raw.slice(
        0,
        3
      )
    )
    +
    1911;


  return (
    `${year}/`
    +
    `${raw.slice(3, 5)}/`
    +
    `${raw.slice(5, 7)}`
  );

}


export function formatLocalDateTime(
  date
) {

  const pad =
    number =>
      String(
        number
      )
      .padStart(
        2,
        "0"
      );


  return (
    `${date.getFullYear()}-`
    +
    `${pad(date.getMonth() + 1)}-`
    +
    `${pad(date.getDate())} `
    +
    `${pad(date.getHours())}:`
    +
    `${pad(date.getMinutes())}:`
    +
    `${pad(date.getSeconds())}`
  );

}


export function formatPercent(
  value
) {

  const number =
    toNumber(
      value
    );


  return (
    (
      number > 0
        ? "+"
        : ""
    )
    +
    number.toFixed(2)
    +
    "%"
  );

}


export function formatSignedNumber(
  value
) {

  const number =
    toNumber(
      value
    );


  return (
    (
      number > 0
        ? "+"
        : ""
    )
    +
    number.toLocaleString(
      "zh-TW",
      {
        maximumFractionDigits: 2
      }
    )
  );

}
