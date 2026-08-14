export const DATA_URL =
  "./stocks.json";


export const STRATEGY = {

  candidateLimit: 10,

  liquidityPoolSize: 120,

  minimumAmplitude: 2,

  longClosePosition: 0.65,

  shortClosePosition: 0.35,

  stopRangeRatio: 0.35,

  weights: {

    liquidity: 25,

    change: 20,

    body: 15,

    closePosition: 25,

    amplitude: 15

  }

};


export const VIEW_CONFIG = {

  long: {

    name:
      "做多候選池",

    description:
      "強勢、流動性與收盤位置綜合評分",

    chip:
      "LONG",

    chipClass:
      "long"

  },


  short: {

    name:
      "做空候選池",

    description:
      "弱勢、流動性與收盤位置綜合評分",

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
      "多空篩選、評分與隔日價位計算方式",

    chip:
      "RULES",

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
