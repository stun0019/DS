import {
  LIVE_CONFIG
} from "../core/config.js";

import {
  getTickDistance
} from "../utils/priceTick.js";

import {
  calculatePremarketPlan
} from "../strategy/priceLevels.js";

import {
  getPostBreakoutStructure,
  isSupportedStructureCandle,
  normalizeIntradayCandle
} from "../strategy/intradayStructure.js";

import {
  calculateRiskPlan
} from "../strategy/riskEngine.js";

import {
  LIVE_STATUS,
  getLiveState,
  resetLiveState,
  setLiveState
} from "./liveState.js";


const TRIGGERED_STATUSES =
  new Set(
    [
      LIVE_STATUS.TRIGGERED,
      LIVE_STATUS.CONFIRMING,
      LIVE_STATUS.ENTRY_READY,
      LIVE_STATUS.RISK_BLOCKED
    ]
  );


const SESSION_DATE_FORMATTER =
  new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "Asia/Taipei",
      year:
        "numeric",
      month:
        "2-digit",
      day:
        "2-digit"
    }
  );


export function getTradingSessionDate(
  timestamp
) {

  const date =
    new Date(
      timestamp
      ??
      ""
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  const parts =
    Object.fromEntries(
      SESSION_DATE_FORMATTER
      .formatToParts(
        date
      )
      .filter(
        part =>
          part.type !==
          "literal"
      )
      .map(
        part => [
          part.type,
          part.value
        ]
      )
    );


  return (
    `${parts.year}-`
    +
    `${parts.month}-`
    +
    `${parts.day}`
  );

}


function getQuoteTime(
  timestamp
) {

  const milliseconds =
    new Date(
      timestamp
      ??
      ""
    )
    .getTime();


  if (
    Number.isNaN(
      milliseconds
    )
  ) {

    return null;

  }


  return {
    milliseconds,
    timestamp:
      new Date(
        milliseconds
      )
      .toISOString()
  };

}


function mergeStructuralCandles(
  previousState,
  quote
) {

  const quoteTime =
    getQuoteTime(
      quote?.timestamp
    );


  if (
    !quoteTime
  ) {

    return previousState?.candles
    ??
    [];

  }


  const fallbackTimeframeMinutes =
    quote?.candleTimeframeMinutes
    ??
    quote?.timeframeMinutes
    ??
    null;

  const merged =
    new Map();


  [
    ...(
      previousState?.candles
      ??
      []
    ),
    ...(
      Array.isArray(
        quote?.candles
      )

        ? quote.candles

        : []
    )
  ]
  .forEach(
    candle => {

      const normalized =
        normalizeIntradayCandle(
          candle,
          fallbackTimeframeMinutes
        );

      const candleTime =
        getQuoteTime(
          normalized?.timestamp
        );


      if (
        !normalized
        ||
        !candleTime
        ||
        candleTime.milliseconds >
          quoteTime.milliseconds
        ||
        !isSupportedStructureCandle(
          normalized
        )
      ) {

        return;

      }


      merged.set(
        candleTime.timestamp,
        {
          ...normalized,
          timestamp:
            candleTime.timestamp
        }
      );

    }
  );


  return [
    ...merged.values()
  ]
  .sort(
    (
      first,
      second
    ) =>
      Date.parse(
        first.timestamp
      )
      -
      Date.parse(
        second.timestamp
      )
  );

}


function hasTriggered(
  side,
  last,
  observationPrice
) {

  return side === "long"

    ? last >= observationPrice

    : side === "short"
      ? last <= observationPrice
      : false;

}


function watchingResult(
  plan,
  last
) {

  const distanceTicks =
    getTickDistance(
      last,
      plan.observationPrice
    );


  return {
    status:
      distanceTicks !== null
      &&
      distanceTicks <=
      LIVE_CONFIG.nearTriggerTicks

        ? LIVE_STATUS.NEAR_TRIGGER

        : LIVE_STATUS.WATCHING,

    observationPrice:
      plan.observationPrice,

    distanceTicks
  };

}


function invalidatedResult(
  plan,
  last,
  quote,
  previousState
) {

  const observationPrice =
    plan?.observationPrice
    ??
    previousState?.observationPrice
    ??
    null;


  const candles =
    mergeStructuralCandles(
      previousState,
      quote
    );


  return {
    status:
      LIVE_STATUS.INVALIDATED,
    observationPrice,
    distanceTicks:
      last > 0
      &&
      observationPrice

        ? getTickDistance(
            last,
            observationPrice
          )

        : previousState?.distanceTicks
          ??
          null,
    candles,
    triggeredAt:
      previousState?.triggeredAt
      ??
      null,
    triggerPrice:
      previousState?.triggerPrice
      ??
      null,
    pullbackAt:
      previousState?.pullbackAt
      ??
      null,
    swing:
      previousState?.swing
      ??
      null,
    directionConfirmedAt:
      null,
    directionConfirmation:
      null,
    entryReadyAt:
      null,
    riskBlockedAt:
      previousState?.riskBlockedAt
      ??
      null,
    blockReason:
      "今日劇本失效",
    entry:
      null,
    stop:
      null,
    riskPlan:
      null
  };

}


function dataStaleResult(
  plan,
  freshness
) {

  return {
    status:
      LIVE_STATUS.DATA_STALE,
    observationPrice:
      plan?.observationPrice
      ??
      null,
    distanceTicks:
      null,
    candles: [],
    triggeredAt: null,
    triggerPrice: null,
    pullbackAt: null,
    swing: null,
    directionConfirmedAt: null,
    directionConfirmation: null,
    entryReadyAt: null,
    riskBlockedAt: null,
    blockReason:
      freshness?.reason
      ??
      "候選資料過期",
    entry: null,
    stop: null,
    riskPlan: null,
    candidateDataFreshness:
      freshness
  };

}


function activeSignalResult(
  stock,
  side,
  quote,
  plan,
  previousState,
  maxRiskAmount
) {

  const last =
    Number(
      quote.last
    );


  const triggeredAt =
    previousState?.triggeredAt
    ||
    quote.timestamp
    ||
    new Date()
    .toISOString();


  const triggerPrice =
    previousState?.triggerPrice
    ||
    last;


  const candles =
    mergeStructuralCandles(
      previousState,
      quote
    );


  const baseResult = {
    observationPrice:
      plan.observationPrice,

    distanceTicks: 0,
    triggeredAt,
    triggerPrice,
    candles,
    pullbackAt:
      previousState?.pullbackAt
      ??
      null,
    swing:
      previousState?.swing
      ??
      null,
    directionConfirmedAt:
      previousState?.directionConfirmedAt
      ??
      null,
    directionConfirmation:
      previousState?.directionConfirmation
      ??
      null,
    entryReadyAt:
      previousState?.entryReadyAt
      ??
      null,
    riskBlockedAt:
      previousState?.riskBlockedAt
      ??
      null,
    blockReason:
      previousState?.blockReason
      ??
      null
  };


  if (
    previousState?.status ===
    LIVE_STATUS.ENTRY_READY
  ) {

    const refreshedRiskPlan =
      calculateRiskPlan(
        {
          entry:
            previousState.entry,
          stop:
            previousState.stop,
          side,
          maxRiskAmount
        }
      )
      ||
      previousState.riskPlan;

    const isBlocked =
      refreshedRiskPlan?.maxLots ===
      0;


    return {
      ...baseResult,
      status:
        isBlocked

          ? LIVE_STATUS.RISK_BLOCKED

          : LIVE_STATUS.ENTRY_READY,
      entry:
        previousState.entry,
      stop:
        previousState.stop,
      riskPlan:
        refreshedRiskPlan,
      entryReadyAt:
        isBlocked

          ? null

          : previousState.entryReadyAt
            ??
            quote.timestamp,
      riskBlockedAt:
        isBlocked

          ? quote.timestamp

          : null,
      blockReason:
        isBlocked

          ? "單筆現金風險超過上限"

          : null
    };

  }


  const confirmationAfterTimestamp =
    previousState?.riskBlockedAt
    ??
    null;

  const structure =
    getPostBreakoutStructure(
      candles,
      side,
      {
        afterTimestamp:
          triggeredAt,
        confirmationAfterTimestamp
      }
    );


  if (
    !structure.pullback
  ) {

    return {
      ...baseResult,
      status:
        previousState?.riskBlockedAt

          ? LIVE_STATUS.CONFIRMING

          : LIVE_STATUS.TRIGGERED,
      pullbackAt: null,
      swing: null,
      directionConfirmedAt: null,
      directionConfirmation: null,
      entryReadyAt: null,
      entry: null,
      stop: null,
      riskPlan: null,
      blockReason:
        previousState?.riskBlockedAt

          ? "等待新的 Pullback 與方向確認"

          : null
    };

  }


  const structureResult = {
    pullbackAt:
      structure.pullback.timestamp,
    swing:
      structure.swing,
    directionConfirmedAt:
      structure.directionConfirmation?.timestamp
      ??
      null,
    directionConfirmation:
      structure.directionConfirmation
  };


  if (
    !structure.swing
  ) {

    return {
      ...baseResult,
      ...structureResult,
      status:
        LIVE_STATUS.CONFIRMING,
      entryReadyAt: null,
      entry: null,
      stop: null,
      riskPlan: null,
      blockReason:
        "等待突破後 Swing"
    };

  }


  const stop =
    structure.swing.price;


  if (
    !structure.directionConfirmation
  ) {

    if (
      previousState?.riskBlockedAt
    ) {

      const refreshedRiskPlan =
        calculateRiskPlan(
          {
            entry:
              last,
            stop,
            side,
            maxRiskAmount
          }
        );


      return {
        ...baseResult,
        ...structureResult,
        status:
          refreshedRiskPlan?.maxLots ===
          0

            ? LIVE_STATUS.RISK_BLOCKED

            : LIVE_STATUS.CONFIRMING,
        entryReadyAt: null,
        riskBlockedAt:
          previousState.riskBlockedAt,
        entry:
          refreshedRiskPlan?.entry
          ??
          null,
        stop,
        riskPlan:
          refreshedRiskPlan,
        blockReason:
          refreshedRiskPlan?.maxLots ===
          0

            ? "單筆現金風險超過上限"

            : "風險已可接受，等待方向再次確認"
      };

    }


    return {
      ...baseResult,
      ...structureResult,
      status:
        LIVE_STATUS.CONFIRMING,
      entryReadyAt: null,
      riskBlockedAt: null,
      entry: null,
      stop,
      riskPlan: null,
      blockReason:
        "等待 Direction Confirmation"
    };

  }


  const riskPlan =
    calculateRiskPlan(
      {
        entry:
          last,
        stop,
        side,
        maxRiskAmount
      }
    );


  if (
    !riskPlan
  ) {

    return {
      ...baseResult,
      ...structureResult,
      status:
        LIVE_STATUS.CONFIRMING,
      entryReadyAt: null,
      riskBlockedAt: null,
      entry: null,
      stop:
        stop || null,
      riskPlan: null,
      blockReason:
        "Entry 與 Stop 無法形成有效風險"
    };

  }


  return {
    ...baseResult,
    ...structureResult,
    status:
      riskPlan.maxLots ===
      0

        ? LIVE_STATUS.RISK_BLOCKED

        : LIVE_STATUS.ENTRY_READY,
    entry:
      riskPlan.entry,
    stop:
      riskPlan.stop,
    riskPlan,
    entryReadyAt:
      riskPlan.maxLots ===
      0

        ? null

        : quote.timestamp,
    riskBlockedAt:
      riskPlan.maxLots ===
      0

        ? quote.timestamp

        : null,
    blockReason:
      riskPlan.maxLots ===
      0

        ? "單筆現金風險超過上限"

        : null
  };

}


export function evaluateLiveSignal(
  stock,
  side,
  quote,
  {
    previousState = null,
    maxRiskAmount =
      LIVE_CONFIG.maxRiskAmount,
    candidateDataFreshness =
      null
  } = {}
) {

  const plan =
    calculatePremarketPlan(
      stock,
      side
    );


  const last =
    Number(
      quote?.last
      ||
      0
    );


  if (
    candidateDataFreshness
    &&
    candidateDataFreshness.isFresh !==
      true
  ) {

    return dataStaleResult(
      plan,
      candidateDataFreshness
    );

  }


  if (
    previousState?.status ===
    LIVE_STATUS.INVALIDATED
  ) {

    return invalidatedResult(
      plan,
      last,
      quote,
      previousState
    );

  }


  if (
    quote?.invalidated ===
    true
  ) {

    return invalidatedResult(
      plan,
      last,
      quote,
      previousState
    );

  }


  if (
    !plan
  ) {

    return {
      status:
        LIVE_STATUS.WAITING_LIVE,
      observationPrice: null,
      distanceTicks: null
    };

  }


  if (
    last <= 0
  ) {

    return {
      status:
        LIVE_STATUS.WAITING_LIVE,
      observationPrice:
        plan.observationPrice,
      distanceTicks: null
    };

  }


  const wasTriggered =
    previousState
    &&
    TRIGGERED_STATUSES.has(
      previousState.status
    );


  if (
    !wasTriggered
    &&
    !hasTriggered(
      side,
      last,
      plan.observationPrice
    )
  ) {

    return watchingResult(
      plan,
      last
    );

  }


  return activeSignalResult(
    stock,
    side,
    quote,
    plan,
    previousState,
    maxRiskAmount
  );

}


export function applyLiveQuoteToState(
  stock,
  side,
  quote,
  options = {}
) {

  let previousState =
    getLiveState(
      stock.Code,
      side
    );


  const incomingQuoteTime =
    getQuoteTime(
      quote?.timestamp
    );


  if (
    !incomingQuoteTime
  ) {

    return previousState;

  }


  const sessionDate =
    getTradingSessionDate(
      incomingQuoteTime.timestamp
    );


  if (
    previousState.sessionDate
    &&
    sessionDate <
    previousState.sessionDate
  ) {

    return previousState;

  }


  if (
    sessionDate ===
      previousState.sessionDate
    &&
    previousState.lastQuoteTimestamp
  ) {

    const previousQuoteTime =
      getQuoteTime(
        previousState.lastQuoteTimestamp
      );


    if (
      previousQuoteTime
      &&
      incomingQuoteTime.milliseconds <
        previousQuoteTime.milliseconds
    ) {

      return previousState;

    }

  }


  if (
    previousState.sessionDate
    &&
    sessionDate >
      previousState.sessionDate
  ) {

    resetLiveState(
      stock.Code,
      side
    );


    previousState =
      getLiveState(
        stock.Code,
        side
      );

  }


  const result =
    evaluateLiveSignal(
      stock,
      side,
      quote,
      {
        ...options,
        previousState
      }
    );


  return setLiveState(
    stock.Code,
    side,
    {
      ...result,
      quote,
      candidateDataFreshness:
        options.candidateDataFreshness
        ??
        null,
      sessionDate,
      lastQuoteTimestamp:
        incomingQuoteTime.timestamp
    }
  );

}
