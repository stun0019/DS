export function getPriceTick(
  price
) {

  const value =
    Number(
      price
      ||
      0
    );


  if (
    value < 10
  ) {

    return 0.01;

  }


  if (
    value < 50
  ) {

    return 0.05;

  }


  if (
    value < 100
  ) {

    return 0.1;

  }


  if (
    value < 500
  ) {

    return 0.5;

  }


  if (
    value < 1000
  ) {

    return 1;

  }


  return 5;

}


export function roundToTick(
  price,
  direction = "nearest"
) {

  const value =
    Number(
      price
      ||
      0
    );


  if (
    value <= 0
  ) {

    return 0;

  }


  const tick =
    getPriceTick(
      value
    );


  const units =
    value
    /
    tick;


  let rounded;


  if (
    direction ===
    "up"
  ) {

    rounded =
      Math.ceil(
        units
        -
        1e-9
      );

  }

  else if (
    direction ===
    "down"
  ) {

    rounded =
      Math.floor(
        units
        +
        1e-9
      );

  }

  else {

    rounded =
      Math.round(
        units
      );

  }


  return Number(
    (
      rounded
      *
      tick
    )
    .toFixed(
      2
    )
  );

}


/*
取得目前價格往上的下一個合法 Tick。

例如：

9.99   → 10
49.95  → 50
99.9   → 100
499.5  → 500
999    → 1000
*/
export function getNextPrice(
  price
) {

  const value =
    Number(
      price
      ||
      0
    );


  if (
    value <= 0
  ) {

    return 0;

  }


  const tick =
    getPriceTick(
      value
    );


  const nextPrice =
    value
    +
    tick;


  return roundToTick(
    nextPrice,
    "up"
  );

}


/*
取得目前價格往下的上一個合法 Tick。

重要：

不能直接使用

price - getPriceTick(price)

因為在 Tick 級距邊界會錯。

例如：

50 元本身 Tick = 0.1

但 50 往下一檔真正應該是：

49.95

而不是：

49.90

所以計算往下 Tick 時，
必須取得「目前價格下方級距」的 Tick。
*/
export function getPreviousPrice(
  price
) {

  const value =
    Number(
      price
      ||
      0
    );


  if (
    value <= 0
  ) {

    return 0;

  }


  /*
  用極小值往價格下方探測，
  讓 10 / 50 / 100 / 500 / 1000
  這些級距邊界可以取得正確的前一級 Tick。
  */
  const probePrice =
    Math.max(
      value
      -
      1e-9,
      0
    );


  const previousTick =
    getPriceTick(
      probePrice
    );


  const previousPrice =
    value
    -
    previousTick;


  if (
    previousPrice <= 0
  ) {

    return 0;

  }


  return roundToTick(
    previousPrice,
    "down"
  );

}


export function getTickDistance(
  fromPrice,
  toPrice,
  maxSteps = 10000
) {

  const from =
    Number(
      fromPrice
      ||
      0
    );


  const to =
    Number(
      toPrice
      ||
      0
    );


  if (
    from <= 0
    ||
    to <= 0
  ) {
    return null;
  }


  if (
    Math.abs(
      from - to
    ) < 1e-9
  ) {
    return 0;
  }


  const direction =
    to > from
      ? "up"
      : "down";


  let cursor =
    from;


  for (
    let steps = 1;
    steps <= maxSteps;
    steps += 1
  ) {

    cursor =
      direction === "up"

        ? getNextPrice(
            cursor
          )

        : getPreviousPrice(
            cursor
          );


    if (
      cursor <= 0
    ) {
      return null;
    }


    if (
      direction === "up"
        ? cursor >= to
        : cursor <= to
    ) {
      return steps;
    }

  }


  return maxSteps + 1;

}
