import {
  applyLiveQuoteToState,
  getTradingSessionDate
} from "../live/signalEngine.js";

import {
  LIVE_STATUS,
  getLiveState,
  resetLiveState
} from "../live/liveState.js";

import {
  getCandidatesBySide
} from "../strategy/candidateSelector.js";

import {
  calculateDayTradeCosts
} from "../strategy/tradingCosts.js";

import {
  getCandleTimeframeMinutes,
  MIN_INTRADAY_TIMEFRAME_MINUTES
} from "../strategy/intradayStructure.js";

import {
  buildPerformanceReport
} from "./performance.js";

import {
  applyReplaySlippage,
  calculateSlippageCost,
  normalizeSlippageTicks
} from "./slippage.js";


function asNumber(
  value
) {

  const number =
    Number(
      value
    );


  return Number.isFinite(
    number
  )

    ? number

    : 0;

}


function normalizeReplayBar(
  bar,
  code
) {

  const timestamp =
    new Date(
      bar?.timestamp
      ??
      ""
    );

  const timeframeMinutes =
    getCandleTimeframeMinutes(
      bar
    );


  if (
    Number.isNaN(
      timestamp.getTime()
    )
  ) {

    throw new Error(
      `${code} Replay K 棒缺少有效 timestamp`
    );

  }


  if (
    timeframeMinutes ===
      null
    ||
    timeframeMinutes <
      MIN_INTRADAY_TIMEFRAME_MINUTES
  ) {

    throw new Error(
      `${code} Replay 僅接受至少 5 分 K`
    );

  }


  return {
    code:
      String(
        bar.code
        ??
        code
      ),
    timestamp:
      timestamp.toISOString(),
    timeframeMinutes,
    isComplete:
      bar.isComplete ===
      true,
    open:
      asNumber(
        bar.open
      ),
    high:
      asNumber(
        bar.high
      ),
    low:
      asNumber(
        bar.low
      ),
    close:
      asNumber(
        bar.close
      ),
    volume:
      asNumber(
        bar.volume
      ),
    invalidated:
      bar.invalidated ===
      true
  };

}


function validateReplaySequence(
  bars,
  code,
  sessionDate
) {

  let previousTime =
    null;


  bars.forEach(
    bar => {

      const currentTime =
        Date.parse(
          bar.timestamp
        );


      if (
        getTradingSessionDate(
          bar.timestamp
        ) !==
        sessionDate
      ) {

        throw new Error(
          `${code} Replay K 棒不屬於 ${sessionDate}`
        );

      }


      if (
        previousTime !==
          null
        &&
        currentTime <=
          previousTime
      ) {

        throw new Error(
          `${code} Replay K 棒必須嚴格依時間逐根輸入`
        );

      }


      if (
        previousTime !==
          null
        &&
        currentTime
        -
        previousTime <
          MIN_INTRADAY_TIMEFRAME_MINUTES
          *
          60_000
      ) {

        throw new Error(
          `${code} Replay K 棒間隔不得短於 5 分鐘`
        );

      }


      previousTime =
        currentTime;

    }
  );

}


function statusReason(
  previousState,
  nextState
) {

  if (
    nextState.status ===
      LIVE_STATUS.TRIGGERED
    &&
    previousState.status !==
      LIVE_STATUS.TRIGGERED
  ) {

    return "突破 Observation";

  }


  if (
    nextState.status ===
      LIVE_STATUS.ENTRY_READY
    &&
    previousState.status !==
      LIVE_STATUS.ENTRY_READY
  ) {

    return "Direction Confirmation + Risk Pass";

  }


  return nextState.blockReason
  ??
  "狀態更新";

}


function baseLog(
  {
    bar,
    stock,
    side,
    previousState,
    nextState,
    eventType =
      "STATE"
  }
) {

  const riskPlan =
    nextState.riskPlan
    ??
    null;


  return {
    eventType,
    timestamp:
      bar.timestamp,
    date:
      getTradingSessionDate(
        bar.timestamp
      ),
    code:
      String(
        stock.Code
      ),
    name:
      stock.Name
      ??
      "",
    side,
    candle: {
      timeframeMinutes:
        bar.timeframeMinutes,
      isComplete:
        bar.isComplete,
      open:
        bar.open,
      high:
        bar.high,
      low:
        bar.low,
      close:
        bar.close
    },
    observation:
      nextState.observationPrice,
    previousStatus:
      previousState.status,
    newStatus:
      nextState.status,
    breakout:
      nextState.status ===
        LIVE_STATUS.TRIGGERED
      &&
      previousState.status !==
        LIVE_STATUS.TRIGGERED,
    pullback:
      Boolean(
        nextState.pullbackAt
      ),
    swing:
      nextState.swing

        ? {
            type:
              nextState.swing.type,
            price:
              nextState.swing.price,
            timestamp:
              nextState.swing.timestamp,
            formedAt:
              nextState.swing.formedAt
          }

        : null,
    directionConfirmation:
      nextState.directionConfirmation

        ? {
            timestamp:
              nextState.directionConfirmation.timestamp,
            price:
              nextState.directionConfirmation.price,
            threshold:
              nextState.directionConfirmation.threshold
          }

        : null,
    entry:
      nextState.entry,
    slippageTicks: 0,
    rawEntry: null,
    filledEntry: null,
    stop:
      nextState.stop,
    tp1:
      riskPlan?.tp1
      ??
      null,
    tp2:
      riskPlan?.tp2
      ??
      null,
    maxLots:
      riskPlan?.maxLots
      ??
      null,
    cashRiskPerLot:
      riskPlan?.cashRiskPerLot
      ??
      null,
    riskPerLot:
      riskPlan?.riskPerLot
      ??
      null,
    triggerReason:
      statusReason(
        previousState,
        nextState
      ),
    blockReason:
      nextState.blockReason
      ??
      null,
    exitTime: null,
    rawExit: null,
    filledExit: null,
    exitPrice: null,
    exitReason: null,
    slippageCost: null,
    result: null,
    pnl: null,
    rMultiple: null
  };

}


function createOpenTrade(
  stock,
  side,
  state,
  bar,
  slippageTicks
) {

  const riskPlan =
    state.riskPlan;

  const lots =
    riskPlan.maxLots ===
    null

      ? 1

      : riskPlan.maxLots;


  const rawEntry =
    state.entry;


  const filledEntry =
    applyReplaySlippage(
      {
        price:
          rawEntry,
        side,
        leg:
          "entry",
        slippageTicks
      }
    );


  const filledStop =
    applyReplaySlippage(
      {
        price:
          state.stop,
        side,
        leg:
          "exit",
        slippageTicks
      }
    );


  const filledStopOutcome =
    calculateDayTradeCosts(
      {
        entry:
          filledEntry,
        exit:
          filledStop,
        side,
        shares:
          riskPlan.lotSize
      }
    );


  const filledRiskPerLot =
    filledStopOutcome

      ? Math.max(
          0,
          -filledStopOutcome.netPnlAfterRebate
        )

      : riskPlan.riskPerLot;


  return {
    id:
      `${getTradingSessionDate(bar.timestamp)}:`
      +
      `${stock.Code}:${side}:${bar.timestamp}`,
    date:
      getTradingSessionDate(
        bar.timestamp
      ),
    code:
      String(
        stock.Code
      ),
    name:
      stock.Name
      ??
      "",
    side,
    observation:
      state.observationPrice,
    breakoutTime:
      state.triggeredAt,
    entryTime:
      state.entryReadyAt
      ??
      bar.timestamp,
    entry:
      filledEntry,
    slippageTicks,
    rawEntry,
    filledEntry,
    stop:
      state.stop,
    tp1:
      riskPlan.tp1,
    tp2:
      riskPlan.tp2,
    maxLots:
      lots,
    shares:
      lots
      *
      riskPlan.lotSize,
    initialRisk:
      filledRiskPerLot
      *
      lots,
    cashRiskPerLot:
      riskPlan.cashRiskPerLot,
    riskPerLot:
      filledRiskPerLot,
    rawRiskPerLot:
      riskPlan.riskPerLot
  };

}


function resolveExit(
  trade,
  bar,
  state,
  exitTarget
) {

  if (
    state.status ===
    LIVE_STATUS.INVALIDATED
  ) {

    return {
      price:
        bar.close,
      reason:
        "INVALIDATED"
    };

  }


  if (
    trade.side ===
    "long"
  ) {

    if (
      bar.low <=
      trade.stop
    ) {

      return {
        price:
          trade.stop,
        reason:
          "STOP"
      };

    }


    const target =
      exitTarget ===
      "tp2"

        ? trade.tp2

        : trade.tp1;


    if (
      bar.high >=
      target
    ) {

      return {
        price:
          target,
        reason:
          exitTarget ===
          "tp2"

            ? "TP2"

            : "TP1"
      };

    }

  }


  if (
    trade.side ===
    "short"
  ) {

    if (
      bar.high >=
      trade.stop
    ) {

      return {
        price:
          trade.stop,
        reason:
          "STOP"
      };

    }


    const target =
      exitTarget ===
      "tp2"

        ? trade.tp2

        : trade.tp1;


    if (
      bar.low <=
      target
    ) {

      return {
        price:
          target,
        reason:
          exitTarget ===
          "tp2"

            ? "TP2"

            : "TP1"
      };

    }

  }


  return null;

}


function closeTrade(
  trade,
  bar,
  exit
) {

  const rawExit =
    exit.price;


  const filledExit =
    applyReplaySlippage(
      {
        price:
          rawExit,
        side:
          trade.side,
        leg:
          "exit",
        slippageTicks:
          trade.slippageTicks
      }
    );


  const costs =
    calculateDayTradeCosts(
      {
        entry:
          trade.filledEntry,
        exit:
          filledExit,
        side:
          trade.side,
        shares:
          trade.shares
      }
    );

  const netPnl =
    costs?.netPnlAfterRebate
    ??
    0;


  return {
    ...trade,
    exitTime:
      bar.timestamp,
    rawExit,
    filledExit,
    exitPrice:
      filledExit,
    exitReason:
      exit.reason,
    grossPnl:
      costs?.grossPnl
      ??
      0,
    originalCommission:
      costs?.originalCommission
      ??
      0,
    tradingCost:
      costs?.originalCommission
      ??
      0,
    netCostAfterRebate:
      costs?.netCostAfterRebate
      ??
      0,
    monthlyRebate:
      costs?.monthlyRebate
      ??
      0,
    transactionTax:
      costs?.transactionTax
      ??
      0,
    slippageCost:
      calculateSlippageCost(
        {
          side:
            trade.side,
          rawEntry:
            trade.rawEntry,
          filledEntry:
            trade.filledEntry,
          rawExit,
          filledExit,
          shares:
            trade.shares
        }
      ),
    netPnl,
    rMultiple:
      trade.initialRisk > 0

        ? netPnl
          /
          trade.initialRisk

        : 0,
    result:
      netPnl > 0

        ? "WIN"

        : netPnl < 0
          ? "LOSS"
          : "FLAT"
  };

}


function sanitizeFinalState(
  state
) {

  const {
    updatedAt,
    ...deterministicState
  } = state;


  return deterministicState;

}


export function replayCandidate(
  {
    stock,
    side,
    sessionDate,
    bars,
    maxRiskAmount =
      null,
    exitTarget =
      "tp1",
    slippageTicks =
      0
  }
) {

  const code =
    String(
      stock?.Code
      ??
      ""
    );


  const normalizedSlippageTicks =
    normalizeSlippageTicks(
      slippageTicks
    );


  if (
    !code
    ||
    ![
      "long",
      "short"
    ]
    .includes(
      side
    )
  ) {

    throw new Error(
      "Replay Candidate 缺少股票或方向"
    );

  }


  const normalizedBars =
    (
      Array.isArray(
        bars
      )

        ? bars

        : []
    )
    .map(
      bar =>
        normalizeReplayBar(
          bar,
          code
        )
    );


  validateReplaySequence(
    normalizedBars,
    code,
    sessionDate
  );


  const replayStateCode =
    `__REPLAY__:${sessionDate}:${code}:${side}`;

  const strategyStock = {
    ...stock,
    Code:
      replayStateCode
  };


  resetLiveState(
    replayStateCode,
    side
  );


  const logs = [];
  const trades = [];
  let openTrade = null;
  let hasEntered = false;


  normalizedBars.forEach(
    bar => {

      const previousState =
        getLiveState(
          replayStateCode,
          side
        );

      const nextState =
        applyLiveQuoteToState(
          strategyStock,
          side,
          {
            code:
              replayStateCode,
            timestamp:
              bar.timestamp,
            candleTimeframeMinutes:
              bar.timeframeMinutes,
            open:
              bar.open,
            high:
              bar.high,
            low:
              bar.low,
            last:
              bar.close,
            volume:
              bar.volume,
            candles: [
              bar
            ],
            invalidated:
              bar.invalidated
          },
          {
            maxRiskAmount
          }
        );

      const stateLog =
        baseLog(
          {
            bar,
            stock,
            side,
            previousState,
            nextState
          }
        );


      logs.push(
        stateLog
      );


      if (
        openTrade
        &&
        bar.timestamp >
          openTrade.entryTime
      ) {

        const exit =
          resolveExit(
            openTrade,
            bar,
            nextState,
            exitTarget
          );


        if (
          exit
        ) {

          const closedTrade =
            closeTrade(
              openTrade,
              bar,
              exit
            );


          trades.push(
            closedTrade
          );

          logs.push(
            {
              ...stateLog,
              eventType:
                "EXIT",
              exitTime:
                closedTrade.exitTime,
              rawExit:
                closedTrade.rawExit,
              filledExit:
                closedTrade.filledExit,
              exitPrice:
                closedTrade.exitPrice,
              exitReason:
                closedTrade.exitReason,
              result:
                closedTrade.result,
              pnl:
                closedTrade.netPnl,
              rMultiple:
                closedTrade.rMultiple,
              slippageTicks:
                closedTrade.slippageTicks,
              rawEntry:
                closedTrade.rawEntry,
              filledEntry:
                closedTrade.filledEntry,
              slippageCost:
                closedTrade.slippageCost,
              triggerReason:
                `出場：${closedTrade.exitReason}`
            }
          );

          openTrade =
            null;

        }

      }


      if (
        !hasEntered
        &&
        !openTrade
        &&
        nextState.status ===
          LIVE_STATUS.ENTRY_READY
      ) {

        openTrade =
          createOpenTrade(
            stock,
            side,
            nextState,
            bar,
            normalizedSlippageTicks
          );

        hasEntered =
          true;

        logs.push(
          {
            ...stateLog,
            eventType:
              "ENTRY",
            slippageTicks:
              openTrade.slippageTicks,
            rawEntry:
              openTrade.rawEntry,
            filledEntry:
              openTrade.filledEntry,
            entry:
              openTrade.filledEntry,
            triggerReason:
              "Direction Confirmation + Risk Pass，建立模擬部位"
          }
        );

      }

    }
  );


  if (
    openTrade
    &&
    normalizedBars.length > 0
  ) {

    const lastBar =
      normalizedBars[
        normalizedBars.length - 1
      ];

    const closedTrade =
      closeTrade(
        openTrade,
        lastBar,
        {
          price:
            lastBar.close,
          reason:
            "OTHER"
        }
      );


    trades.push(
      closedTrade
    );

    logs.push(
      {
        ...baseLog(
          {
            bar:
              lastBar,
            stock,
            side,
            previousState:
              getLiveState(
                replayStateCode,
                side
            ),
            nextState:
              getLiveState(
                replayStateCode,
                side
              ),
            eventType:
              "EXIT"
          }
        ),
        exitTime:
          closedTrade.exitTime,
        rawExit:
          closedTrade.rawExit,
        filledExit:
          closedTrade.filledExit,
        exitPrice:
          closedTrade.exitPrice,
        exitReason:
          closedTrade.exitReason,
        result:
          closedTrade.result,
        pnl:
          closedTrade.netPnl,
        rMultiple:
          closedTrade.rMultiple,
        slippageTicks:
          closedTrade.slippageTicks,
        rawEntry:
          closedTrade.rawEntry,
        filledEntry:
          closedTrade.filledEntry,
        slippageCost:
          closedTrade.slippageCost,
        triggerReason:
          "收盤結束 Replay 部位"
      }
    );

  }


  const finalState =
    sanitizeFinalState(
      getLiveState(
        replayStateCode,
        side
      )
    );


  resetLiveState(
    replayStateCode,
    side
  );


  return {
    date:
      sessionDate,
    code,
    name:
      stock.Name
      ??
      "",
    side,
    processedBars:
      normalizedBars.length,
    logs,
    trades,
    finalState: {
      ...finalState,
      code,
      quote:
        finalState.quote

          ? {
              ...finalState.quote,
              code
            }

          : null
    }
  };

}


function findPreviousSnapshot(
  snapshots,
  sessionDate,
  expectedPreviousTradingDate =
    null
) {

  if (
    expectedPreviousTradingDate
  ) {

    return snapshots.find(
      snapshot =>
        snapshot.date ===
        expectedPreviousTradingDate
        &&
        snapshot.date <
        sessionDate
    )
    ??
    null;

  }

  return snapshots
  .filter(
    snapshot =>
      snapshot.date <
      sessionDate
  )
  .sort(
    (
      first,
      second
    ) =>
      second.date.localeCompare(
        first.date
      )
  )[0]
  ??
  null;

}


function getBarsForCode(
  session,
  code
) {

  if (
    session.barsByCode
    &&
    Array.isArray(
      session.barsByCode[
        code
      ]
    )
  ) {

    return session.barsByCode[
      code
    ];

  }


  return (
    Array.isArray(
      session.bars
    )

      ? session.bars

      : []
  )
  .filter(
    bar =>
      String(
        bar.code
      ) ===
      code
  );

}


export function runBacktest(
  dataset,
  {
    from =
      null,
    to =
      null,
    maxRiskAmount =
      null,
    exitTarget =
      "tp1",
    slippageTicks =
      0
  } = {}
) {

  const normalizedSlippageTicks =
    normalizeSlippageTicks(
      slippageTicks
    );

  const snapshots =
    Array.isArray(
      dataset?.dailySnapshots
    )

      ? dataset.dailySnapshots

      : [];

  const sessions =
    (
      Array.isArray(
        dataset?.sessions
      )

        ? dataset.sessions

        : []
    )
    .filter(
      session =>
        (
          !from
          ||
          session.date >=
            from
        )
        &&
        (
          !to
          ||
          session.date <=
            to
        )
    )
    .slice()
    .sort(
      (
        first,
        second
      ) =>
        first.date.localeCompare(
          second.date
        )
    );

  const sessionResults = [];
  const trades = [];
  const logs = [];


  sessions.forEach(
    session => {

      const snapshot =
        findPreviousSnapshot(
          snapshots,
          session.date,
          session.previousTradingDate
          ??
          null
        );


      if (
        !snapshot
      ) {

        throw new Error(
          `${session.date} 缺少前一交易日盤後資料`
        );

      }


      const stocks =
        (
          Array.isArray(
            snapshot.stocks
          )

            ? snapshot.stocks

            : []
        )
        .map(
          stock => ({
            ...stock
          })
        );


      const candidatesBySide =
        getCandidatesBySide(
          stocks
        );


      const candidates = [
        ...candidatesBySide.long.map(
          stock => ({
            stock,
            side:
              "long"
          })
        ),
        ...candidatesBySide.short.map(
          stock => ({
            stock,
            side:
              "short"
          })
        )
      ];


      const candidateResults =
        candidates.map(
          candidate =>
            replayCandidate(
              {
                stock:
                  candidate.stock,
                side:
                  candidate.side,
                sessionDate:
                  session.date,
                bars:
                  getBarsForCode(
                    session,
                    String(
                      candidate.stock.Code
                    )
                  ),
                maxRiskAmount,
                exitTarget:
                  session.exitTarget
                  ??
                  exitTarget,
                slippageTicks:
                  session.slippageTicks
                  ??
                  normalizedSlippageTicks
              }
            )
        );


      candidateResults.forEach(
        result => {

          logs.push(
            ...result.logs
          );

          trades.push(
            ...result.trades
          );

        }
      );


      sessionResults.push(
        {
          date:
            session.date,
          previousTradingDate:
            snapshot.date,
          slippageTicks:
            session.slippageTicks
            ??
            normalizedSlippageTicks,
          candidateCount:
            candidates.length,
          candidates:
            candidates.map(
              candidate => ({
                code:
                  String(
                    candidate.stock.Code
                  ),
                name:
                  candidate.stock.Name
                  ??
                  "",
                side:
                  candidate.side
              })
            )
        }
      );

    }
  );


  return {
    settings: {
      slippageTicks:
        normalizedSlippageTicks
    },
    range: {
      from:
        from
        ??
        sessions[0]?.date
        ??
        null,
      to:
        to
        ??
        sessions[
          sessions.length - 1
        ]?.date
        ??
        null
    },
    sessions:
      sessionResults,
    ...buildPerformanceReport(
      {
        sessionResults,
        trades,
        logs
      }
    )
  };

}
