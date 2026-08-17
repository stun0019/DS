# 台股隔日當沖候選系統

以 TWSE／TPEx 官方盤後資料建立隔日做多、做空候選池，並預留永豐 Shioaji 即時行情介面。

目前正式用途是「盤前候選與觀察價」，即時行情仍為 Mock。系統不會在沒有盤中結構時預先產生 Entry、Stop 或 TP。

## 資料流程

1. GitHub Actions 抓取上市、上櫃官方日行情並驗證交易日期與成交量公式。
2. `scripts/enrich_tpex_industry.py` 補齊 TPEx 官方產業分類。
3. `scripts/enrich_day_trade_eligibility.py` 增補官方現股當沖資格，並用 TWSE TWTBAU1、TPEx `tpex_intraday_trading_pre` 覆蓋當日暫停先賣後買標記。
4. 前端載入 `stocks.json`，只讓合格標的進入多空候選池。
5. Live／Replay Provider 逐根送入已完成 5 分 K；突破後只使用突破時間之後的新 Pullback 與 Swing Low／High，並等待 Direction Confirmation。
6. Direction Confirmation 通過後才執行 Risk Check；有設定風險上限且 `maxLots = 0` 時進入可恢復的 `RISK_BLOCKED`，風險降低後仍須重新確認方向，禁止把「靠近 Stop」當成進場訊號。
7. Replay／Backtest 共用正式 Signal、Structure、Risk 與交易成本邏輯，逐根計算 Entry、Exit、P&L、R、每日／區間與標的績效。

完整模組責任與修改入口請參考 [專案架構](docs/ARCHITECTURE.md)；官方資料工具請參考 [資料工具說明](scripts/README.md)。

Live 啟動前會以 `stocks.json` 的官方 Trading Calendar 算出 `expectedPreviousTradingDate`；只有 `tradeDateISO` 完全等於最近一個實際交易日，且 `syncStatus`、`validForTradingDate` 與上市／上櫃日期同步時才會通過。週末、官方休市與特殊交易日都由日曆 contract 處理，不得用日曆日減一、`updatedAt` 或僅比較日期大小推算；年份缺漏、格式異常或無法確認時一律進入 `DATA_STALE`。

## 本機執行

此專案使用瀏覽器原生 ES Modules，請透過 HTTP server 開啟：

```powershell
npm run serve
```

瀏覽 `http://127.0.0.1:8765/`。

## 測試

```powershell
npm test
```

`npm test` 會依序執行 Node 與 Python 測試。目前涵蓋台股 Tick 邊界、交易資格、多空候選、不可倒退的訊號狀態、5 分 K 結構與方向確認、無未來資料、決定性 Replay、績效加總、28 折月退成本與風險張數。

## 即時行情介面

Shioaji Adapter 日後只需繼承 `LiveDataProvider`，並送入下列格式：

```js
{
  code: "2327",
  timestamp: "2026-08-14T01:05:00.000Z",
  open: 665,
  high: 671,
  low: 661,
  last: 669,
  volume: 12345,
  bid: 668,
  ask: 669,
  candleTimeframeMinutes: 5,
  candles: [
    { timestamp, timeframeMinutes: 5, open, high, low, close, volume, isComplete: true }
  ],
  invalidated: false
}
```

`candles` 最短只能使用 5 分 K，必須提供可解析的 `timestamp`、`timeframeMinutes: 5`，且已收線 K 要明確標記 `isComplete: true`。1 分 K、形成中 K、完成狀態未知或無法證明晚於突破時間的 K，都不能參與 Pullback、Swing、Direction Confirmation、Entry 或 Stop。

每筆 Quote 必須提供可解析的 `timestamp`，缺少或無效時會直接忽略且不以本機現在時間代填。系統會保存同交易日最後處理時間；較舊交易日或同交易日內較舊的 Quote 會完整忽略，不更新行情、狀態、K 棒、Entry、Stop、Risk Plan 或交易日。只有 Quote 的交易日嚴格晚於目前狀態時，才會重設並開始新交易日。

`invalidated: true` 代表今日劇本失效，會成為同交易日 terminal state 並清除可執行風控計畫；只有手動 reset 或下一交易日的行情能解除。行情斷線、逾時、訂閱名單與 API 金鑰應由後端服務處理，不要把永豐憑證放進前端或 GitHub 儲存庫。

## Replay／Backtest 資料

從側邊選單進入「Replay 回測」後，主要操作是選日期、風險、滑價與 TP1／TP2，再啟動 Auto Historical Backtest；JSON／CSV 保留為 Advanced／Offline Import，也可在瀏覽器 Console 呼叫 `stockDaybydayReplay.run(dataset, options)`。Replay Dataset 統一由 `Historical5mProvider` 轉換，引擎本身不綁定資料來源。資料結構：

```js
{
  metadata: {
    sourceType: "REAL_HISTORICAL_DATA",
    adapter: "JSON_IMPORT",
    volumeMode: "BROKER_COMPARABLE_V4",
    universeMode: "TWSE_TPEX_COMPANY_EQUITY_ONLY",
    universeValidated: true,
    universeStockCount: 1700,
    twseStockCount: 1000,
    tpexStockCount: 700
  },
  dailySnapshots: [
    { date: "2026-08-13", stocks: [/* 當日盤後股票資料 */] }
  ],
  sessions: [
    {
      date: "2026-08-14",
      previousTradingDate: "2026-08-13",
      barsByCode: {
        "2330": [
          {
            code: "2330",
            timestamp: "2026-08-14T09:00:00+08:00",
            timeframeMinutes: 5,
            isComplete: true,
            open: 1050,
            high: 1055,
            low: 1048,
            close: 1053,
            volume: 1200
          }
        ]
      }
    }
  ]
}
```

`HistoricalDatasetBuilder` 會先把匯入資料組成上述 contract，並逐日使用 `previousTradingDate` 的 Snapshot 呼叫正式 Candidate Selector。成功輸出會附帶 `candidateAudits`、`validationLogs` 與 `metadata.historicalStats`；Audit 包含代號、名稱、方向、Strategy Score、Liquidity Rank、Observation、昨日 High／Low。若資料附有正式 Trading Calendar，Builder 也會核對真正的上一交易日。

### Historical Universe 與自動回測

REAL Historical Snapshot 必須先由 `HistoricalUniverseBuilder` 對每個 D-1 執行「TWSE 官方歷史行情 ∩ 當日 TWSE 公司白名單」與「TPEx 官方歷史行情 ∩ 當日 TPEx 公司白名單」。ETF、ETN、權證、基金、債券及其他非公司股票在 Candidate Selector 前排除；兩個市場任一白名單無法驗證、日期不一致或母體計數不符時，資料不得宣告 `universeValidated: true`，正式 Dataset 會 fail closed。

自動流程固定為：`HistoricalDailyCollector → HistoricalUniverseBuilder → HistoricalEligibilityProvider → 共用 Candidate Selector → HistoricalIntradayProvider → FiveMinuteBarAggregator → HistoricalDatasetBuilder → 既有 Replay Engine`。每個 Session D 都透過既有 Trading Calendar 取得真正的 previous trading date，不能以 calendar day - 1 代替；Daily／Universe／Eligibility 都必須是該 D-1 的歷史狀態，禁止以今天的狀態倒灌過去。

Intraday 只向 Provider 要求每日 Long Top10 與 Short Top10，絕不抓全市場。Provider 若回傳 1m，獨立 Aggregator 只把五根連續、已完成的一分鐘 K 聚合成 completed 5m；不完整區間會在進 Replay 前被拒絕。Cache 是可替換 Provider abstraction，key 包含 date、market、code、timeframe、source、volumeMode；目前前端只提供記憶體／Null 實作，不把 server-side cache 寫入 GitHub Pages。

`ShioajiHistoricalAdapter` 目前只有 server-side `requestKbars` 邊界，不含 API Key、Secret 或登入資料。正式自動模式可透過 `stockDaybydayReplay.configureHistoricalAutoPipeline(pipeline)` 注入已在受信任後端設定好的 Daily／Eligibility／Intraday Provider；未設定時 UI 會顯示 `AUTO_PROVIDER_NOT_CONFIGURED`，不會以 Sample／Mock 取代真實歷史績效。

Replay 頁面現在使用集中式控制列、資料準備進度、8 項核心 KPI、原生 SVG／CSS Equity、Cumulative R 與 Daily P&L 圖，以及 Overview／Candidates／Trades／Daily／Weekly Monthly／Logs 分頁。Candidates 與 Trades 使用篩選和分頁，Logs 預設只載入最近 100 筆，避免大型 Dataset 一次渲染全部資料。Dashboard 首頁則提供資料新鮮度、市場數量及 Long／Short 候選摘要；Desktop 使用固定側欄，Tablet／Mobile 使用可收合 Drawer。

REAL Snapshot 的每檔股票必須包含 `Code`、完整 OHLC、`Change`、布林型態的 `DayTradeEligible`／`SellFirstDayTradeAllowed`，以及至少一個受支援成交量欄位：`BrokerComparableVolume`、`AdjustedTradeVolume`、`RegularTradeVolume`、`NonOddLotTradeVolume`、`TradeVolume`。缺欄、空陣列、非有限數字、負成交量或不合理 OHLC 一律拒絕，不會用 0 補值。成交量 fallback 維持上述順序；匯入未宣告 `volumeMode` 時會明確標為 `VOLUME_MODE_UNDECLARED`，不推測或重算。

Liquidity Rank 固定依 `Volume DESC → Code ASC`；Candidate 固定依 `Strategy Score DESC → Liquidity Rank ASC → Code ASC`。因此 JSON／CSV 股票列順序不會改變 Long／Short Top10 或 Candidate Audit。驗證成功的 metadata 會標記 `validationStatus: "VALIDATED"`、`snapshotSchemaValidated: true` 與 `candidateSelectionDeterministic: true`，Replay UI 同時顯示來源、驗證狀態、成交量模式與資料筆數摘要。

Builder 會拒絕缺少 Snapshot／5m、同日或未來 Snapshot、未來 Candle、代號不一致、日期倒退、重複或亂序 K、低於 5 分鐘及未完成 K。只有所有 Session 驗證通過後才會交給既有 `runBacktest`；Replay 每一步仍只送入當前 K 棒。出場目標可選 TP1 或 TP2；若同一根 K 同時碰到 Stop 與目標，採保守原則先判定 Stop。滑價可選 0、1、2 Tick，買賣成交價一律透過台股 Tick Engine 往不利方向調整。Structural Stop 不變，但 Position Sizing 會以 Filled Entry、Expected Filled Stop 與交易成本重新計算；若滑價後可交易張數為 0，只記錄 `ENTRY_REJECTED_RISK`，不建立交易。P&L、R 與所有績效都使用 Filled Price 與 Actual Shares。

JSON 只有在 `metadata.sourceType` 明確填入 `REAL_HISTORICAL_DATA` 時才顯示 REAL；未標記資料一律顯示 `SAMPLE / MOCK`。CSV 可沿用每列同時包含 Snapshot 與 Bar 的 `COMBINED` 格式，也可用 `recordType=SNAPSHOT` 與 `recordType=BAR` 分開提供完整盤後股票母體及候選 5m。每一列都必須明確且一致宣告 `REAL_HISTORICAL_DATA` 才能顯示 REAL，空白與 REAL 混合會拒絕匯入。`sourceType` 只是匯入資料的來源宣告，不代表系統已向行情供應商驗證真實性。

## 重要限制

- 官方「可先賣」資格不等同券商當下保證有券；實際券源仍需由券商 API 確認。
- 專案目前未附正式歷史公司白名單、歷史當沖資格服務或 Shioaji 憑證；因此 Auto Historical Backtest 已完成管線與 UI，但在部署端注入可驗證 Provider 前會拒絕執行，JSON／CSV 仍是可用的離線管道。
- 公開靜態前端不保存 Secret，也不提供永久伺服器快取；正式 Shioaji 與持久 Cache 必須放在本機／受信任後端。
- TPEx SSL fallback 僅限憑證驗證失敗，並辨識 `CERTIFICATE_VERIFY_FAILED` 與 `Missing Subject Key Identifier`；啟用時會輸出安全警告。
- 單筆風險上限預設不設定，使用者可在頁面輸入；`maxLots` 採月退前 `cashRiskPerLot` 保守計算。若結果為 0，UI 顯示「風險超標」；即使後續 `maxLots >= 1`，仍需新的 Direction Confirmation 才能 Entry Ready。未設定上限時不套用張數阻擋，但方向確認仍為必要條件。
- 交易成本依使用者提供的月退比例連續估算，未套用逐筆最低手續費與券商個別取整方式，實際金額以對帳單為準。
- 現股當沖 0.15% 優惠稅率目前施行至 2027-12-31，屆期前需重新確認法規並更新設定。
- 候選分數是規則排序，不代表預期報酬。正式使用前仍需完成含手續費、交易稅與滑價的歷史回測。
