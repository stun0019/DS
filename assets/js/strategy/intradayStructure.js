function normalizeCandle(
  candle
) {

  if (
    !candle
  ) {

    return null;

  }


  return {

    timestamp:
      candle.timestamp
      ??
      null,

    open:
      Number(
        candle.open
        ||
        0
      ),

    high:
      Number(
        candle.high
        ||
        0
      ),

    low:
      Number(
        candle.low
        ||
        0
      ),

    close:
      Number(
        candle.close
        ||
        0
      ),

    volume:
      Number(
        candle.volume
        ||
        0
      )

  };

}


export function findLatestSwingLow(
  candles
) {

  if (
    !Array.isArray(
      candles
    )
    ||
    candles.length < 3
  ) {

    return null;

  }


  const normalized =
    candles
    .map(
      normalizeCandle
    )
    .filter(
      Boolean
    );


  for (
    let index =
      normalized.length - 2;

    index >= 1;

    index -= 1
  ) {

    const previous =
      normalized[
        index - 1
      ];


    const current =
      normalized[
        index
      ];


    const next =
      normalized[
        index + 1
      ];


    if (
      current.low <
      previous.low
      &&
      current.low <=
      next.low
    ) {

      return {

        index,

        price:
          current.low,

        candle:
          current

      };

    }

  }


  return null;

}


export function findLatestSwingHigh(
  candles
) {

  if (
    !Array.isArray(
      candles
    )
    ||
    candles.length < 3
  ) {

    return null;

  }


  const normalized =
    candles
    .map(
      normalizeCandle
    )
    .filter(
      Boolean
    );


  for (
    let index =
      normalized.length - 2;

    index >= 1;

    index -= 1
  ) {

    const previous =
      normalized[
        index - 1
      ];


    const current =
      normalized[
        index
      ];


    const next =
      normalized[
        index + 1
      ];


    if (
      current.high >
      previous.high
      &&
      current.high >=
      next.high
    ) {

      return {

        index,

        price:
          current.high,

        candle:
          current

      };

    }

  }


  return null;

}


export function getIntradayStructuralStop(
  candles,
  side
) {

  if (
    side ===
    "long"
  ) {

    const swingLow =
      findLatestSwingLow(
        candles
      );


    return swingLow
      ? swingLow.price
      : null;

  }


  if (
    side ===
    "short"
  ) {

    const swingHigh =
      findLatestSwingHigh(
        candles
      );


    return swingHigh
      ? swingHigh.price
      : null;

  }


  return null;

}
