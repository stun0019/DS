import assert from "node:assert/strict";
import test from "node:test";

import {
  installMockBrowserApi,
  installReplayBrowserApi
} from "../assets/js/core/publicApi.js";


test(
  "replay browser API validates and stores the historical pipeline",
  () => {

    const target = {};
    let pipeline =
      null;

    const api =
      installReplayBrowserApi(
        {
          target,
          rerunReplay() {},
          navigateTo() {},
          renderCurrentView() {},
          getHistoricalAutoPipeline:
            () =>
              pipeline,
          setHistoricalAutoPipeline:
            value => {

              pipeline =
                value;

            }
        }
      );

    assert.equal(
      target.stockDaybydayReplay,
      api
    );

    assert.throws(
      () =>
        api.configureHistoricalAutoPipeline(
          {}
        ),
      /must expose run/
    );

    const configured = {
      run() {}
    };

    assert.equal(
      api.configureHistoricalAutoPipeline(
        configured
      ),
      true
    );

    assert.equal(
      api.hasHistoricalAutoPipeline(),
      true
    );

    assert.ok(
      Object.isFrozen(
        api
      )
    );

  }
);


test(
  "mock browser API delegates controls to its provider",
  async () => {

    const calls = [];
    const provider = {
      pushQuote:
        quote =>
          calls.push(
            [
              "push",
              quote
            ]
          ),
      play:
        (
          quotes,
          options
        ) => {

          calls.push(
            [
              "play",
              quotes,
              options
            ]
          );

          return Promise.resolve(
            "played"
          );

        },
      start:
        () =>
          calls.push(
            [
              "start"
            ]
          ),
      stop:
        () =>
          calls.push(
            [
              "stop"
            ]
          )
    };
    let resetCount =
      0;

    const api =
      installMockBrowserApi(
        {
          target:
            {},
          provider,
          reset() {
            resetCount +=
              1;
          }
        }
      );

    api.push(
      {
        code:
          "2330"
      }
    );

    assert.equal(
      await api.play(
        [],
        250
      ),
      "played"
    );

    api.start();
    api.stop();
    api.reset();

    assert.deepEqual(
      calls,
      [
        [
          "push",
          {
            code:
              "2330"
          }
        ],
        [
          "play",
          [],
          {
            intervalMs:
              250
          }
        ],
        [
          "start"
        ],
        [
          "stop"
        ]
      ]
    );

    assert.equal(
      resetCount,
      1
    );

  }
);
