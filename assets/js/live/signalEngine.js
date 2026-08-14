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
  getIntradayStructuralStop
} from "../strategy/intradayStructure.js";

import {
  calculateRiskPlan
} from "../strategy/riskEngine.js";

import {
  LIVE_STATUS,
  getLiveState,
  setLiveState
} from "./liveState.js";


const TRIGGERED_STATUSES =
  new Set(
    [
      LIVE_STATUS.TRIGGERED,
      LIVE_STATUS.CONFIRMING,
      LIVE_STATUS.ENTRY_READY
    ]
  );


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
    Array.isArray(
      quote.candles
    )
    &&
    quote.candles.length > 0

      ? quote.candles

      : previousState?.candles
        ||
        [];


  const baseResult = {
    observationPrice:
      plan.observationPrice,

    distanceTicks: 0,
    triggeredAt,
    triggerPrice,
    candles
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

    return {
      ...baseResult,
      status:
        LIVE_STATUS.ENTRY_READY,
      entry:
        previousState.entry,
      stop:
        previousState.stop,
      riskPlan:
        refreshedRiskPlan
    };

  }


  if (
    candles.length < 3
  ) {

    return {
      ...baseResult,
      status:
        previousState
        &&
        TRIGGERED_STATUSES.has(
          previousState.status
        )

          ? LIVE_STATUS.CONFIRMING

          : LIVE_STATUS.TRIGGERED
    };

  }


  const stop =
    getIntradayStructuralStop(
      candles,
      side
    );


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
      status:
        LIVE_STATUS.CONFIRMING,
      stop:
        stop || null,
      riskPlan: null
    };

  }


  return {
    ...baseResult,
    status:
      LIVE_STATUS.ENTRY_READY,
    entry:
      riskPlan.entry,
    stop:
      riskPlan.stop,
    riskPlan
  };

}


export function evaluateLiveSignal(
  stock,
  side,
  quote,
  {
    previousState = null,
    maxRiskAmount =
      LIVE_CONFIG.maxRiskAmount
  } = {}
) {

  const plan =
    calculatePremarketPlan(
      stock,
      side
    );


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


  const last =
    Number(
      quote?.last
      ||
      0
    );


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


  if (
    quote?.invalidated ===
    true
  ) {

    return {
      status:
        LIVE_STATUS.INVALIDATED,
      observationPrice:
        plan.observationPrice,
      distanceTicks:
        getTickDistance(
          last,
          plan.observationPrice
        )
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

  const previousState =
    getLiveState(
      stock.Code,
      side
    );


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
      quote
    }
  );

}
