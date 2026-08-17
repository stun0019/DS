import assert from "node:assert/strict";
import test from "node:test";

import {
  renderReplayDailyBarChart,
  renderReplayLineChart
} from "../assets/js/panels/replayCharts.js";


test(
  "replay line chart renders cumulative values without DOM globals",
  () => {

    const html =
      renderReplayLineChart(
        [
          100,
          -40,
          20
        ],
        {
          title:
            "Equity Curve"
        }
      );

    assert.match(
      html,
      /Equity Curve/
    );

    assert.match(
      html,
      /NT\$80/
    );

    assert.match(
      html,
      /polyline/
    );

  }
);


test(
  "daily chart escapes imported labels",
  () => {

    const html =
      renderReplayDailyBarChart(
        [
          {
            date:
              '2026-08-14"><script>',
            totalPnl:
              100
          }
        ]
      );

    assert.doesNotMatch(
      html,
      /<script>/
    );

    assert.match(
      html,
      /&lt;script&gt;/
    );

  }
);
