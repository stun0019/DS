import {
  getCandidatesBySide
} from "../strategy/candidateSelector.js";

import {
  getPreviousTradingDate,
  isTradingDate,
  normalizeTradingDate
} from "../utils/tradingCalendar.js";

import {
  buildHistoricalReplayDataset
} from "./historicalDatasetBuilder.js";

import {
  runBacktest
} from "./replayEngine.js";

import {
  HISTORICAL_SOURCE_TYPE
} from "./historical5mProvider.js";

import {
  HISTORICAL_UNIVERSE_MODE,
  HistoricalUniverseBuilder
} from "./historicalUniverse.js";

import {
  applyHistoricalEligibility
} from "./historicalDailyCollector.js";

import {
  FiveMinuteBarAggregator
} from "./fiveMinuteBarAggregator.js";

import {
  NullHistoricalCache
} from "./historicalCache.js";


export const HISTORICAL_AUTO_STAGE = {
  PREPARING:
    "PREPARING",
  FETCHING_DAILY:
    "FETCHING_DAILY",
  BUILDING_UNIVERSE:
    "BUILDING_UNIVERSE",
  SELECTING_CANDIDATES:
    "SELECTING_CANDIDATES",
  FETCHING_INTRADAY:
    "FETCHING_INTRADAY",
  BUILDING_5M:
    "BUILDING_5M",
  VALIDATING_DATASET:
    "VALIDATING_DATASET",
  RUNNING_REPLAY:
    "RUNNING_REPLAY",
  COMPLETED:
    "COMPLETED",
  FAILED:
    "FAILED"
};


export class HistoricalAutoBacktestError
extends Error {

  constructor(
    code,
    message,
    context =
      {}
  ) {

    super(
      `[${code}] ${message}`
    );

    this.name =
      "HistoricalAutoBacktestError";

    this.code =
      code;

    this.context =
      context;

  }

}


function reject(
  code,
  message,
  context =
    {}
) {

  throw new HistoricalAutoBacktestError(
    code,
    message,
    context
  );

}


function addCalendarDay(
  value,
  days =
    1
) {

  const date =
    new Date(
      `${value}T00:00:00Z`
    );

  date.setUTCDate(
    date.getUTCDate()
    +
    days
  );

  return date.toISOString()
  .slice(
    0,
    10
  );

}


export function getHistoricalTradingDates(
  {
    fromDate,
    toDate,
    tradingCalendar
  }
) {

  const from =
    normalizeTradingDate(
      fromDate
    );

  const to =
    normalizeTradingDate(
      toDate
    );


  if (
    !from
    ||
    !to
    ||
    from >
      to
  ) {

    reject(
      "INVALID_BACKTEST_RANGE",
      "Historical backtest range is invalid",
      {
        fromDate,
        toDate
      }
    );

  }


  const dates = [];
  let cursor =
    from;


  while (
    cursor <=
      to
  ) {

    const tradingStatus =
      isTradingDate(
        cursor,
        tradingCalendar
      );


    if (
      tradingStatus ===
        null
    ) {

      reject(
        "TRADING_CALENDAR_NOT_VALIDATED",
        `Trading calendar cannot validate ${cursor}`,
        {
          date:
            cursor
        }
      );

    }


    if (
      tradingStatus
    ) {

      dates.push(
        cursor
      );

    }


    cursor =
      addCalendarDay(
        cursor
      );

  }


  if (
    dates.length ===
      0
  ) {

    reject(
      "NO_TRADING_SESSIONS",
      "The selected range contains no trading session"
    );

  }


  return dates;

}


function taipeiDate(
  timestamp
) {

  const value =
    new Date(
      timestamp
    );


  if (
    Number.isNaN(
      value.getTime()
    )
  ) {

    return null;

  }


  const parts =
    Object.fromEntries(
      new Intl.DateTimeFormat(
        "en-CA",
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
        value
      )
      .map(
        part => [
          part.type,
          part.value
        ]
      )
    );


  return `${parts.year}-${parts.month}-${parts.day}`;

}


function validateCompletedFiveMinuteBars(
  bars,
  code,
  date
) {

  if (
    !Array.isArray(
      bars
    )
    ||
    bars.length ===
      0
  ) {

    reject(
      "MISSING_CANDIDATE_5M_DATA",
      `${code} has no completed 5m bars`,
      {
        code,
        date
      }
    );

  }


  const normalized =
    bars.map(
      bar => ({
        ...bar,
        code
      })
    )
    .sort(
      (
        first,
        second
      ) =>
        String(
          first.timestamp
        )
        .localeCompare(
          String(
            second.timestamp
          )
        )
    );


  normalized.forEach(
    bar => {

      const prices = [
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume
      ]
      .map(
        Number
      );


      if (
        bar.isComplete !==
          true
        ||
        Number(
          bar.timeframeMinutes
        ) !==
          5
        ||
        taipeiDate(
          bar.timestamp
        ) !==
          date
        ||
        prices.some(
          value =>
            !Number.isFinite(
              value
            )
        )
        ||
        prices.slice(
          0,
          4
        )
        .some(
          value =>
            value <=
              0
        )
        ||
        prices[4] <
          0
        ||
        Number(
          bar.high
        ) <
          Math.max(
            Number(
              bar.open
            ),
            Number(
              bar.close
            ),
            Number(
              bar.low
            )
          )
        ||
        Number(
          bar.low
        ) >
          Math.min(
            Number(
              bar.open
            ),
            Number(
              bar.close
            )
          )
      ) {

        reject(
          "INVALID_CANDIDATE_5M_DATA",
          `${code} contains an invalid or incomplete 5m bar`,
          {
            code,
            date,
            timestamp:
              bar.timestamp
          }
        );

      }

    }
  );


  return normalized;

}


function candidateCodes(
  candidates
) {

  return [
    ...new Set(
      [
        ...candidates.long,
        ...candidates.short
      ]
      .map(
        stock =>
          String(
            stock.Code
          )
      )
    )
  ];

}


export class HistoricalAutoBacktestPipeline {

  constructor(
    {
      dailyCollector,
      universeBuilder =
        new HistoricalUniverseBuilder(),
      eligibilityProvider,
      intradayProvider,
      fiveMinuteAggregator =
        new FiveMinuteBarAggregator(),
      cache =
        new NullHistoricalCache(),
      onProgress =
        null
    }
  ) {

    this.dailyCollector =
      dailyCollector;

    this.universeBuilder =
      universeBuilder;

    this.eligibilityProvider =
      eligibilityProvider;

    this.intradayProvider =
      intradayProvider;

    this.fiveMinuteAggregator =
      fiveMinuteAggregator;

    this.cache =
      cache;

    this.onProgress =
      onProgress;

    this.progress =
      null;

  }


  emit(
    stage,
    detail =
      {}
  ) {

    this.progress = {
      stage,
      ...detail
    };


    if (
      typeof this.onProgress ===
        "function"
    ) {

      this.onProgress(
        this.progress
      );

    }

  }


  async getDailyInput(
    date
  ) {

    const cacheKey = {
      date,
      market:
        "TWSE_TPEX",
      code:
        "",
      timeframe:
        "DAILY",
      source:
        [
          this.dailyCollector?.providers?.TWSE?.source,
          this.dailyCollector?.providers?.TPEX?.source,
          this.dailyCollector?.companyUniverseProvider?.constructor?.name
        ]
        .filter(
          Boolean
        )
        .join(
          "|"
        )
        ||
        "HISTORICAL_DAILY_COLLECTOR",
      volumeMode:
        "AUTO"
    };

    const cached =
      await this.cache.get(
        cacheKey
      );


    if (
      cached
    ) {

      return cached;

    }


    const collected =
      await this.dailyCollector.collectDate(
        date
      );

    await this.cache.set(
      cacheKey,
      collected
    );


    return collected;

  }


  async getCandidateBars(
    {
      code,
      date,
      market,
      volumeMode
    }
  ) {

    const cacheKey = {
      date,
      market:
        market
        ??
        "",
      code,
      timeframe:
        "5m",
      source:
        this.intradayProvider?.source
        ??
        this.intradayProvider?.constructor?.name
        ??
        "HISTORICAL_INTRADAY_PROVIDER",
      volumeMode
    };

    const cached =
      await this.cache.get(
        cacheKey
      );


    if (
      cached
    ) {

      return validateCompletedFiveMinuteBars(
        cached,
        code,
        date
      );

    }


    const result =
      await this.intradayProvider.getBars(
        {
          code,
          date,
          timeframeMinutes: 5
        }
      );

    const timeframe =
      Number(
        result.timeframeMinutes
      );

    const fiveMinuteBars =
      timeframe ===
        1

        ? this.fiveMinuteAggregator.aggregate(
            result.bars,
            {
              expectedDate:
                date
            }
          )

        : timeframe ===
            5

          ? result.bars

          : reject(
              "UNSUPPORTED_INTRADAY_TIMEFRAME",
              `${code} returned ${timeframe}m bars`,
              {
                code,
                date
              }
            );

    const completed =
      validateCompletedFiveMinuteBars(
        fiveMinuteBars,
        code,
        date
      );

    await this.cache.set(
      cacheKey,
      completed
    );


    return completed;

  }


  async run(
    {
      fromDate,
      toDate,
      tradingCalendar,
      replayOptions =
        {}
    }
  ) {

    try {
      this.emit(
        HISTORICAL_AUTO_STAGE.PREPARING,
        {
          fromDate,
          toDate,
          completedSessions: 0,
          totalSessions: 0,
          progressPercent: 0
        }
      );

      const sessionDates =
        getHistoricalTradingDates(
          {
            fromDate,
            toDate,
            tradingCalendar
          }
        );

      const dailySnapshots = [];
      const sessions = [];
      const universeByDate = {};
      const snapshotDates =
        new Set();

      let latestUniverseMetadata =
        null;

      let volumeMode =
        "VOLUME_MODE_UNDECLARED";


      for (
        let sessionIndex = 0;
        sessionIndex < sessionDates.length;
        sessionIndex += 1
      ) {

        const sessionDate =
          sessionDates[sessionIndex];

        const previousTradingDate =
          getPreviousTradingDate(
            sessionDate,
            tradingCalendar
          );


        if (
          !previousTradingDate
        ) {

          reject(
            "PREVIOUS_TRADING_DATE_UNAVAILABLE",
            `Cannot resolve D-1 for ${sessionDate}`,
            {
              date:
                sessionDate
            }
          );

        }


        this.emit(
          HISTORICAL_AUTO_STAGE.FETCHING_DAILY,
          {
            currentDate:
              sessionDate,
            snapshotDate:
              previousTradingDate,
            completedSessions:
              sessionIndex,
            totalSessions:
              sessionDates.length,
            progressPercent:
              Math.round(
                sessionIndex
                /
                sessionDates.length
                *
                100
              )
          }
        );

        const dailyInput =
          await this.getDailyInput(
            previousTradingDate
          );

        volumeMode =
          dailyInput.volumeMode
          ??
          volumeMode;

        this.emit(
          HISTORICAL_AUTO_STAGE.BUILDING_UNIVERSE,
          {
            currentDate:
              sessionDate,
            snapshotDate:
              previousTradingDate,
            completedSessions:
              sessionIndex,
            totalSessions:
              sessionDates.length
          }
        );

        const universe =
          this.universeBuilder.build(
            {
              date:
                previousTradingDate,
              marketStocks:
                dailyInput.marketStocks,
              companyEquityWhitelists:
                dailyInput.companyEquityWhitelists
            }
          );

        const eligibleStocks =
          await applyHistoricalEligibility(
            {
              date:
                previousTradingDate,
              stocks:
                universe.stocks,
              eligibilityProvider:
                this.eligibilityProvider
            }
          );

        latestUniverseMetadata =
          universe.metadata;

        universeByDate[previousTradingDate] =
          universe.metadata;


        if (
          !snapshotDates.has(
            previousTradingDate
          )
        ) {

          dailySnapshots.push(
            {
              date:
                previousTradingDate,
              stocks:
                eligibleStocks
            }
          );

          snapshotDates.add(
            previousTradingDate
          );

        }


        this.emit(
          HISTORICAL_AUTO_STAGE.SELECTING_CANDIDATES,
          {
            currentDate:
              sessionDate,
            snapshotDate:
              previousTradingDate,
            completedSessions:
              sessionIndex,
            totalSessions:
              sessionDates.length
          }
        );

        const candidates =
          getCandidatesBySide(
            eligibleStocks.map(
              stock => ({
                ...stock
              })
            )
          );

        const codes =
          candidateCodes(
            candidates
          );


        if (
          codes.length ===
            0
        ) {

          reject(
            "EMPTY_HISTORICAL_CANDIDATES",
            `${sessionDate} has no candidate to replay`,
            {
              date:
                sessionDate
            }
          );

        }


        const barsByCode = {};


        for (
          let candidateIndex = 0;
          candidateIndex < codes.length;
          candidateIndex += 1
        ) {

          const code =
            codes[candidateIndex];

          const stock =
            eligibleStocks.find(
              value =>
                String(
                  value.Code
                ) ===
                  code
            );

          this.emit(
            HISTORICAL_AUTO_STAGE.FETCHING_INTRADAY,
            {
              currentDate:
                sessionDate,
              currentCode:
                code,
              currentName:
                stock?.Name
                ??
                "",
              candidateIndex:
                candidateIndex + 1,
              candidateCount:
                codes.length,
              completedSessions:
                sessionIndex,
              totalSessions:
                sessionDates.length,
              progressPercent:
                Math.round(
                  (
                    sessionIndex
                    +
                    candidateIndex
                    /
                    codes.length
                  )
                  /
                  sessionDates.length
                  *
                  100
                )
            }
          );

          barsByCode[code] =
            await this.getCandidateBars(
              {
                code,
                date:
                  sessionDate,
                market:
                  stock?.Market
                  ??
                  "",
                volumeMode
              }
            );

        }


        this.emit(
          HISTORICAL_AUTO_STAGE.BUILDING_5M,
          {
            currentDate:
              sessionDate,
            completedSessions:
              sessionIndex,
            totalSessions:
              sessionDates.length
          }
        );

        sessions.push(
          {
            date:
              sessionDate,
            previousTradingDate,
            barsByCode
          }
        );

      }


      this.emit(
        HISTORICAL_AUTO_STAGE.VALIDATING_DATASET,
        {
          completedSessions:
            sessionDates.length,
          totalSessions:
            sessionDates.length,
          progressPercent: 96
        }
      );

      const dataset =
        buildHistoricalReplayDataset(
          {
            metadata: {
              sourceType:
                HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA,
              adapter:
                "HISTORICAL_AUTO_COLLECTOR",
              tradingCalendar,
              volumeMode,
              universeMode:
                HISTORICAL_UNIVERSE_MODE,
              universeValidated:
                true,
              universeStockCount:
                latestUniverseMetadata?.universeStockCount
                ??
                0,
              twseStockCount:
                latestUniverseMetadata?.twseStockCount
                ??
                0,
              tpexStockCount:
                latestUniverseMetadata?.tpexStockCount
                ??
                0,
              universeByDate
            },
            dailySnapshots,
            sessions
          }
        );

      this.emit(
        HISTORICAL_AUTO_STAGE.RUNNING_REPLAY,
        {
          completedSessions:
            sessionDates.length,
          totalSessions:
            sessionDates.length,
          progressPercent: 98
        }
      );

      const report =
        runBacktest(
          dataset,
          replayOptions
        );

      this.emit(
        HISTORICAL_AUTO_STAGE.COMPLETED,
        {
          completedSessions:
            sessionDates.length,
          totalSessions:
            sessionDates.length,
          validatedSessions:
            sessionDates.length,
          progressPercent: 100
        }
      );


      return {
        dataset,
        report,
        progress:
          this.progress
      };

    }
    catch (
      error
    ) {

      const previousProgress =
        this.progress
        ??
        {};

      this.emit(
        HISTORICAL_AUTO_STAGE.FAILED,
        {
          currentDate:
            error.context?.date
            ??
            error.date
            ??
            previousProgress.currentDate
            ??
            null,
          currentCode:
            error.context?.code
            ??
            previousProgress.currentCode
            ??
            null,
          completedSessions:
            previousProgress.completedSessions
            ??
            0,
          totalSessions:
            previousProgress.totalSessions
            ??
            0,
          validatedSessions:
            previousProgress.validatedSessions
            ??
            previousProgress.completedSessions
            ??
            0,
          progressPercent:
            previousProgress.progressPercent
            ??
            0,
          errorCode:
            error.code
            ??
            "HISTORICAL_AUTO_BACKTEST_FAILED",
          errorMessage:
            error.message,
          errorContext:
            {
              ...(
                error.context
                ??
                {}
              ),
              date:
                error.context?.date
                ??
                error.date
                ??
                previousProgress.currentDate
                ??
                null
            }
        }
      );

      throw error;

    }

  }

}
