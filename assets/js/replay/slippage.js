import {
  getNextPrice,
  getPreviousPrice
} from "../utils/priceTick.js";


export const REPLAY_SLIPPAGE_TICKS = [
  0,
  1,
  2
];


export function normalizeSlippageTicks(
  value
) {

  const ticks =
    Number(
      value
      ??
      0
    );


  if (
    !REPLAY_SLIPPAGE_TICKS.includes(
      ticks
    )
  ) {

    throw new Error(
      "Replay 滑價僅支援 0、1、2 Tick"
    );

  }


  return ticks;

}


function movePrice(
  price,
  ticks,
  direction
) {

  let filledPrice =
    Number(
      price
      ??
      0
    );


  for (
    let index = 0;
    index < ticks;
    index += 1
  ) {

    filledPrice =
      direction ===
        "up"

        ? getNextPrice(
            filledPrice
          )

        : getPreviousPrice(
            filledPrice
          );

  }


  return filledPrice;

}


export function applyReplaySlippage(
  {
    price,
    side,
    leg,
    slippageTicks = 0
  }
) {

  const ticks =
    normalizeSlippageTicks(
      slippageTicks
    );


  if (
    ticks === 0
  ) {

    return Number(
      price
      ??
      0
    );

  }


  if (
    ![
      "entry",
      "exit"
    ].includes(
      leg
    )
  ) {

    throw new Error(
      "Replay 滑價缺少有效成交階段"
    );

  }


  const direction =
    side ===
      "long"

      ? leg ===
        "entry"

        ? "up"

        : "down"

      : side ===
        "short"

        ? leg ===
          "entry"

          ? "down"

          : "up"

        : null;


  if (
    !direction
  ) {

    throw new Error(
      "Replay 滑價缺少有效交易方向"
    );

  }


  return movePrice(
    price,
    ticks,
    direction
  );

}


export function calculateSlippageCost(
  {
    side,
    rawEntry,
    filledEntry,
    rawExit,
    filledExit,
    shares
  }
) {

  const entryCostPerShare =
    side ===
      "long"

      ? filledEntry
        -
        rawEntry

      : rawEntry
        -
        filledEntry;


  const exitCostPerShare =
    side ===
      "long"

      ? rawExit
        -
        filledExit

      : filledExit
        -
        rawExit;


  return Math.max(
    0,
    (
      entryCostPerShare
      +
      exitCostPerShare
    )
    *
    Number(
      shares
      ??
      0
    )
  );

}
