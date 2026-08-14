export class HistoricalIntradayProviderError
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
      "HistoricalIntradayProviderError";

    this.code =
      code;

    this.context =
      context;

  }

}


export class HistoricalIntradayProvider {

  async getBars() {

    throw new HistoricalIntradayProviderError(
      "INTRADAY_PROVIDER_NOT_IMPLEMENTED",
      "HistoricalIntradayProvider.getBars() is not implemented"
    );

  }

}


export class CallbackHistoricalIntradayProvider
extends HistoricalIntradayProvider {

  constructor(
    {
      loadBars,
      source =
        "CALLBACK_HISTORICAL_INTRADAY"
    } =
      {}
  ) {

    super();

    this.loadBars =
      loadBars;

    this.source =
      source;

  }


  async getBars(
    request
  ) {

    if (
      typeof this.loadBars !==
        "function"
    ) {

      throw new HistoricalIntradayProviderError(
        "INTRADAY_PROVIDER_NOT_CONFIGURED",
        "Historical intraday loader is not configured",
        request
      );

    }


    const result =
      await this.loadBars(
        request
      );


    if (
      !result
      ||
      !Array.isArray(
        result.bars
      )
    ) {

      throw new HistoricalIntradayProviderError(
        "MISSING_CANDIDATE_5M_DATA",
        `${request.code} has no intraday data for ${request.date}`,
        request
      );

    }


    return {
      ...result,
      code:
        request.code,
      date:
        request.date,
      timeframeMinutes:
        Number(
          result.timeframeMinutes
          ??
          request.timeframeMinutes
        ),
      source:
        result.source
        ??
        this.source
    };

  }

}


export class DatasetHistoricalIntradayProvider
extends HistoricalIntradayProvider {

  constructor(
    dataset
  ) {

    super();

    this.dataset =
      dataset;

  }


  async getBars(
    {
      code,
      date,
      timeframeMinutes =
        5
    }
  ) {

    const session =
      this.dataset?.sessions?.find(
        value =>
          value.date ===
            date
      );

    const bars =
      session?.barsByCode?.[code];


    if (
      !Array.isArray(
        bars
      )
    ) {

      throw new HistoricalIntradayProviderError(
        "MISSING_CANDIDATE_5M_DATA",
        `${code} has no cached intraday data for ${date}`,
        {
          code,
          date
        }
      );

    }


    return {
      code,
      date,
      timeframeMinutes,
      source:
        "REPLAY_DATASET",
      bars:
        bars.map(
          bar => ({
            ...bar
          })
        )
    };

  }

}


export class ShioajiHistoricalAdapter
extends HistoricalIntradayProvider {

  constructor(
    {
      requestKbars =
        null
    } =
      {}
  ) {

    super();

    this.requestKbars =
      requestKbars;

  }


  async getBars(
    request
  ) {

    if (
      typeof this.requestKbars !==
        "function"
    ) {

      throw new HistoricalIntradayProviderError(
        "SHIOAJI_ADAPTER_NOT_CONFIGURED",
        "Shioaji historical adapter has no server-side request bridge",
        request
      );

    }


    const result =
      await this.requestKbars(
        {
          code:
            request.code,
          date:
            request.date,
          timeframeMinutes:
            request.timeframeMinutes
        }
      );


    if (
      !result
      ||
      !Array.isArray(
        result.bars
      )
    ) {

      throw new HistoricalIntradayProviderError(
        "MISSING_CANDIDATE_5M_DATA",
        `${request.code} Shioaji Kbars are unavailable`,
        request
      );

    }


    return {
      ...result,
      code:
        request.code,
      date:
        request.date,
      source:
        "SHIOAJI_HISTORICAL_ADAPTER"
    };

  }

}
