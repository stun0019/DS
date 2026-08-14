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

    isComplete:
      isCompletedCandle(
        candle
      ),

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


export function isCompletedCandle(
  candle
) {

  if (
    !candle
  ) {

    return false;

  }


  const explicit =
    candle.isComplete
    ??
    candle.complete
    ??
    candle.completed
    ??
    candle.isClosed
    ??
    candle.closed
    ??
    candle.final;


  if (
    typeof explicit ===
    "boolean"
  ) {

    return explicit;

  }


  const status =
    String(
      candle.status
      ??
      ""
    )
    .trim()
    .toLowerCase();


  return [
    "closed",
    "complete",
    "completed",
    "final"
  ]
  .includes(
    status
  );

}


function toTimestamp(
  value
) {

  const timestamp =
    Date.parse(
      value
      ??
      ""
    );


  return Number.isFinite(
    timestamp
  )

    ? timestamp

    : null;

}


export function getCandlesAfter(
  candles,
  afterTimestamp
) {

  if (
    !Array.isArray(
      candles
    )
  ) {

    return [];

  }


  const boundary =
    toTimestamp(
      afterTimestamp
    );


  if (
    boundary === null
  ) {

    return [];

  }


  return candles
  .map(
    normalizeCandle
  )
  .map(
    candle => ({
      candle,
      timestamp:
        toTimestamp(
          candle?.timestamp
        )
    })
  )
  .filter(
    item =>
      item.candle?.isComplete ===
      true
      &&
      item.timestamp !== null
      &&
      item.timestamp > boundary
  )
  .sort(
    (
      first,
      second
    ) =>
      first.timestamp
      -
      second.timestamp
  )
  .map(
    item =>
      item.candle
  );

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
      candle =>
        candle?.isComplete ===
        true
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
      candle =>
        candle?.isComplete ===
        true
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
  side,
  {
    afterTimestamp = null
  } = {}
) {

  const eligibleCandles =
    afterTimestamp

      ? getCandlesAfter(
          candles,
          afterTimestamp
        )

      : candles;

  if (
    side ===
    "long"
  ) {

    const swingLow =
      findLatestSwingLow(
        eligibleCandles
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
        eligibleCandles
      );


    return swingHigh
      ? swingHigh.price
      : null;

  }


  return null;

}
