import {
  LiveDataProvider
} from "./liveDataProvider.js";


function wait(
  milliseconds
) {

  return new Promise(
    resolve => {

      setTimeout(
        resolve,
        milliseconds
      );

    }
  );

}


export class MockLiveDataProvider
extends LiveDataProvider {

  constructor() {

    super();

  }


  pushQuote(
    quote
  ) {

    if (
      !this.running
    ) {

      return;

    }


    this.emit(
      quote
    );

  }


  async play(
    quotes,
    {
      intervalMs = 1000
    } = {}
  ) {

    if (
      !Array.isArray(
        quotes
      )
    ) {

      return;

    }


    this.start();


    for (
      const quote
      of quotes
    ) {

      if (
        !this.running
      ) {

        break;

      }


      this.pushQuote(
        quote
      );


      await wait(
        intervalMs
      );

    }

  }

}
