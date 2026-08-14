const CACHE_KEY_FIELDS = [
  "date",
  "market",
  "code",
  "timeframe",
  "source",
  "volumeMode"
];


export function createHistoricalCacheKey(
  parts
) {

  return CACHE_KEY_FIELDS
  .map(
    field =>
      `${field}=${encodeURIComponent(String(parts?.[field] ?? ""))}`
  )
  .join(
    "&"
  );

}


export class HistoricalCacheProvider {

  async get() {

    return null;

  }


  async set() {

    throw new Error(
      "HistoricalCacheProvider.set() is not implemented"
    );

  }

}


function clone(
  value
) {

  return value ===
    undefined

    ? undefined

    : JSON.parse(
        JSON.stringify(
          value
        )
      );

}


export class InMemoryHistoricalCache
extends HistoricalCacheProvider {

  constructor() {

    super();

    this.values =
      new Map();

  }


  async get(
    parts
  ) {

    return clone(
      this.values.get(
        createHistoricalCacheKey(
          parts
        )
      )
    );

  }


  async set(
    parts,
    value
  ) {

    this.values.set(
      createHistoricalCacheKey(
        parts
      ),
      clone(
        value
      )
    );


    return value;

  }


  clear() {

    this.values.clear();

  }

}


export class NullHistoricalCache
extends HistoricalCacheProvider {

  async set(
    _parts,
    value
  ) {

    return value;

  }

}
