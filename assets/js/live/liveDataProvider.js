import {
  toNumber
} from "../utils/number.js";


export function normalizeLiveQuote(
  rawQuote
) {

  if (
    !rawQuote
  ) {

    return null;

  }


  const code =
    String(
      rawQuote.code
      ??
      rawQuote.Code
      ??
      ""
    )
    .trim();


  if (
    !code
  ) {

    return null;

  }


  return {

    code,

    timestamp:

      rawQuote.timestamp

      ??

      rawQuote.datetime

      ??

      new Date()
      .toISOString(),


    open:

      toNumber(
        rawQuote.open
        ??
        rawQuote.Open
      ),


    high:

      toNumber(
        rawQuote.high
        ??
        rawQuote.High
      ),


    low:

      toNumber(
        rawQuote.low
        ??
        rawQuote.Low
      ),


    last:

      toNumber(
        rawQuote.last
        ??
        rawQuote.close
        ??
        rawQuote.Close
      ),


    volume:

      toNumber(
        rawQuote.volume
        ??
        rawQuote.totalVolume
        ??
        rawQuote.TotalVolume
      ),


    bid:

      toNumber(
        rawQuote.bid
        ??
        rawQuote.Bid
      ),


    ask:

      toNumber(
        rawQuote.ask
        ??
        rawQuote.Ask
      ),


    candles:
      Array.isArray(
        rawQuote.candles
      )

        ? rawQuote.candles

        : [],


    invalidated:
      rawQuote.invalidated ===
      true

  };

}


export class LiveDataProvider {

  constructor() {

    this.running =
      false;


    this.listeners =
      new Set();

  }


  subscribe(
    listener
  ) {

    if (
      typeof listener !==
      "function"
    ) {

      return () => {};

    }


    this.listeners.add(
      listener
    );


    return () => {

      this.listeners.delete(
        listener
      );

    };

  }


  emit(
    rawQuote
  ) {

    const quote =
      normalizeLiveQuote(
        rawQuote
      );


    if (
      !quote
    ) {

      return;

    }


    this.listeners.forEach(
      listener => {

        listener(
          quote
        );

      }
    );

  }


  start() {

    this.running =
      true;

  }


  stop() {

    this.running =
      false;

  }

}
