function sum(
  values
) {

  return values.reduce(
    (
      total,
      value
    ) =>
      total
      +
      Number(
        value
        ||
        0
      ),
    0
  );

}


function calculateMaxDrawdown(
  trades
) {

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;


  trades
  .slice()
  .sort(
    (
      first,
      second
    ) =>
      String(
        first.exitTime
      )
      .localeCompare(
        String(
          second.exitTime
        )
      )
  )
  .forEach(
    trade => {

      equity +=
        Number(
          trade.netPnl
          ||
          0
        );

      peak =
        Math.max(
          peak,
          equity
        );

      maxDrawdown =
        Math.max(
          maxDrawdown,
          peak
          -
          equity
        );

    }
  );


  return maxDrawdown;

}


function summarizeTrades(
  trades
) {

  const wins =
    trades.filter(
      trade =>
        trade.netPnl > 0
    );

  const losses =
    trades.filter(
      trade =>
        trade.netPnl < 0
    );

  const totalPnl =
    sum(
      trades.map(
        trade =>
          trade.netPnl
      )
    );

  const totalR =
    sum(
      trades.map(
        trade =>
          trade.rMultiple
      )
    );

  const totalSlippageCost =
    sum(
      trades.map(
        trade =>
          trade.slippageCost
      )
    );

  const grossProfit =
    sum(
      wins.map(
        trade =>
          trade.netPnl
      )
    );

  const grossLoss =
    Math.abs(
      sum(
        losses.map(
          trade =>
            trade.netPnl
        )
      )
    );


  return {
    actualTrades:
      trades.length,
    longTrades:
      trades.filter(
        trade =>
          trade.side ===
          "long"
      ).length,
    shortTrades:
      trades.filter(
        trade =>
          trade.side ===
          "short"
      ).length,
    wins:
      wins.length,
    losses:
      losses.length,
    winRate:
      trades.length > 0

        ? wins.length
          /
          trades.length
          *
          100

        : 0,
    totalPnl,
    averagePnl:
      trades.length > 0

        ? totalPnl
          /
          trades.length

        : 0,
    totalR,
    totalSlippageCost,
    averageR:
      trades.length > 0

        ? totalR
          /
          trades.length

        : 0,
    profitFactor:
      grossLoss > 0

        ? grossProfit
          /
          grossLoss

        : grossProfit > 0
          ? null
          : 0,
    maxWin:
      wins.length > 0

        ? Math.max(
            ...wins.map(
              trade =>
                trade.netPnl
            )
          )

        : 0,
    maxLoss:
      losses.length > 0

        ? Math.min(
            ...losses.map(
              trade =>
                trade.netPnl
            )
          )

        : 0,
    maxDrawdown:
      calculateMaxDrawdown(
        trades
      ),
    tp1Count:
      trades.filter(
        trade =>
          trade.exitReason ===
          "TP1"
      ).length,
    tp2Count:
      trades.filter(
        trade =>
          trade.exitReason ===
          "TP2"
      ).length,
    stopCount:
      trades.filter(
        trade =>
          trade.exitReason ===
          "STOP"
      ).length
  };

}


function buildDailyRows(
  sessionResults,
  trades
) {

  return sessionResults.map(
    session => {

      const dailyTrades =
        trades.filter(
          trade =>
            trade.date ===
            session.date
        );


      return {
        date:
          session.date,
        candidateCount:
          session.candidateCount,
        noTradeCandidates:
          Math.max(
            0,
            session.candidateCount
            -
            dailyTrades.length
          ),
        ...summarizeTrades(
          dailyTrades
        )
      };

    }
  );

}


function buildInstrumentRows(
  trades
) {

  const groups =
    new Map();


  trades.forEach(
    trade => {

      if (
        !groups.has(
          trade.code
        )
      ) {

        groups.set(
          trade.code,
          []
        );

      }


      groups.get(
        trade.code
      )
      .push(
        trade
      );

    }
  );


  return [
    ...groups.entries()
  ]
  .map(
    ([
      code,
      instrumentTrades
    ]) => ({
      code,
      name:
        instrumentTrades[0]?.name
        ??
        "",
      ...summarizeTrades(
        instrumentTrades
      )
    })
  )
  .sort(
    (
      first,
      second
    ) =>
      second.totalPnl
      -
      first.totalPnl
      ||
      first.code.localeCompare(
        second.code
      )
  );

}


export function buildPerformanceReport(
  {
    sessionResults = [],
    trades = [],
    logs = []
  }
) {

  const summary = {
    tradingDays:
      sessionResults.length,
    totalCandidates:
      sum(
        sessionResults.map(
          session =>
            session.candidateCount
        )
      ),
    ...summarizeTrades(
      trades
    ),
    riskBlockedCount:
      logs.filter(
        log =>
          log.newStatus ===
            "RISK_BLOCKED"
          &&
          log.previousStatus !==
            "RISK_BLOCKED"
      ).length,
    invalidatedCount:
      logs.filter(
        log =>
          log.newStatus ===
            "INVALIDATED"
          &&
          log.previousStatus !==
            "INVALIDATED"
      ).length
  };


  summary.noTradeCandidates =
    Math.max(
      0,
      summary.totalCandidates
      -
      summary.actualTrades
    );


  return {
    summary,
    daily:
      buildDailyRows(
        sessionResults,
        trades
      ),
    instruments:
      buildInstrumentRows(
        trades
      ),
    trades,
    logs
  };

}
