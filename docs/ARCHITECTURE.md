# 專案架構

這個專案採用瀏覽器原生 ES Modules。正式策略規則只放在 Strategy、Live 與 Replay domain；Panel 與 App 只負責呈現和協調，不能各自複製交易規則。

## 執行流程

```text
官方盤後資料
  → scripts/update_stock_data.py
  → eligibility / industry enrichment
  → scripts/validate_stock_data.py
  → stocks.json
  → Candidate Selector
  → Live Provider 或 Historical Provider
  → 共用 Signal / Structure / Risk
  → Replay / Live State
  → Panels
```

## 目錄責任

| 路徑 | 責任 |
| --- | --- |
| `assets/js/core` | 全域設定、狀態與路由 |
| `assets/js/data` | `stocks.json` 載入與資料正規化 |
| `assets/js/strategy` | 候選、盤中結構、價格、成本與風險的純規則 |
| `assets/js/live` | 即時 Quote、防 stale／out-of-order 與 Live 狀態機 |
| `assets/js/replay` | 歷史 Provider、Dataset contract、逐根 Replay 與績效 |
| `assets/js/panels` | 畫面 HTML 與互動事件；不放策略判斷 |
| `assets/js/ui` | 跨 Panel 共用的視覺元件 |
| `assets/js/utils` | 無領域狀態的格式與日期／價格工具 |
| `scripts` | 官方資料抓取、增補與發布前驗證 |
| `tests` | Node 策略／Replay 測試與 Python 資料測試 |
| `.github/workflows` | 只保留必須在雲端執行的資料更新排程 |

## 邊界原則

1. Live 與 Replay 只能更換 Provider，不可各寫一套 Signal 規則。
2. Panel 不得自行推導 Candidate、Entry、Stop、TP、Risk 或 P&L。
3. REAL 歷史資料一律 fail closed；缺日期、母體或 5 分 K 都不能降級成 Sample。
4. 所有盤中結構最短為已完成 5 分 K，且不能讀取當下時間之後的 K 棒。
5. 公開前端不保存 Shioaji Secret；正式憑證與持久快取屬於受信任後端。

## 修改入口

- 調整候選規則：`assets/js/strategy/candidateRules.js`
- 調整盤中結構：`assets/js/strategy/intradayStructure.js`
- 調整狀態轉移：`assets/js/live/signalEngine.js`
- 調整風險與張數：`assets/js/strategy/riskEngine.js`
- 調整交易成本：`assets/js/strategy/tradingCosts.js`
- 新增歷史來源：實作 `assets/js/replay` 內的 Provider contract
- 新增即時來源：繼承 `assets/js/live/liveDataProvider.js`

完成修改後執行 `npm test`。資料腳本異動時另外執行 `npm run data:validate`。
