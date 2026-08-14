import {
  toNumber
} from "../utils/number.js";

import {
  getNextPrice,
  getPreviousPrice
} from "../utils/priceTick.js";


export function calculateObservationPrice(
  stock,
  side
) {

  const high =
    toNumber(
      stock.HighestPrice
    );


  const low =
    toNumber(
      stock.LowestPrice
    );


  if (
    high <= 0
    ||
    low <= 0
  ) {

    return 0;

  }


  /*
  做多：

  使用昨日最高價往上的
  下一個合法台股 Tick。

  例如：

  High 49.95
  → 50

  High 99.9
  → 100

  High 499.5
  → 500

  High 999
  → 1000
  */
  if (
    side ===
    "long"
  ) {

    return getNextPrice(
      high
    );

  }


  /*
  做空：

  使用昨日最低價往下的
  上一個合法台股 Tick。

  特別處理 Tick 級距邊界：

  Low 10
  → 9.99

  Low 50
  → 49.95

  Low 100
  → 99.9

  Low 500
  → 499.5

  Low 1000
  → 999
  */
  if (
    side ===
    "short"
  ) {

    return getPreviousPrice(
      low
    );

  }


  return 0;

}


export function calculatePremarketPlan(
  stock,
  side
) {

  const previousHigh =
    toNumber(
      stock.HighestPrice
    );


  const previousLow =
    toNumber(
      stock.LowestPrice
    );


  const previousClose =
    toNumber(
      stock.ClosingPrice
    );


  const observationPrice =
    calculateObservationPrice(
      stock,
      side
    );


  if (
    previousHigh <= 0
    ||
    previousLow <= 0
    ||
    observationPrice <= 0
  ) {

    return null;

  }


  return {

    side,

    observationPrice,

    previousHigh,

    previousLow,

    previousClose

  };

}
