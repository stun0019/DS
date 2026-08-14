import {
  HISTORICAL_UNIVERSE_MARKETS
} from "./historicalUniverse.js";

import {
  isTradingDate,
  normalizeTradingDate
} from "../utils/tradingCalendar.js";


export class HistoricalCollectorError extends Error {

  constructor(
    code,
    message,
    date =
      null
  ) {

    super(
      `[${code}]${date ? ` ${date}` : ""} ${message}`
    );

    this.name =
      "HistoricalCollectorError";

    this.code =
      code;

    this.date =
      date;

  }

}


function reject(
  code,
  message,
  date =
    null
) {

  throw new HistoricalCollectorError(
    code,
    message,
    date
  );

}


function assertDailyResult(
  result,
  market,
  date
) {

  if (
    !result
    ||
    result.date !==
      date
    ||
    result.market !==
      market
    ||
    !Array.isArray(
      result.stocks
    )
    ||
    result.stocks.length ===
      0
  ) {

    reject(
      "MISSING_MARKET_DAILY_DATA",
      `${market} historical daily provider returned no valid data`,
      date
    );

  }


  return result;

}


export class HistoricalDailyProvider {

  async getDaily() {

    throw new HistoricalCollectorError(
      "DAILY_PROVIDER_NOT_IMPLEMENTED",
      "HistoricalDailyProvider.getDaily() is not implemented"
    );

  }

}


class CallbackHistoricalDailyProvider
extends HistoricalDailyProvider {

  constructor(
    {
      market,
      source,
      loadDaily
    }
  ) {

    super();

    this.market =
      market;

    this.source =
      source;

    this.loadDaily =
      loadDaily;

  }


  async getDaily(
    {
      date
    }
  ) {

    if (
      typeof this.loadDaily !==
        "function"
    ) {

      reject(
        "DAILY_PROVIDER_NOT_CONFIGURED",
        `${this.market} official historical daily loader is not configured`,
        date
      );

    }


    const result =
      await this.loadDaily(
        {
          date,
          market:
            this.market,
          source:
            this.source
        }
      );


    return assertDailyResult(
      {
        ...result,
        source:
          result?.source
          ??
          this.source
      },
      this.market,
      date
    );

  }

}


export class TwseHistoricalDailyProvider
extends CallbackHistoricalDailyProvider {

  constructor(
    options =
      {}
  ) {

    super(
      {
        ...options,
        market:
          "TWSE",
        source:
          options.source
          ??
          "TWSE_OFFICIAL_HISTORICAL_DAILY"
      }
    );

  }

}


export class TpexHistoricalDailyProvider
extends CallbackHistoricalDailyProvider {

  constructor(
    options =
      {}
  ) {

    super(
      {
        ...options,
        market:
          "TPEX",
        source:
          options.source
          ??
          "TPEX_OFFICIAL_HISTORICAL_DAILY"
      }
    );

  }

}


export class HistoricalCompanyUniverseProvider {

  async getCompanyEquities() {

    throw new HistoricalCollectorError(
      "UNIVERSE_PROVIDER_NOT_IMPLEMENTED",
      "HistoricalCompanyUniverseProvider.getCompanyEquities() is not implemented"
    );

  }

}


export class CallbackHistoricalCompanyUniverseProvider
extends HistoricalCompanyUniverseProvider {

  constructor(
    {
      loadCompanyEquities
    } =
      {}
  ) {

    super();

    this.loadCompanyEquities =
      loadCompanyEquities;

  }


  async getCompanyEquities(
    {
      date,
      market
    }
  ) {

    if (
      typeof this.loadCompanyEquities !==
        "function"
    ) {

      reject(
        "UNIVERSE_PROVIDER_NOT_CONFIGURED",
        `${market} historical company whitelist loader is not configured`,
        date
      );

    }


    const result =
      await this.loadCompanyEquities(
        {
          date,
          market
        }
      );


    if (
      !result
      ||
      result.validated !==
        true
      ||
      result.date !==
        date
      ||
      result.market !==
        market
      ||
      !Array.isArray(
        result.codes
      )
    ) {

      reject(
        "UNIVERSE_NOT_VALIDATED",
        `${market} historical company whitelist is not validated`,
        date
      );

    }


    return result;

  }

}


export class HistoricalEligibilityProvider {

  async getEligibility() {

    throw new HistoricalCollectorError(
      "ELIGIBILITY_PROVIDER_NOT_IMPLEMENTED",
      "HistoricalEligibilityProvider.getEligibility() is not implemented"
    );

  }

}


export class CallbackHistoricalEligibilityProvider
extends HistoricalEligibilityProvider {

  constructor(
    {
      loadEligibility
    } =
      {}
  ) {

    super();

    this.loadEligibility =
      loadEligibility;

  }


  async getEligibility(
    {
      date,
      market
    }
  ) {

    if (
      typeof this.loadEligibility !==
        "function"
    ) {

      reject(
        "ELIGIBILITY_PROVIDER_NOT_CONFIGURED",
        `${market} historical eligibility loader is not configured`,
        date
      );

    }


    const result =
      await this.loadEligibility(
        {
          date,
          market
        }
      );


    if (
      !result
      ||
      result.validated !==
        true
      ||
      result.date !==
        date
      ||
      result.market !==
        market
      ||
      !Array.isArray(
        result.entries
      )
    ) {

      reject(
        "ELIGIBILITY_NOT_VALIDATED",
        `${market} historical eligibility is not validated`,
        date
      );

    }


    return result;

  }

}


export class HistoricalDailyCollector {

  constructor(
    {
      twseProvider,
      tpexProvider,
      companyUniverseProvider
    }
  ) {

    this.providers = {
      TWSE:
        twseProvider,
      TPEX:
        tpexProvider
    };

    this.companyUniverseProvider =
      companyUniverseProvider;

  }


  async collectDate(
    date
  ) {

    const results =
      await Promise.all(
        HISTORICAL_UNIVERSE_MARKETS.map(
          async market => {

            const provider =
              this.providers[market];


            if (
              !provider
            ) {

              reject(
                "DAILY_PROVIDER_NOT_CONFIGURED",
                `${market} historical daily provider is missing`,
                date
              );

            }


            const [
              daily,
              companyEquities
            ] =
              await Promise.all(
                [
                  provider.getDaily(
                    {
                      date
                    }
                  ),
                  this.companyUniverseProvider
                  .getCompanyEquities(
                    {
                      date,
                      market
                    }
                  )
                ]
              );


            return {
              market,
              daily:
                assertDailyResult(
                  daily,
                  market,
                  date
                ),
              companyEquities
            };

          }
        )
      );


    return {
      date,
      marketStocks:
        Object.fromEntries(
          results.map(
            result => [
              result.market,
              result.daily.stocks
            ]
          )
        ),
      companyEquityWhitelists:
        Object.fromEntries(
          results.map(
            result => [
              result.market,
              result.companyEquities
            ]
          )
        ),
      volumeMode:
        results.map(
          result =>
            result.daily.volumeMode
        )
        .filter(
          Boolean
        )[0]
        ??
        "VOLUME_MODE_UNDECLARED",
      sources:
        results.map(
          result =>
            result.daily.source
        )
    };

  }


  async collectRange(
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
        "INVALID_DAILY_RANGE",
        "Historical daily range is invalid"
      );

    }


    const results = [];
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
          cursor
        );

      }


      if (
        tradingStatus
      ) {

        results.push(
          await this.collectDate(
            cursor
          )
        );

      }


      const date =
        new Date(
          `${cursor}T00:00:00Z`
        );

      date.setUTCDate(
        date.getUTCDate()
        +
        1
      );

      cursor =
        date.toISOString()
        .slice(
          0,
          10
        );

    }


    return results;

  }

}


export async function applyHistoricalEligibility(
  {
    date,
    stocks,
    eligibilityProvider
  }
) {

  const contracts =
    await Promise.all(
      HISTORICAL_UNIVERSE_MARKETS.map(
        market =>
          eligibilityProvider.getEligibility(
            {
              date,
              market
            }
          )
      )
    );

  const eligibilityByCode =
    new Map();


  contracts.forEach(
    contract => {

      contract.entries.forEach(
        entry => {

          const code =
            String(
              entry?.Code
              ??
              ""
            )
            .trim();


          if (
            !code
            ||
            typeof entry.DayTradeEligible !==
              "boolean"
            ||
            typeof entry.SellFirstDayTradeAllowed !==
              "boolean"
          ) {

            reject(
              "INVALID_HISTORICAL_ELIGIBILITY",
              `${contract.market} eligibility contains an invalid entry`,
              date
            );

          }


          eligibilityByCode.set(
            `${contract.market}:${code}`,
            entry
          );

        }
      );

    }
  );


  return stocks.map(
    stock => {

      const entry =
        eligibilityByCode.get(
          `${stock.Market}:${stock.Code}`
        );


      if (
        !entry
      ) {

        reject(
          "MISSING_HISTORICAL_ELIGIBILITY",
          `${stock.Market} ${stock.Code} has no eligibility record`,
          date
        );

      }


      return {
        ...stock,
        DayTradeEligible:
          entry.DayTradeEligible,
        SellFirstDayTradeAllowed:
          entry.SellFirstDayTradeAllowed,
        SellFirstSuspended:
          entry.SellFirstDayTradeAllowed ===
            false
      };

    }
  );

}
