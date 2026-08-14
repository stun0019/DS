import {
  buildHistoricalReplayDataset
} from "./historicalDatasetBuilder.js";


export const HISTORICAL_SOURCE_TYPE = {
  SAMPLE_MOCK:
    "SAMPLE_MOCK",
  REAL_HISTORICAL_DATA:
    "REAL_HISTORICAL_DATA"
};


export function getHistoricalSourceLabel(
  sourceType
) {

  return sourceType ===
    HISTORICAL_SOURCE_TYPE.REAL_HISTORICAL_DATA

    ? "REAL HISTORICAL DATA"

    : "SAMPLE / MOCK";

}


function normalizeSourceType(
  value,
  fallbackSourceType
) {

  const sourceType =
    value
    ||
    fallbackSourceType;


  if (
    !Object.values(
      HISTORICAL_SOURCE_TYPE
    ).includes(
      sourceType
    )
  ) {

    throw new Error(
      `不支援的 Historical Source Type：${sourceType}`
    );

  }


  return sourceType;

}


export function normalizeReplayDataset(
  dataset,
  {
    fallbackSourceType =
      HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK,
    adapter =
      "JSON_IMPORT"
  } = {}
) {

  if (
    !dataset
    ||
    typeof dataset !==
      "object"
    ||
    !Array.isArray(
      dataset.dailySnapshots
    )
    ||
    !Array.isArray(
      dataset.sessions
    )
  ) {

    throw new Error(
      "Historical 5m 資料必須包含 dailySnapshots 與 sessions"
    );

  }


  const sourceType =
    normalizeSourceType(
      dataset.metadata?.sourceType,
      fallbackSourceType
    );


  return buildHistoricalReplayDataset(
    {
    ...dataset,
    metadata: {
      ...(
        dataset.metadata
        ??
        {}
      ),
      sourceType,
      sourceLabel:
        getHistoricalSourceLabel(
          sourceType
        ),
      adapter
    }
    }
  );

}


function parseCsvRows(
  text
) {

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;


  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {

    const character =
      text[index];


    if (
      quoted
    ) {

      if (
        character ===
          '"'
        &&
        text[index + 1] ===
          '"'
      ) {

        field +=
          '"';

        index +=
          1;

      }

      else if (
        character ===
          '"'
      ) {

        quoted =
          false;

      }

      else {

        field +=
          character;

      }

    }

    else if (
      character ===
        '"'
    ) {

      quoted =
        true;

    }

    else if (
      character ===
        ","
    ) {

      row.push(
        field
      );

      field = "";

    }

    else if (
      character ===
        "\n"
    ) {

      row.push(
        field.replace(
          /\r$/,
          ""
        )
      );


      if (
        row.some(
          value =>
            value !==
              ""
        )
      ) {

        rows.push(
          row
        );

      }


      row = [];
      field = "";

    }

    else {

      field +=
        character;

    }

  }


  row.push(
    field.replace(
      /\r$/,
      ""
    )
  );


  if (
    row.some(
      value =>
        value !==
          ""
    )
  ) {

    rows.push(
      row
    );

  }


  return rows;

}


function csvObjects(
  text
) {

  const rows =
    parseCsvRows(
      String(
        text
        ??
        ""
      )
    );


  if (
    rows.length < 2
  ) {

    throw new Error(
      "Historical 5m CSV 沒有資料列"
    );

  }


  const headers =
    rows[0].map(
      header =>
        header
        .replace(
          /^\uFEFF/,
          ""
        )
        .trim()
        .toLowerCase()
    );


  return rows.slice(
    1
  )
  .map(
    values =>
      Object.fromEntries(
        headers.map(
          (
            header,
            index
          ) => [
            header,
            values[index]?.trim()
            ??
            ""
          ]
        )
      )
  );

}


function csvValue(
  row,
  ...names
) {

  for (
    const name
    of names
  ) {

    const value =
      row[
        name.toLowerCase()
      ];


    if (
      value !==
        undefined
      &&
      value !==
        ""
    ) {

      return value;

    }

  }


  return "";

}


function csvNumber(
  row,
  ...names
) {

  return Number(
    csvValue(
      row,
      ...names
    )
  );

}


function csvBoolean(
  row,
  ...names
) {

  return [
    "true",
    "1",
    "yes"
  ].includes(
    csvValue(
      row,
      ...names
    ).toLowerCase()
  );

}


function stockFromCsvRow(
  row,
  code
) {

  return {
    Code:
      code,
    Name:
      csvValue(
        row,
        "name"
      ),
    Market:
      csvValue(
        row,
        "market"
      ),
    OpeningPrice:
      csvNumber(
        row,
        "openingPrice"
      ),
    HighestPrice:
      csvNumber(
        row,
        "highestPrice"
      ),
    LowestPrice:
      csvNumber(
        row,
        "lowestPrice"
      ),
    ClosingPrice:
      csvNumber(
        row,
        "closingPrice"
      ),
    Change:
      csvNumber(
        row,
        "change"
      ),
    TradeVolume:
      csvNumber(
        row,
        "tradeVolume"
      ),
    DayTradeEligible:
      csvBoolean(
        row,
        "dayTradeEligible"
      ),
    SellFirstDayTradeAllowed:
      csvBoolean(
        row,
        "sellFirstDayTradeAllowed"
      )
  };

}


function barFromCsvRow(
  row,
  code,
  timestamp
) {

  return {
    code,
    timestamp,
    timeframeMinutes:
      csvNumber(
        row,
        "timeframeMinutes"
      ),
    isComplete:
      csvBoolean(
        row,
        "isComplete"
      ),
    open:
      csvNumber(
        row,
        "open"
      ),
    high:
      csvNumber(
        row,
        "high"
      ),
    low:
      csvNumber(
        row,
        "low"
      ),
    close:
      csvNumber(
        row,
        "close"
      ),
    volume:
      csvNumber(
        row,
        "volume"
      )
  };

}


export function parseHistorical5mCsv(
  text
) {

  const rows =
    csvObjects(
      text
    );


  const declaredSourceTypes =
    new Set(
      rows.map(
        row =>
          csvValue(
            row,
            "sourceType"
          )
          ||
          HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK
      )
    );


  if (
    declaredSourceTypes.size > 1
  ) {

    throw new Error(
      "Historical 5m CSV 的來源標記不一致"
    );

  }


  const snapshots =
    new Map();

  const sessions =
    new Map();


  rows.forEach(
    (
      row,
      index
    ) => {

      const recordType =
        (
          csvValue(
            row,
            "recordType"
          )
          ||
          "COMBINED"
        )
        .toUpperCase();

      const includesSnapshot =
        recordType ===
          "SNAPSHOT"
        ||
        recordType ===
          "COMBINED";

      const includesBar =
        recordType ===
          "BAR"
        ||
        recordType ===
          "COMBINED";


      if (
        !includesSnapshot
        &&
        !includesBar
      ) {

        throw new Error(
          `Historical CSV 第 ${index + 2} 列 recordType 必須為 SNAPSHOT、BAR 或 COMBINED`
        );

      }


      const sessionDate =
        csvValue(
          row,
          "sessionDate"
        );

      const previousTradingDate =
        csvValue(
          row,
          "previousTradingDate"
        );

      const snapshotDate =
        csvValue(
          row,
          "snapshotDate"
        )
        ||
        previousTradingDate;

      const code =
        csvValue(
          row,
          "code"
        );

      const timestamp =
        csvValue(
          row,
          "timestamp"
        );


      if (
        !code
        ||
        (
          includesSnapshot
          &&
          !snapshotDate
        )
        ||
        (
          includesBar
          &&
          (
            !sessionDate
            ||
            !previousTradingDate
            ||
            !timestamp
          )
        )
      ) {

        throw new Error(
          `Historical 5m CSV 第 ${index + 2} 列缺少日期、股票代碼或 timestamp`
        );

      }


      if (
        includesSnapshot
      ) {

        if (
          !snapshots.has(
            snapshotDate
          )
        ) {

          snapshots.set(
            snapshotDate,
            new Map()
          );


        }


        const snapshotStock =
          stockFromCsvRow(
            row,
            code
          );

        const existingStock =
          snapshots.get(
            snapshotDate
          ).get(
            code
          );


        if (
          existingStock
          &&
          JSON.stringify(
            existingStock
          ) !==
            JSON.stringify(
              snapshotStock
            )
        ) {

          throw new Error(
            `${snapshotDate} Snapshot ${code} 的盤後資料不一致`
          );

        }


        snapshots.get(
          snapshotDate
        ).set(
          code,
          snapshotStock
        );

      }


      if (
        !includesBar
      ) {

        return;

      }


      if (
        !sessions.has(
          sessionDate
        )
      ) {

        sessions.set(
          sessionDate,
          {
            date:
              sessionDate,
            previousTradingDate,
            barsByCode: {}
          }
        );

      }


      const session =
        sessions.get(
          sessionDate
        );


      if (
        session.previousTradingDate !==
          previousTradingDate
      ) {

        throw new Error(
          `${sessionDate} 的 previousTradingDate 不一致`
        );

      }


      if (
        !session.barsByCode[
          code
        ]
      ) {

        session.barsByCode[
          code
        ] = [];

      }


      session.barsByCode[
        code
      ].push(
        barFromCsvRow(
          row,
          code,
          timestamp
        )
      );

    }
  );


  const sourceType =
    [...declaredSourceTypes][0]
    ||
    HISTORICAL_SOURCE_TYPE.SAMPLE_MOCK;


  return normalizeReplayDataset(
    {
      metadata: {
        sourceType
      },
      dailySnapshots:
        [...snapshots.entries()]
        .map(
          ([
            date,
            stocks
          ]) => ({
            date,
            stocks:
              [...stocks.values()]
          })
        ),
      sessions:
        [...sessions.values()]
    },
    {
      adapter:
        "CSV_IMPORT"
    }
  );

}


export class Historical5mProvider {

  toReplayDataset() {

    throw new Error(
      "Historical5mProvider 尚未實作"
    );

  }

}


export class JsonHistorical5mProvider
extends Historical5mProvider {

  toReplayDataset(
    input
  ) {

    const dataset =
      typeof input ===
        "string"

        ? JSON.parse(
            input
          )

        : input;


    return normalizeReplayDataset(
      dataset,
      {
        adapter:
          "JSON_IMPORT"
      }
    );

  }

}


export class CsvHistorical5mProvider
extends Historical5mProvider {

  toReplayDataset(
    input
  ) {

    return parseHistorical5mCsv(
      input
    );

  }

}


export async function importHistorical5mFile(
  file
) {

  const name =
    String(
      file?.name
      ??
      ""
    );


  const text =
    await file.text();


  if (
    name.toLowerCase()
    .endsWith(
      ".csv"
    )
  ) {

    return new CsvHistorical5mProvider()
    .toReplayDataset(
      text
    );

  }


  return new JsonHistorical5mProvider()
  .toReplayDataset(
    text
  );

}
