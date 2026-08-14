export const MIN_INTRADAY_TIMEFRAME_MINUTES = 5;


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


export function getCandleTimeframeMinutes(
  candle
) {

  const explicit =
    Number(
      candle?.timeframeMinutes
      ??
      candle?.intervalMinutes
      ??
      candle?.durationMinutes
      ??
      0
    );


  if (
    Number.isFinite(
      explicit
    )
    &&
    explicit > 0
  ) {

    return explicit;

  }


  const label =
    String(
      candle?.timeframe
      ??
      candle?.interval
      ??
      ""
    )
    .trim()
    .toLowerCase();


  const match =
    label.match(
      /^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)$/
    );


  return match

    ? Number(
        match[1]
      )

    : null;

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


export function isSupportedStructureCandle(
  candle
) {

  const timeframeMinutes =
    getCandleTimeframeMinutes(
      candle
    );


  return (
    timeframeMinutes !==
      null
    &&
    timeframeMinutes >=
      MIN_INTRADAY_TIMEFRAME_MINUTES
  );

}


export function normalizeIntradayCandle(
  candle,
  fallbackTimeframeMinutes =
    null
) {

  if (
    !candle
  ) {

    return null;

  }


  const fallback =
    Number(
      fallbackTimeframeMinutes
      ||
      0
    );

  const timeframeMinutes =
    getCandleTimeframeMinutes(
      candle
    )
    ??
    (
      fallback > 0

        ? fallback

        : null
    );


  return {
    timestamp:
      candle.timestamp
      ??
      null,
    timeframeMinutes,
    isComplete:
      isCompletedCandle(
        candle
      ),
    open:
      Number(
        candle.open
        ??
        0
      ),
    high:
      Number(
        candle.high
        ??
        0
      ),
    low:
      Number(
        candle.low
        ??
        0
      ),
    close:
      Number(
        candle.close
        ??
        0
      ),
    volume:
      Number(
        candle.volume
        ??
        0
      )
  };

}


function normalizeCompletedCandles(
  candles
) {

  if (
    !Array.isArray(
      candles
    )
  ) {

    return [];

  }


  return candles
  .map(
    candle => ({
      candle:
        normalizeIntradayCandle(
          candle
        ),
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
      isSupportedStructureCandle(
        item.candle
      )
      &&
      item.timestamp !==
        null
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


export function getCandlesAfter(
  candles,
  afterTimestamp
) {

  const boundary =
    toTimestamp(
      afterTimestamp
    );


  if (
    boundary ===
    null
  ) {

    return [];

  }


  return normalizeCompletedCandles(
    candles
  )
  .filter(
    candle =>
      toTimestamp(
        candle.timestamp
      ) >
      boundary
  );

}


export function findPostBreakoutPullback(
  candles,
  side
) {

  const normalized =
    normalizeCompletedCandles(
      candles
    );


  for (
    let index = 1;
    index < normalized.length;
    index += 1
  ) {

    const previous =
      normalized[
        index - 1
      ];

    const current =
      normalized[
        index
      ];


    const isPullback =
      side ===
      "long"

        ? current.low <
          previous.low

        : side ===
          "short"

          ? current.high >
            previous.high

          : false;


    if (
      isPullback
    ) {

      return {
        index,
        timestamp:
          current.timestamp,
        price:
          side ===
          "long"

            ? current.low

            : current.high,
        candle:
          current
      };

    }

  }


  return null;

}


export function findLatestSwingLow(
  candles
) {

  const normalized =
    normalizeCompletedCandles(
      candles
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
        type:
          "SWING_LOW",
        price:
          current.low,
        timestamp:
          current.timestamp,
        formedAt:
          next.timestamp,
        candle:
          current,
        confirmationCandle:
          next
      };

    }

  }


  return null;

}


export function findLatestSwingHigh(
  candles
) {

  const normalized =
    normalizeCompletedCandles(
      candles
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
        type:
          "SWING_HIGH",
        price:
          current.high,
        timestamp:
          current.timestamp,
        formedAt:
          next.timestamp,
        candle:
          current,
        confirmationCandle:
          next
      };

    }

  }


  return null;

}


export function findDirectionConfirmation(
  candles,
  side,
  {
    afterTimestamp =
      null
  } = {}
) {

  const boundary =
    toTimestamp(
      afterTimestamp
    );

  const normalized =
    normalizeCompletedCandles(
      candles
    );


  if (
    boundary ===
    null
  ) {

    return null;

  }


  for (
    let index = 1;
    index < normalized.length;
    index += 1
  ) {

    const previous =
      normalized[
        index - 1
      ];

    const current =
      normalized[
        index
      ];

    const previousTimestamp =
      toTimestamp(
        previous.timestamp
      );

    const currentTimestamp =
      toTimestamp(
        current.timestamp
      );


    if (
      previousTimestamp <
        boundary
      ||
      currentTimestamp <=
        boundary
    ) {

      continue;

    }


    const isConfirmed =
      side ===
      "long"

        ? current.close >
          previous.high

        : side ===
          "short"

          ? current.close <
            previous.low

          : false;


    if (
      isConfirmed
    ) {

      return {
        side,
        timestamp:
          current.timestamp,
        price:
          current.close,
        threshold:
          side ===
          "long"

            ? previous.high

            : previous.low,
        candle:
          current,
        previousCandle:
          previous
      };

    }

  }


  return null;

}


export function getPostBreakoutStructure(
  candles,
  side,
  {
    afterTimestamp =
      null,
    confirmationAfterTimestamp =
      null
  } = {}
) {

  const eligibleCandles =
    getCandlesAfter(
      candles,
      afterTimestamp
    );

  const pullback =
    findPostBreakoutPullback(
      eligibleCandles,
      side
    );

  const swing =
    side ===
    "long"

      ? findLatestSwingLow(
          eligibleCandles
        )

      : side ===
        "short"

        ? findLatestSwingHigh(
            eligibleCandles
          )

        : null;

  const directionConfirmation =
    swing

      ? findDirectionConfirmation(
          eligibleCandles,
          side,
          {
            afterTimestamp:
              confirmationAfterTimestamp
              ??
              swing.formedAt
          }
        )

      : null;


  return {
    eligibleCandles,
    pullback,
    swing,
    directionConfirmation
  };

}


export function getIntradayStructuralStop(
  candles,
  side,
  {
    afterTimestamp =
      null
  } = {}
) {

  const structure =
    getPostBreakoutStructure(
      candles,
      side,
      {
        afterTimestamp
      }
    );


  return structure.swing

    ? structure.swing.price

    : null;

}
