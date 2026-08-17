import {
  state,
  setMaxRiskAmount,
  setReplayDataset,
  setReplayProgress,
  setReplayReport
} from "./state.js";

import {
  normalizeReplayDataset
} from "../replay/historical5mProvider.js";


export function installReplayBrowserApi(
  {
    target,
    rerunReplay,
    navigateTo,
    renderCurrentView,
    getHistoricalAutoPipeline,
    setHistoricalAutoPipeline
  }
) {

  const api = {

    run(
      dataset,
      options =
        {}
    ) {

      if (
        options.maxRiskAmount !==
          undefined
      ) {

        setMaxRiskAmount(
          options.maxRiskAmount
        );

      }

      setReplayDataset(
        normalizeReplayDataset(
          dataset,
          {
            adapter:
              "PROGRAMMATIC_IMPORT"
          }
        ),
        options.name
        ||
        "程式載入"
      );

      const report =
        rerunReplay(
          options
        );

      navigateTo(
        "replay"
      );

      return report;

    },


    getReport() {
      return state.replay.report;
    },


    configureHistoricalAutoPipeline(
      pipeline
    ) {

      if (
        !pipeline
        ||
        typeof pipeline.run !==
          "function"
      ) {

        throw new TypeError(
          "Historical auto pipeline must expose run(options)"
        );

      }

      setHistoricalAutoPipeline(
        pipeline
      );

      return true;

    },


    hasHistoricalAutoPipeline() {
      return Boolean(
        getHistoricalAutoPipeline()
      );
    },


    clear() {
      setReplayDataset(null, "");
      setReplayReport(null, null);
      setReplayProgress(null, false);

      if (
        state.currentView ===
          "replay"
      ) {

        renderCurrentView();

      }
    }

  };

  target.stockDaybydayReplay =
    Object.freeze(
      api
    );

  return target.stockDaybydayReplay;

}


export function installMockBrowserApi(
  {
    target,
    provider,
    reset
  }
) {

  const api = {

    push(
      quote
    ) {

      provider.pushQuote(
        quote
      );

    },


    play(
      quotes,
      intervalMs =
        1000
    ) {

      return provider.play(
        quotes,
        {
          intervalMs
        }
      );

    },


    reset,


    stop() {
      provider.stop();
    },


    start() {
      provider.start();
    }

  };

  target.stockDaybydayMock =
    Object.freeze(
      api
    );

  return target.stockDaybydayMock;

}
