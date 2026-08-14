import {
  LIVE_CONFIG
} from "../core/config.js";

import {
  getPriceTick
} from "../utils/priceTick.js";

import {
  calculatePremarketPlan
} from "../strategy/priceLevels.js";

import {
  LIVE_STATUS,
  setLiveState
} from "./liveState.js";


function calculateDistanceTicks(
  currentPrice,
  observationPrice
) {

  if (
    currentPrice <= 0
    ||
    observationPrice <= 0
  ) {

    return null;

  }


  const tick =
    getPriceTick(
      observationPrice
    );


  if (
    tick <= 0
  ) {

    return null;

  }


  return Math.ceil(

    Math.abs(
      observationPrice
      -
      currentPrice
    )

    /

    tick

  );

}


export function evaluateLiveSignal(
  stock,
  side,
  quote
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

      observationPrice:
        null,

      distanceTicks:
        null

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

      distanceTicks:
        null

    };

  }


  const distanceTicks =
    calculateDistanceTicks(
      last,
      plan.observationPrice
    );


  if (
    side ===
    "long"
  ) {

    if (
      last >=
      plan.observationPrice
    ) {

      return {

        status:
          LIVE_STATUS.TRIGGERED,

        observationPrice:
          plan.observationPrice,

        distanceTicks:
          0

      };

    }


    if (
      distanceTicks !== null
      &&
      distanceTicks <=
      LIVE_CONFIG.nearTriggerTicks
    ) {

      return {

        status:
          LIVE_STATUS.NEAR_TRIGGER,

        observationPrice:
          plan.observationPrice,

        distanceTicks

      };

    }


    return {

      status:
        LIVE_STATUS.WATCHING,

      observationPrice:
        plan.observationPrice,

      distanceTicks

    };

  }


  if (
    side ===
    "short"
  ) {

    if (
      last <=
      plan.observationPrice
    ) {

      return {

        status:
          LIVE_STATUS.TRIGGERED,

        observationPrice:
          plan.observationPrice,

        distanceTicks:
          0

      };

    }


    if (
      distanceTicks !== null
      &&
      distanceTicks <=
      LIVE_CONFIG.nearTriggerTicks
    ) {

      return {

        status:
          LIVE_STATUS.NEAR_TRIGGER,

        observationPrice:
          plan.observationPrice,

        distanceTicks

      };

    }


    return {

      status:
        LIVE_STATUS.WATCHING,

      observationPrice:
        plan.observationPrice,

      distanceTicks

    };

  }


  return {

    status:
      LIVE_STATUS.WAITING_LIVE,

    observationPrice:
      plan.observationPrice,

    distanceTicks:
      null

  };

}


export function applyLiveQuoteToState(
  stock,
  side,
  quote
) {

  const result =
    evaluateLiveSignal(
      stock,
      side,
      quote
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
