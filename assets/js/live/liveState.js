export const LIVE_STATUS = {

  WAITING_LIVE:
    "WAITING_LIVE",

  WATCHING:
    "WATCHING",

  NEAR_TRIGGER:
    "NEAR_TRIGGER",

  TRIGGERED:
    "TRIGGERED",

  CONFIRMING:
    "CONFIRMING",

  ENTRY_READY:
    "ENTRY_READY",

  RISK_BLOCKED:
    "RISK_BLOCKED",

  INVALIDATED:
    "INVALIDATED"

};


const liveStateMap =
  new Map();


function createKey(
  code,
  side
) {

  return (
    `${side || "none"}:`
    +
    `${String(code || "")}`
  );

}


export function createInitialLiveState(
  code,
  side
) {

  return {

    code:
      String(
        code || ""
      ),

    side,

    sessionDate:
      null,

    lastQuoteTimestamp:
      null,

    status:
      LIVE_STATUS.WAITING_LIVE,

    observationPrice:
      null,

    distanceTicks:
      null,

    quote:
      null,

    candles: [],

    triggeredAt:
      null,

    triggerPrice:
      null,

    pullbackAt:
      null,

    swing:
      null,

    directionConfirmedAt:
      null,

    directionConfirmation:
      null,

    entryReadyAt:
      null,

    riskBlockedAt:
      null,

    blockReason:
      null,

    entry:
      null,

    stop:
      null,

    riskPlan:
      null,

    updatedAt:
      null

  };

}


export function getLiveState(
  code,
  side
) {

  const key =
    createKey(
      code,
      side
    );


  if (
    !liveStateMap.has(
      key
    )
  ) {

    liveStateMap.set(
      key,
      createInitialLiveState(
        code,
        side
      )
    );

  }


  return liveStateMap.get(
    key
  );

}


export function setLiveState(
  code,
  side,
  patch
) {

  const key =
    createKey(
      code,
      side
    );


  const previous =
    getLiveState(
      code,
      side
    );


  const next = {

    ...previous,

    ...patch,

    code:
      String(
        code || ""
      ),

    side,

    updatedAt:
      new Date()
      .toISOString()

  };


  liveStateMap.set(
    key,
    next
  );


  return next;

}


export function resetLiveState(
  code,
  side
) {

  const key =
    createKey(
      code,
      side
    );


  liveStateMap.delete(
    key
  );

}


export function resetLiveStates() {

  liveStateMap.clear();

}


export function getLiveStatusLabel(
  status,
  side
) {

  switch (
    status
  ) {

    case LIVE_STATUS.WATCHING:

      return "觀察中";


    case LIVE_STATUS.NEAR_TRIGGER:

      return "接近觀察價";


    case LIVE_STATUS.TRIGGERED:

      return (
        side ===
        "short"
      )
        ? "已跌破，等結構"
        : "已突破，等結構";


    case LIVE_STATUS.CONFIRMING:

      return "等待結構確認";


    case LIVE_STATUS.ENTRY_READY:

      return "進場條件成立";


    case LIVE_STATUS.RISK_BLOCKED:

      return "風險超標";


    case LIVE_STATUS.INVALIDATED:

      return "今日劇本失效";


    case LIVE_STATUS.WAITING_LIVE:

    default:

      return "等待今日行情";

  }

}
