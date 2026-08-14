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

## 本機執行

此專案使用瀏覽器原生 ES Modules，請透過 HTTP server 開啟：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

瀏覽 `http://127.0.0.1:8765/`。

## 測試

```powershell
npm test
```

目前測試涵蓋台股 Tick 邊界、交易資格、多空候選、不可倒退的訊號狀態、5 分 K 結構與方向確認、無未來資料、決定性 Replay、績效加總、28 折月退成本與風險張數。

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

從側邊選單進入「Replay 回測」後可載入 JSON，或在瀏覽器 Console 呼叫 `stockDaybydayReplay.run(dataset, options)`。資料結構：

```js
{
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

Replay 會驗證 K 棒時間嚴格遞增且間隔不少於 5 分鐘，每一步只送入當前 K 棒；`previousTradingDate` 對應的快照必須早於回測日。出場目標可選 TP1 或 TP2；若同一根 K 同時碰到 Stop 與目標，採保守原則先判定 Stop。

## 重要限制

- 官方「可先賣」資格不等同券商當下保證有券；實際券源仍需由券商 API 確認。
- TPEx SSL fallback 僅限憑證驗證失敗，並辨識 `CERTIFICATE_VERIFY_FAILED` 與 `Missing Subject Key Identifier`；啟用時會輸出安全警告。
- 單筆風險上限預設不設定，使用者可在頁面輸入；`maxLots` 採月退前 `cashRiskPerLot` 保守計算。若結果為 0，UI 顯示「風險超標」；即使後續 `maxLots >= 1`，仍需新的 Direction Confirmation 才能 Entry Ready。未設定上限時不套用張數阻擋，但方向確認仍為必要條件。
- 交易成本依使用者提供的月退比例連續估算，未套用逐筆最低手續費與券商個別取整方式，實際金額以對帳單為準。
- 現股當沖 0.15% 優惠稅率目前施行至 2027-12-31，屆期前需重新確認法規並更新設定。
- 候選分數是規則排序，不代表預期報酬。正式使用前仍需完成含手續費、交易稅與滑價的歷史回測。
