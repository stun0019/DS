export const DATA_URL =
  "./stocks.json";


export const STRATEGY = {

  candidateLimit: 10,

  liquidityPoolSize: 120,

  minimumAmplitude: 2,

  longClosePosition: 0.65,

  shortClosePosition: 0.35,

  weights: {

    liquidity: 25,

    change: 20,

    body: 15,

    closePosition: 25,

    amplitude: 15

  }

};


/*
V3.0 盤中行情設定

目前先使用 mock。
之後接 Shioaji 時，
只需要更換 Live Data Provider。
*/
export const LIVE_CONFIG = {

  mode:
    "mock",

  nearTriggerTicks:
    2,

  renderThrottleMs:
    120,

  lotSize:
    1000,

  maxRiskAmount:
    null

};


/*
交易成本設定

券商於成交時先收原始手續費，
再以月退方式退回 72%，
最終等同負擔 28 折。

現股當沖證交稅 0.15% 的優惠
目前施行至 2027-12-31。
*/
export const TRADING_COST_CONFIG = {

  commissionRate:
    0.001425,

  commissionDiscountMultiplier:
    0.28,

  dayTradingTaxRate:
    0.0015,

  dayTradingTaxPreferentialThrough:
    "2027-12-31"

};


export const VIEW_CONFIG = {

  dashboard: {

    name:
      "候選儀表板",

    description:
      "台股盤後候選掃描器",

    chip:
      "MARKET",

    chipClass:
      "rules"

  },

  long: {

    name:
      "做多候選池",

    description:
      "盤前強勢候選＋隔日突破觀察價",

    chip:
      "LONG",

    chipClass:
      "long"

  },


  short: {

    name:
      "做空候選池",

    description:
      "盤前弱勢候選＋隔日跌破觀察價",

    chip:
      "SHORT",

    chipClass:
      "short"

  },


  candidate: {

    name:
      "成交量 TOP 10",

    description:
      "上市＋上櫃券商可比成交量排名",

    chip:
      "TOP 10",

    chipClass:
      "hot"

  },


  rules: {

    name:
      "候選池規則",

    description:
      "盤前候選＋盤中交易流程",

    chip:
      "RULES",

    chipClass:
      "rules"

  },


  replay: {

    name:
      "Replay 回測",

    description:
      "逐根 5 分 K 驗證狀態、交易與績效",

    chip:
      "BACKTEST",

    chipClass:
      "rules"

  },


  all: {

    name:
      "全部市場",

    description:
      "上市＋上櫃全部個股",

    chip: "",

    chipClass: ""

  },


  twse: {

    name:
      "上市股票",

    description:
      "TWSE 上市個股",

    chip: "",

    chipClass: ""

  },


  tpex: {

    name:
      "上櫃股票",

    description:
      "TPEx 上櫃個股",

    chip: "",

    chipClass: ""

  }

};


export const SORT_OPTIONS = [

  {

    value:
      "StrategyScore:desc:number",

    label:
      "候選分數｜高 → 低",

    strategyOnly:
      true

  },


  {

    value:
      "TradeVolume:desc:number",

    label:
      "成交量｜大 → 小"

  },


  {

    value:
      "TradeVolume:asc:number",

    label:
      "成交量｜小 → 大"

  },


  {

    value:
      "ChangePercent:desc:number",

    label:
      "漲跌幅｜高 → 低"

  },


  {

    value:
      "ChangePercent:asc:number",

    label:
      "漲跌幅｜低 → 高"

  },


  {

    value:
      "Amplitude:desc:number",

    label:
      "振幅｜大 → 小"

  },


  {

    value:
      "Amplitude:asc:number",

    label:
      "振幅｜小 → 大"

  },


  {

    value:
      "ClosePosition:desc:number",

    label:
      "收盤位置｜高 → 低"

  },


  {

    value:
      "ClosePosition:asc:number",

    label:
      "收盤位置｜低 → 高"

  },


  {

    value:
      "TradeValue:desc:number",

    label:
      "成交金額｜大 → 小"

  },


  {

    value:
      "Industry:asc:text",

    label:
      "產業別"

  }

];
