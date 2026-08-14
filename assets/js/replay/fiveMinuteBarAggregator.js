const TAIPEI_DATE_TIME_FORMATTER =
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
        "2-digit",
      hour:
        "2-digit",
      minute:
        "2-digit",
      hourCycle:
        "h23"
    }
  );


function reject(
  code,
  message
) {

  const error =
    new Error(
      `[${code}] ${message}`
    );

  error.code =
    code;

  throw error;

}


function taipeiParts(
  timestamp
) {

  const date =
    new Date(
      timestamp
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    reject(
      "INVALID_INTRADAY_TIMESTAMP",
      `Invalid intraday timestamp ${timestamp}`
    );

  }


  const parts =
    Object.fromEntries(
      TAIPEI_DATE_TIME_FORMATTER
      .formatToParts(
        date
      )
      .map(
        part => [
          part.type,
          part.value
        ]
      )
    );


  return {
    date:
      `${parts.year}-${parts.month}-${parts.day}`,
    hour:
      Number(
        parts.hour
      ),
    minute:
      Number(
        parts.minute
      )
  };

}


function finiteNumber(
  value,
  label
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    reject(
      "INVALID_INTRADAY_OHLCV",
      `${label} must be finite`
    );

  }


  return number;

}


export function aggregateOneMinuteBarsToFiveMinutes(
  bars,
  {
    expectedDate =
      null
  } =
    {}
) {

  if (
    !Array.isArray(
      bars
    )
  ) {

    reject(
      "INVALID_ONE_MINUTE_BARS",
      "1m bars must be an array"
    );

  }


  const groups =
    new Map();


  bars.forEach(
    bar => {

      const code =
        String(
          bar?.code
          ??
          ""
        )
        .trim();

      const parts =
        taipeiParts(
          bar?.timestamp
        );


      if (
        !code
        ||
        (
          expectedDate
          &&
          parts.date !==
            expectedDate
        )
      ) {

        reject(
          "INTRADAY_DATE_MISMATCH",
          `${code || "unknown"} bar is outside ${expectedDate || "the expected date"}`
        );

      }


      const bucketMinute =
        Math.floor(
          parts.minute
          /
          5
        )
        *
        5;

      const bucketTimestamp =
        `${parts.date}T${String(parts.hour).padStart(2, "0")}:${String(bucketMinute).padStart(2, "0")}:00+08:00`;

      const key =
        `${code}:${bucketTimestamp}`;


      if (
        !groups.has(
          key
        )
      ) {

        groups.set(
          key,
          {
            code,
            bucketTimestamp,
            bucketMinute,
            bars: []
          }
        );

      }


      groups.get(
        key
      ).bars.push(
        {
          ...bar,
          localMinute:
            parts.minute,
          open:
            finiteNumber(
              bar.open,
              "open"
            ),
          high:
            finiteNumber(
              bar.high,
              "high"
            ),
          low:
            finiteNumber(
              bar.low,
              "low"
            ),
          close:
            finiteNumber(
              bar.close,
              "close"
            ),
          volume:
            finiteNumber(
              bar.volume,
              "volume"
            )
        }
      );

    }
  );


  return [...groups.values()]
  .sort(
    (
      first,
      second
    ) =>
      first.bucketTimestamp.localeCompare(
        second.bucketTimestamp
      )
      ||
      first.code.localeCompare(
        second.code
      )
  )
  .map(
    group => {

      const sorted =
        group.bars.sort(
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

      const expectedMinutes =
        Array.from(
          {
            length: 5
          },
          (
            _,
            index
          ) =>
            group.bucketMinute
            +
            index
        );

      const actualMinutes =
        sorted.map(
          bar =>
            bar.localMinute
        );

      const complete =
        sorted.length ===
          5
        &&
        new Set(
          actualMinutes
        ).size ===
          5
        &&
        actualMinutes.every(
          (
            minute,
            index
          ) =>
            minute ===
              expectedMinutes[index]
        )
        &&
        sorted.every(
          bar =>
            Number(
              bar.timeframeMinutes
              ??
              1
            ) ===
              1
            &&
            bar.isComplete ===
              true
        );

      const first =
        sorted[0];

      const last =
        sorted[
          sorted.length - 1
        ];


      return {
        code:
          group.code,
        timestamp:
          group.bucketTimestamp,
        timeframeMinutes: 5,
        isComplete:
          complete,
        open:
          first?.open
          ??
          null,
        high:
          sorted.length

            ? Math.max(
                ...sorted.map(
                  bar =>
                    bar.high
                )
              )

            : null,
        low:
          sorted.length

            ? Math.min(
                ...sorted.map(
                  bar =>
                    bar.low
                )
              )

            : null,
        close:
          last?.close
          ??
          null,
        volume:
          sorted.reduce(
            (
              total,
              bar
            ) =>
              total
              +
              bar.volume,
            0
          ),
        sourceBarCount:
          sorted.length
      };

    }
  );

}


export class FiveMinuteBarAggregator {

  aggregate(
    bars,
    options
  ) {

    return aggregateOneMinuteBarsToFiveMinutes(
      bars,
      options
    );

  }

}
