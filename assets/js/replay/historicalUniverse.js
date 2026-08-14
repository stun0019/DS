export const HISTORICAL_UNIVERSE_MODE =
  "TWSE_TPEX_COMPANY_EQUITY_ONLY";

export const HISTORICAL_UNIVERSE_MARKETS = [
  "TWSE",
  "TPEX"
];


export class HistoricalUniverseError extends Error {

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
      "HistoricalUniverseError";

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

  throw new HistoricalUniverseError(
    code,
    message,
    date
  );

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


function normalizeCompanyCodes(
  contract,
  market,
  date
) {

  if (
    !contract
    ||
    contract.validated !==
      true
    ||
    contract.date !==
      date
    ||
    contract.market !==
      market
    ||
    !Array.isArray(
      contract.codes
    )
  ) {

    reject(
      "UNIVERSE_NOT_VALIDATED",
      `${market} company-equity whitelist is unavailable or not validated`,
      date
    );

  }


  const codes =
    new Set(
      contract.codes
      .map(
        normalizeCode
      )
      .filter(
        Boolean
      )
    );


  if (
    codes.size ===
      0
  ) {

    reject(
      "EMPTY_COMPANY_EQUITY_WHITELIST",
      `${market} company-equity whitelist is empty`,
      date
    );

  }


  return codes;

}


export function buildHistoricalUniverse(
  {
    date,
    marketStocks,
    companyEquityWhitelists
  }
) {

  if (
    !date
    ||
    !marketStocks
    ||
    !companyEquityWhitelists
  ) {

    reject(
      "INVALID_UNIVERSE_INPUT",
      "Historical universe requires date, market data and company whitelists",
      date
      ??
      null
    );

  }


  const stocks = [];
  const seenCodes =
    new Set();

  const marketCounts = {
    TWSE: 0,
    TPEX: 0
  };


  HISTORICAL_UNIVERSE_MARKETS.forEach(
    market => {

      const dailyStocks =
        marketStocks[market];


      if (
        !Array.isArray(
          dailyStocks
        )
      ) {

        reject(
          "MISSING_MARKET_DAILY_DATA",
          `${market} daily data is missing`,
          date
        );

      }


      const companyCodes =
        normalizeCompanyCodes(
          companyEquityWhitelists[market],
          market,
          date
        );


      dailyStocks.forEach(
        stock => {

          const code =
            normalizeCode(
              stock?.Code
            );


          if (
            !code
            ||
            !companyCodes.has(
              code
            )
          ) {

            return;

          }


          if (
            seenCodes.has(
              code
            )
          ) {

            reject(
              "DUPLICATE_UNIVERSE_CODE",
              `Duplicate company-equity code ${code}`,
              date
            );

          }


          seenCodes.add(
            code
          );

          marketCounts[market] +=
            1;

          stocks.push(
            {
              ...stock,
              Code:
                code,
              Market:
                market,
              MarketName:
                stock.MarketName
                ??
                (
                  market ===
                    "TWSE"

                    ? "上市"

                    : "上櫃"
                )
            }
          );

        }
      );

    }
  );


  if (
    marketCounts.TWSE ===
      0
    ||
    marketCounts.TPEX ===
      0
  ) {

    reject(
      "INCOMPLETE_HISTORICAL_UNIVERSE",
      "Both TWSE and TPEx company-equity universes are required",
      date
    );

  }


  stocks.sort(
    (
      first,
      second
    ) =>
      first.Code.localeCompare(
        second.Code
      )
  );


  return {
    date,
    stocks,
    metadata: {
      universeMode:
        HISTORICAL_UNIVERSE_MODE,
      universeValidated:
        true,
      universeStockCount:
        stocks.length,
      twseStockCount:
        marketCounts.TWSE,
      tpexStockCount:
        marketCounts.TPEX
    }
  };

}


export class HistoricalUniverseBuilder {

  build(
    input
  ) {

    return buildHistoricalUniverse(
      input
    );

  }

}
