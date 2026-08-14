import {
  DATA_URL
} from "../core/config.js";

import {
  toNumber
} from "../utils/number.js";

import {
  formatLocalDateTime
} from "../utils/format.js";


const VOLUME_FIELDS = [

  "BrokerComparableVolume",

  "AdjustedTradeVolume",

  "RegularTradeVolume",

  "NonOddLotTradeVolume",

  "TradeVolume"

];


export function getTradeVolumeShares(
  stock
) {

  for (
    const field
    of VOLUME_FIELDS
  ) {

    if (
      stock[field] !== undefined
      &&
      stock[field] !== null
      &&
      stock[field] !== ""
    ) {

      return Math.max(
        0,
        toNumber(
          stock[field]
        )
      );

    }

  }


  return 0;

}


export function getVolumeLots(
  stock
) {

  return (
    getTradeVolumeShares(
      stock
    )
    /
    1000
  );

}


export function getMarketName(
  stock
) {

  if (
    stock.MarketName
  ) {

    return stock.MarketName;

  }


  return (
    stock.Market ===
    "TPEX"
  )
    ? "上櫃"
    : "上市";

}


export function countMarkets(
  stocks
) {

  return {

    twse:
      stocks.filter(
        stock =>
          stock.Market ===
          "TWSE"
      ).length,

    tpex:
      stocks.filter(
        stock =>
          stock.Market ===
          "TPEX"
      ).length

  };

}


export function assignLiquidityRanks(
  stocks
) {

  const ranked =
    [...stocks]
    .sort(
      (
        a,
        b
      ) =>

        getTradeVolumeShares(
          b
        )

        -

        getTradeVolumeShares(
          a
        )
    );


  ranked.forEach(
    (
      stock,
      index
    ) => {

      stock.__liquidityRank =
        index + 1;

    }
  );

}


function isValidStock(
  stock
) {

  const code =
    String(
      stock.Code
      ||
      ""
    )
    .trim();


  return (

    code !== ""

    &&

    toNumber(
      stock.OpeningPrice
    ) > 0

    &&

    toNumber(
      stock.HighestPrice
    ) > 0

    &&

    toNumber(
      stock.LowestPrice
    ) > 0

    &&

    toNumber(
      stock.ClosingPrice
    ) > 0

  );

}


export async function loadStockData() {

  const response =
    await fetch(
      `${DATA_URL}?t=${Date.now()}`,
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


  const json =
    await response.json();


  const data =
    Array.isArray(
      json
    )
      ? json
      : json.data;


  if (
    !Array.isArray(
      data
    )
  ) {

    throw new Error(
      "stocks.json 格式錯誤"
    );

  }


  const stocks =
    data.filter(
      isValidStock
    );


  const metadata =
    Array.isArray(
      json
    )
      ? {}
      : {

          tradeDate:
            json.tradeDate || "",

          tradeDateISO:
            json.tradeDateISO || "",

          updatedAt:
            json.updatedAt || "",

          volumeMode:
            json.volumeMode || "",

          syncStatus:
            json.syncStatus || "",

          marketCounts:
            json.marketCounts || {}

        };


  return {

    stocks,

    metadata,

    pageReadAt:
      formatLocalDateTime(
        new Date()
      )

  };

}
