# 資料工具

資料更新已從 GitHub Actions YAML 抽離。相同 Python 程式可在本機執行，也由雲端排程呼叫。

| 指令 | 用途 |
| --- | --- |
| `npm run data:update` | 抓取官方資料、補齊產業與當沖資格，最後驗證 |
| `npm run data:validate` | 只驗證現有 `stocks.json`，不連線也不覆寫 |
| `python scripts/update_stock_data.py` | 只建立同步盤後快照 |
| `python scripts/enrich_tpex_industry.py` | 補齊 TPEx 產業 |
| `python scripts/enrich_day_trade_eligibility.py` | 補齊當沖與先賣暫停資格 |

`update_stock_data.py` 在市場日期不一致、資料量異常或來源失敗時不會覆寫既有檔案。`validate_stock_data.py` 是發布前的最後一道 contract 檢查。

GitHub Actions 只保留 `.github/workflows/update-stock-data.yml`，負責在電腦關機時仍能更新公開網站資料；一般測試改由本機 `npm test` 執行。
