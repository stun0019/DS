import {
  getCandidatesBySide
} from "../strategy/candidateSelector.js";

import {
  getStrategyScore
} from "../strategy/scoring.js";

import {
  calculateObservationPrice
} from "../strategy/priceLevels.js";

import {
  getPreviousTradingDate,
  normalizeTradingDate
} from "../utils/tradingCalendar.js";


export const HISTORICAL_VALIDATION_EVENT = {
  SESSION_ACCEPTED:
    "HISTORICAL_SESSION_ACCEPTED",
  SESSION_REJECTED:
    "HISTORICAL_SESSION_REJECTED"
};


export class HistoricalDatasetValidationError
extends Error {

  constructor(
    code,
    message,
    sessionDate =
      null
  ) {

    const prefix =
      sessionDate

        ? `${sessionDate} `

        : "";


    super(
      `[${code}] ${prefix}${message}`
    );

    this.name =
      "HistoricalDatasetValidationError";

    this.code =
      code;

    this.sessionDate =
      sessionDate;

    this.validationLogs = [
      {
        eventType:
          HISTORICAL_VALIDATION_EVENT.SESSION_REJECTED,
        status:
          "REJECTED",
        code,
        sessionDate,
        message:
          this.message
      }
    ];

  }

}


function reject(
  code,
  message,
  sessionDate =
    null
) {

  throw new HistoricalDatasetValidationError(
    code,
    message,
    sessionDate
  );

}


function cloneObject(
  value
) {

  return {
    ...value
  };

}


function normalizeCode(
  value
) {

  return String(
    value
    ??
    ""
  )
  .trim();

}


function getTaipeiDate(
  value
) {

  const timestamp =
    new Date(
      value
      ??
      ""
    );


  if (
    Number.isNaN(
      timestamp.getTime()
    )
  ) {

    return null;

  }


  const parts =
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
    )
    .formatToParts(
      timestamp
    );

  const values =
    Object.fromEntries(
      parts.map(
        part => [
          part.type,
          part.value
        ]
      )
    );


  return `${values.year}-${values.month}-${values.day}`;

}


function assertStrictDateOrder(
  records,
  label
) {

  let previousDate =
    null;

  const seenDates =
    new Set();


  records.forEach(
    record => {

      const date =
        normalizeTradingDate(
          record?.date
        );


      if (
        !date
      ) {

        reject(
          "INVALID_DATE",
          `${label} 包含無效日期`
        );

      }


      if (
        seenDates.has(
          date
        )
      ) {

        reject(
          "DUPLICATE_DATE",
          `${label} 日期重複：${date}`,
          date
        );

      }


      if (
        previousDate
        &&
        date <
          previousDate
      ) {

        reject(
          "DATE_ORDER_REVERSED",
          `${label} 日期倒退：${previousDate} → ${date}`,
          date
        );

      }


      seenDates.add(
        date
      );

      previousDate =
        date;

    }
  );

}


function normalizeSnapshots(
  dailySnapshots
) {

  if (
    !Array.isArray(
      dailySnapshots
    )
  ) {

    reject(
      "MISSING_DAILY_SNAPSHOTS",
      "缺少 dailySnapshots"
    );

  }


  assertStrictDateOrder(
    dailySnapshots,
    "Daily Snapshot"
  );


  return dailySnapshots.map(
    snapshot => {

      const date =
        normalizeTradingDate(
          snapshot.date
        );

      const stocks =
        Array.isArray(
          snapshot.stocks
        )

          ? snapshot.stocks

          : [];

      const seenCodes =
        new Set();


      const normalizedStocks =
        stocks.map(
          stock => {

            const code =
              normalizeCode(
                stock?.Code
              );


            if (
              !code
            ) {

              reject(
                "MISSING_STOCK_CODE",
                "Daily Snapshot 股票缺少代號",
                date
              );

            }


            if (
              seenCodes.has(
                code
              )
            ) {

              reject(
                "DUPLICATE_STOCK_CODE",
                `Daily Snapshot 股票代號重複：${code}`,
                date
              );

            }


            seenCodes.add(
              code
            );


            return {
              ...stock,
              Code:
                code
            };

          }
        );


      return {
        ...snapshot,
        date,
        stocks:
          normalizedStocks
      };

    }
  );

}


function collectSessionBars(
  session,
  sessionDate
) {

  const barsByCode =
    {};


  if (
    session.barsByCode
    &&
    typeof session.barsByCode ===
      "object"
    &&
    !Array.isArray(
      session.barsByCode
    )
  ) {

    Object.entries(
      session.barsByCode
    )
    .forEach(
      ([
        sourceCode,
        bars
      ]) => {

        const code =
          normalizeCode(
            sourceCode
          );


        if (
          !code
          ||
          !Array.isArray(
            bars
          )
        ) {

          reject(
            "INVALID_5M_DATA",
            "barsByCode 格式錯誤",
            sessionDate
          );

        }


        barsByCode[code] =
          bars.map(
            cloneObject
          );

      }
    );

  }

  else if (
    Array.isArray(
      session.bars
    )
  ) {

    session.bars.forEach(
      bar => {

        const code =
          normalizeCode(
            bar?.code
          );


        if (
          !code
        ) {

          reject(
            "MISSING_BAR_CODE",
            "5m Bar 缺少股票代號",
            sessionDate
          );

        }


        if (
          !barsByCode[code]
        ) {

          barsByCode[code] =
            [];

        }


        barsByCode[code].push(
          cloneObject(
            bar
          )
        );

      }
    );

  }


  return barsByCode;

}


function validateBars(
  barsByCode,
  sessionDate,
  snapshotCodes
) {

  let totalBars =
    0;

  const entries =
    Object.entries(
      barsByCode
    );


  if (
    entries.length === 0
  ) {

    reject(
      "MISSING_5M_DATA",
      "缺少 5m Bars",
      sessionDate
    );

  }


  entries.forEach(
    ([
      code,
      bars
    ]) => {

      if (
        !snapshotCodes.has(
          code
        )
      ) {

        reject(
          "STOCK_CODE_MISMATCH",
          `5m 股票代號 ${code} 不存在於 previousTradingDate Snapshot`,
          sessionDate
        );

      }


      if (
        bars.length === 0
      ) {

        reject(
          "MISSING_5M_DATA",
          `${code} 缺少 5m Bars`,
          sessionDate
        );

      }


      let previousTimestamp =
        null;

      const seenTimestamps =
        new Set();


      bars.forEach(
        bar => {

          const barCode =
            normalizeCode(
              bar.code
              ??
              code
            );


          if (
            barCode !==
              code
          ) {

            reject(
              "STOCK_CODE_MISMATCH",
              `barsByCode ${code} 與 Bar 代號 ${barCode} 不一致`,
              sessionDate
            );

          }


          const timestamp =
            Date.parse(
              bar.timestamp
            );

          const candleDate =
            getTaipeiDate(
              bar.timestamp
            );


          if (
            !Number.isFinite(
              timestamp
            )
          ) {

            reject(
              "INVALID_CANDLE_TIMESTAMP",
              `${code} 包含無效 timestamp`,
              sessionDate
            );

          }


          if (
            candleDate >
              sessionDate
          ) {

            reject(
              "FUTURE_CANDLE",
              `${code} 包含未來 K：${bar.timestamp}`,
              sessionDate
            );

          }


          if (
            candleDate !==
              sessionDate
          ) {

            reject(
              "CANDLE_DATE_MISMATCH",
              `${code} K 棒日期 ${candleDate} 與 Session 不一致`,
              sessionDate
            );

          }


          if (
            Number(
              bar.timeframeMinutes
            ) < 5
            ||
            !Number.isFinite(
              Number(
                bar.timeframeMinutes
              )
            )
          ) {

            reject(
              "INVALID_TIMEFRAME",
              `${code} timeframeMinutes 必須至少為 5`,
              sessionDate
            );

          }


          if (
            bar.isComplete !==
              true
          ) {

            reject(
              "INCOMPLETE_CANDLE",
              `${code} 只允許 isComplete = true`,
              sessionDate
            );

          }


          const open =
            Number(
              bar.open
            );

          const high =
            Number(
              bar.high
            );

          const low =
            Number(
              bar.low
            );

          const close =
            Number(
              bar.close
            );

          const volume =
            Number(
              bar.volume
              ??
              0
            );


          if (
            ![
              open,
              high,
              low,
              close
            ]
            .every(
              price =>
                Number.isFinite(
                  price
                )
                &&
                price > 0
            )
            ||
            high <
              Math.max(
                open,
                close
              )
            ||
            low >
              Math.min(
                open,
                close
              )
            ||
            high <
              low
            ||
            !Number.isFinite(
              volume
            )
            ||
            volume < 0
          ) {

            reject(
              "INVALID_OHLCV",
              `${code} 包含無效 OHLCV`,
              sessionDate
            );

          }


          if (
            seenTimestamps.has(
              timestamp
            )
          ) {

            reject(
              "DUPLICATE_CANDLE",
              `${code} K 棒 timestamp 重複：${bar.timestamp}`,
              sessionDate
            );

          }


          if (
            previousTimestamp !==
              null
            &&
            timestamp <
              previousTimestamp
          ) {

            reject(
              "CANDLE_ORDER_REVERSED",
              `${code} K 棒 timestamp 亂序`,
              sessionDate
            );

          }


          seenTimestamps.add(
            timestamp
          );

          previousTimestamp =
            timestamp;

          bar.code =
            code;

          bar.timeframeMinutes =
            Number(
              bar.timeframeMinutes
            );

          bar.open =
            open;

          bar.high =
            high;

          bar.low =
            low;

          bar.close =
            close;

          bar.volume =
            volume;

          totalBars +=
            1;

        }
      );

    }
  );


  return totalBars;

}


function buildCandidateAuditEntry(
  stock,
  side
) {

  return {
    code:
      normalizeCode(
        stock.Code
      ),
    name:
      stock.Name
      ??
      "",
    side,
    strategyScore:
      getStrategyScore(
        stock,
        side
      ),
    liquidityRank:
      Number(
        stock.__liquidityRank
        ??
        0
      ),
    observation:
      calculateObservationPrice(
        stock,
        side
      ),
    previousHigh:
      Number(
        stock.HighestPrice
        ??
        0
      ),
    previousLow:
      Number(
        stock.LowestPrice
        ??
        0
      )
  };

}


function buildCandidateAudit(
  snapshot,
  sessionDate
) {

  const candidatePool =
    snapshot.stocks.map(
      cloneObject
    );

  const candidates =
    getCandidatesBySide(
      candidatePool
    );


  return {
    date:
      sessionDate,
    previousTradingDate:
      snapshot.date,
    long:
      candidates.long.map(
        stock =>
          buildCandidateAuditEntry(
            stock,
            "long"
          )
      ),
    short:
      candidates.short.map(
        stock =>
          buildCandidateAuditEntry(
            stock,
            "short"
          )
      )
  };

}


function validateCandidateBars(
  audit,
  barsByCode,
  sessionDate
) {

  [
    ...audit.long,
    ...audit.short
  ]
  .forEach(
    candidate => {

      if (
        !Array.isArray(
          barsByCode[
            candidate.code
          ]
        )
        ||
        barsByCode[
          candidate.code
        ].length === 0
      ) {

        reject(
          "MISSING_CANDIDATE_5M_DATA",
          `${candidate.side.toUpperCase()} Candidate ${candidate.code} 缺少 5m Bars`,
          sessionDate
        );

      }

    }
  );

}


function validateCalendarPreviousDate(
  metadata,
  sessionDate,
  previousTradingDate
) {

  if (
    !metadata?.tradingCalendar
  ) {

    return;

  }


  const expectedPreviousTradingDate =
    getPreviousTradingDate(
      sessionDate,
      metadata.tradingCalendar
    );


  if (
    !expectedPreviousTradingDate
  ) {

    reject(
      "TRADING_CALENDAR_UNVERIFIABLE",
      "無法由匯入的 Trading Calendar 確認 previousTradingDate",
      sessionDate
    );

  }


  if (
    previousTradingDate !==
      expectedPreviousTradingDate
  ) {

    reject(
      "PREVIOUS_TRADING_DATE_MISMATCH",
      `previousTradingDate 應為 ${expectedPreviousTradingDate}，收到 ${previousTradingDate}`,
      sessionDate
    );

  }

}


function normalizeSessions(
  sessions,
  snapshots,
  metadata
) {

  if (
    !Array.isArray(
      sessions
    )
  ) {

    reject(
      "MISSING_SESSIONS",
      "缺少 sessions"
    );

  }


  assertStrictDateOrder(
    sessions,
    "Session"
  );

  const snapshotsByDate =
    new Map(
      snapshots.map(
        snapshot => [
          snapshot.date,
          snapshot
        ]
      )
    );

  const candidateAudits =
    [];

  const validationLogs =
    [];

  let fiveMinuteBarCount =
    0;


  const normalizedSessions =
    sessions.map(
      session => {

        const sessionDate =
          normalizeTradingDate(
            session.date
          );

        const previousTradingDate =
          normalizeTradingDate(
            session.previousTradingDate
          );


        if (
          !previousTradingDate
        ) {

          reject(
            "MISSING_PREVIOUS_TRADING_DATE",
            "缺少有效 previousTradingDate",
            sessionDate
          );

        }


        if (
          previousTradingDate >=
            sessionDate
        ) {

          reject(
            "FUTURE_SNAPSHOT",
            `不得使用 ${previousTradingDate} Snapshot 產生 ${sessionDate} Candidate`,
            sessionDate
          );

        }


        validateCalendarPreviousDate(
          metadata,
          sessionDate,
          previousTradingDate
        );

        const snapshot =
          snapshotsByDate.get(
            previousTradingDate
          );


        if (
          !snapshot
        ) {

          reject(
            "MISSING_PREVIOUS_SNAPSHOT",
            `缺少 ${previousTradingDate} Daily Snapshot`,
            sessionDate
          );

        }


        const barsByCode =
          collectSessionBars(
            session,
            sessionDate
          );

        const snapshotCodes =
          new Set(
            snapshot.stocks.map(
              stock =>
                normalizeCode(
                  stock.Code
                )
            )
          );

        const sessionBarCount =
          validateBars(
            barsByCode,
            sessionDate,
            snapshotCodes
          );

        const candidateAudit =
          buildCandidateAudit(
            snapshot,
            sessionDate
          );


        validateCandidateBars(
          candidateAudit,
          barsByCode,
          sessionDate
        );

        candidateAudits.push(
          candidateAudit
        );

        fiveMinuteBarCount +=
          sessionBarCount;

        validationLogs.push(
          {
            eventType:
              HISTORICAL_VALIDATION_EVENT.SESSION_ACCEPTED,
            status:
              "ACCEPTED",
            code:
              "SESSION_VALID",
            sessionDate,
            previousTradingDate,
            snapshotStockCount:
              snapshot.stocks.length,
            candidateCount:
              candidateAudit.long.length
              +
              candidateAudit.short.length,
            fiveMinuteBarCount:
              sessionBarCount,
            message:
              `${sessionDate} Historical Session 驗證通過`
          }
        );

        const {
          bars,
          ...sessionWithoutFlatBars
        } = session;


        return {
          ...sessionWithoutFlatBars,
          date:
            sessionDate,
          previousTradingDate,
          barsByCode
        };

      }
    );


  return {
    normalizedSessions,
    candidateAudits,
    validationLogs,
    fiveMinuteBarCount
  };

}


function buildHistoricalStats(
  snapshots,
  sessions,
  fiveMinuteBarCount
) {

  const stockCodes =
    new Set();


  snapshots.forEach(
    snapshot => {

      snapshot.stocks.forEach(
        stock => {

          stockCodes.add(
            normalizeCode(
              stock.Code
            )
          );

        }
      );

    }
  );


  return {
    dataFrom:
      sessions[0]?.date
      ??
      null,
    dataTo:
      sessions[
        sessions.length - 1
      ]?.date
      ??
      null,
    dailySnapshotCount:
      snapshots.length,
    sessionCount:
      sessions.length,
    fiveMinuteBarCount,
    stockCount:
      stockCodes.size
  };

}


export function buildHistoricalReplayDataset(
  input
) {

  if (
    !input
    ||
    typeof input !==
      "object"
  ) {

    reject(
      "INVALID_HISTORICAL_INPUT",
      "Historical Dataset Builder 輸入格式錯誤"
    );

  }


  const metadata =
    cloneObject(
      input.metadata
      ??
      {}
    );

  const dailySnapshots =
    normalizeSnapshots(
      input.dailySnapshots
    );

  const {
    normalizedSessions,
    candidateAudits,
    validationLogs,
    fiveMinuteBarCount
  } = normalizeSessions(
    input.sessions,
    dailySnapshots,
    metadata
  );

  const latestSessionDate =
    normalizedSessions[
      normalizedSessions.length - 1
    ]?.date
    ??
    null;

  const futureSnapshot =
    latestSessionDate

      ? dailySnapshots.find(
          snapshot =>
            snapshot.date >=
              latestSessionDate
        )

      : null;


  if (
    futureSnapshot
  ) {

    reject(
      "FUTURE_SNAPSHOT",
      `Snapshot ${futureSnapshot.date} 不可晚於或等於最後 Session ${latestSessionDate}`,
      latestSessionDate
    );

  }

  const historicalStats =
    buildHistoricalStats(
      dailySnapshots,
      normalizedSessions,
      fiveMinuteBarCount
    );


  return {
    metadata: {
      ...metadata,
      historicalStats,
      validationStatus:
        "VALIDATED"
    },
    dailySnapshots,
    sessions:
      normalizedSessions,
    candidateAudits,
    validationLogs
  };

}


export class HistoricalDatasetBuilder {

  build(
    input
  ) {

    return buildHistoricalReplayDataset(
      input
    );

  }

}
