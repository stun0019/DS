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
  SUPPORTED_TRADE_VOLUME_FIELDS
} from "../data/stockData.js";

import {
  HISTORICAL_UNIVERSE_MODE
} from "./historicalUniverse.js";

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


export const HISTORICAL_VOLUME_MODE_UNDECLARED =
  "VOLUME_MODE_UNDECLARED";


const REQUIRED_SNAPSHOT_NUMERIC_FIELDS = [
  "OpeningPrice",
  "HighestPrice",
  "LowestPrice",
  "ClosingPrice",
  "Change"
];


const REQUIRED_SNAPSHOT_BOOLEAN_FIELDS = [
  "DayTradeEligible",
  "SellFirstDayTradeAllowed"
];


function normalizeUniverseMetadata(
  metadata,
  snapshots
) {

  const isReal =
    metadata.sourceType ===
      "REAL_HISTORICAL_DATA";

  const observedCodes =
    new Set();

  const observedMarkets = {
    TWSE:
      new Set(),
    TPEX:
      new Set()
  };


  snapshots.forEach(
    snapshot => {

      snapshot.stocks.forEach(
        stock => {

          const code =
            String(
              stock.Code
              ??
              ""
            );

          const market =
            String(
              stock.Market
              ??
              ""
            )
            .toUpperCase();

          observedCodes.add(
            code
          );


          if (
            observedMarkets[market]
          ) {

            observedMarkets[market]
            .add(
              code
            );

          }

        }
      );

    }
  );


  if (
    !isReal
    &&
    metadata.universeValidated !==
      true
  ) {

    return {
      universeMode:
        metadata.universeMode
        ??
        "UNIVERSE_MODE_UNDECLARED",
      universeValidated:
        false,
      universeStockCount:
        observedCodes.size,
      twseStockCount:
        observedMarkets.TWSE.size,
      tpexStockCount:
        observedMarkets.TPEX.size
    };

  }


  const universeStockCount =
    Number(
      metadata.universeStockCount
    );

  const twseStockCount =
    Number(
      metadata.twseStockCount
    );

  const tpexStockCount =
    Number(
      metadata.tpexStockCount
    );


  if (
    metadata.universeValidated !==
      true
  ) {

    reject(
      "UNIVERSE_NOT_VALIDATED",
      "REAL historical dataset requires a validated company-equity universe"
    );

  }


  if (
    metadata.universeMode !==
      HISTORICAL_UNIVERSE_MODE
    ||
    !Number.isInteger(
      universeStockCount
    )
    ||
    !Number.isInteger(
      twseStockCount
    )
    ||
    !Number.isInteger(
      tpexStockCount
    )
    ||
    universeStockCount <=
      0
    ||
    twseStockCount <=
      0
    ||
    tpexStockCount <=
      0
    ||
    universeStockCount !==
      twseStockCount
      +
      tpexStockCount
  ) {

    reject(
      "INVALID_UNIVERSE_METADATA",
      "Historical universe metadata is incomplete or inconsistent"
    );

  }


  snapshots.forEach(
    snapshot => {

      const datedUniverse =
        metadata.universeByDate?.[
          snapshot.date
        ];

      const expectedUniverseStockCount =
        Number(
          datedUniverse?.universeStockCount
          ??
          universeStockCount
        );

      const expectedTwseStockCount =
        Number(
          datedUniverse?.twseStockCount
          ??
          twseStockCount
        );

      const expectedTpexStockCount =
        Number(
          datedUniverse?.tpexStockCount
          ??
          tpexStockCount
        );

      const snapshotTwseCount =
        snapshot.stocks.filter(
          stock =>
            stock.Market ===
              "TWSE"
        ).length;

      const snapshotTpexCount =
        snapshot.stocks.filter(
          stock =>
            stock.Market ===
              "TPEX"
        ).length;


      if (
        datedUniverse
        &&
        (
          datedUniverse.universeValidated !==
            true
          ||
          datedUniverse.universeMode !==
            HISTORICAL_UNIVERSE_MODE
        )
        ||
        snapshot.stocks.length !==
          expectedUniverseStockCount
        ||
        snapshotTwseCount !==
          expectedTwseStockCount
        ||
        snapshotTpexCount !==
          expectedTpexStockCount
      ) {

        reject(
          "INCOMPLETE_HISTORICAL_UNIVERSE",
          "Snapshot stock counts do not match validated universe metadata",
          snapshot.date
        );

      }

    }
  );


  return {
    universeMode:
      HISTORICAL_UNIVERSE_MODE,
    universeValidated:
      true,
    universeStockCount,
    twseStockCount,
    tpexStockCount
  };

}


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


function hasDeclaredValue(
  object,
  field
) {

  return Object.prototype.hasOwnProperty.call(
    object,
    field
  )
  &&
  object[field] !== undefined
  &&
  object[field] !== null
  &&
  !(
    typeof object[field] ===
      "string"
    &&
    object[field].trim() ===
      ""
  );

}


function validateSnapshotStock(
  stock,
  code,
  date
) {

  for (
    const field
    of REQUIRED_SNAPSHOT_NUMERIC_FIELDS
  ) {

    if (
      !hasDeclaredValue(
        stock,
        field
      )
    ) {

      reject(
        "MISSING_SNAPSHOT_FIELD",
        `Snapshot stock ${code} is missing ${field}`,
        date
      );

    }


    if (
      !Number.isFinite(
        Number(
          stock[field]
        )
      )
    ) {

      reject(
        field ===
          "Change"

          ? "INVALID_SNAPSHOT_CHANGE"

          : "INVALID_SNAPSHOT_OHLC",
        `Snapshot stock ${code} has invalid ${field}`,
        date
      );

    }

  }


  for (
    const field
    of REQUIRED_SNAPSHOT_BOOLEAN_FIELDS
  ) {

    if (
      !hasDeclaredValue(
        stock,
        field
      )
    ) {

      reject(
        "MISSING_SNAPSHOT_FIELD",
        `Snapshot stock ${code} is missing ${field}`,
        date
      );

    }


    if (
      typeof stock[field] !==
        "boolean"
    ) {

      reject(
        "INVALID_SNAPSHOT_ELIGIBILITY",
        `Snapshot stock ${code} requires boolean ${field}`,
        date
      );

    }

  }


  const declaredVolumeFields =
    SUPPORTED_TRADE_VOLUME_FIELDS.filter(
      field =>
        hasDeclaredValue(
          stock,
          field
        )
    );


  if (
    declaredVolumeFields.length ===
      0
  ) {

    reject(
      "MISSING_SNAPSHOT_VOLUME",
      `Snapshot stock ${code} has no supported volume field`,
      date
    );

  }


  for (
    const field
    of declaredVolumeFields
  ) {

    const volume =
      Number(
        stock[field]
      );


    if (
      !Number.isFinite(
        volume
      )
      ||
      volume <
        0
    ) {

      reject(
        "INVALID_SNAPSHOT_VOLUME",
        `Snapshot stock ${code} has invalid ${field}`,
        date
      );

    }

  }


  const open =
    Number(
      stock.OpeningPrice
    );

  const high =
    Number(
      stock.HighestPrice
    );

  const low =
    Number(
      stock.LowestPrice
    );

  const close =
    Number(
      stock.ClosingPrice
    );


  if (
    open <= 0
    ||
    high <= 0
    ||
    low <= 0
    ||
    close <= 0
    ||
    high < open
    ||
    high < close
    ||
    high < low
    ||
    low > open
    ||
    low > close
  ) {

    reject(
      "INVALID_SNAPSHOT_OHLC",
      `Snapshot stock ${code} has inconsistent OHLC values`,
      date
    );

  }

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
    ||
    dailySnapshots.length ===
      0
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


      if (
        stocks.length ===
          0
      ) {

        reject(
          "EMPTY_SNAPSHOT_STOCKS",
          "Daily Snapshot stocks must not be empty",
          date
        );

      }

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


            validateSnapshotStock(
              stock,
              code,
              date
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
    ||
    sessions.length ===
      0
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

  const universeMetadata =
    normalizeUniverseMetadata(
      metadata,
      dailySnapshots
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

  const declaredVolumeMode =
    String(
      metadata.volumeMode
      ??
      ""
    )
    .trim();


  return {
    metadata: {
      ...metadata,
      ...universeMetadata,
      historicalStats,
      validationStatus:
        "VALIDATED",
      snapshotSchemaValidated:
        true,
      candidateSelectionDeterministic:
        true,
      volumeMode:
        declaredVolumeMode
        ||
        HISTORICAL_VOLUME_MODE_UNDECLARED
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
