"""Enrich stocks.json with official TWSE/TPEx day-trading eligibility."""

from __future__ import annotations

import json
import re
import ssl
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
STOCKS_PATH = ROOT / "stocks.json"

SOURCES = {
    "TWSE": "https://openapi.twse.com.tw/v1/exchangeReport/TWTB4U",
    "TPEX": "https://www.tpex.org.tw/openapi/v1/tpex_securities",
}

CODE_KEYS = (
    "Code",
    "SecuritiesCompanyCode",
    "SecuritiesCode",
    "證券代號",
    "股票代號",
)

DATE_KEYS = (
    "Date",
    "TradeDate",
    "資料日期",
    "交易日期",
)

SUSPENSION_KEYS = (
    "Suspension",
    "SuspendSellThenBuy",
    "暫停現股賣出後現款買進當沖註記",
    "暫停先賣後買當日沖銷註記",
)


def clean_text(value: Any) -> str:
    return str(value if value is not None else "").replace("\u3000", " ").strip()


def normalize_key(value: Any) -> str:
    return re.sub(r"[\s_\-]", "", clean_text(value)).lower()


def pick_value(row: dict[str, Any], candidates: tuple[str, ...], default: Any = "") -> Any:
    for candidate in candidates:
        value = row.get(candidate)
        if value not in (None, ""):
            return value

    normalized = {normalize_key(candidate) for candidate in candidates}

    for key, value in row.items():
        if normalize_key(key) in normalized and value not in (None, ""):
            return value

    return default


def normalize_code(value: Any) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", clean_text(value))


def fetch_json(url: str) -> Any:
    last_error: Exception | None = None
    context = ssl.create_default_context()

    for attempt in range(1, 4):
        try:
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 Taiwan-Stock-Dashboard",
                    "Accept": "application/json,text/plain,*/*",
                    "Cache-Control": "no-cache",
                },
            )

            with urllib.request.urlopen(request, timeout=45, context=context) as response:
                return json.loads(response.read().decode("utf-8-sig"))

        except Exception as error:  # pragma: no cover - network error details vary
            last_error = error
            if attempt < 3:
                time.sleep(attempt * 2)

    raise RuntimeError(f"Official eligibility API failed: {url}\n{last_error}")


def unwrap_records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]

    if isinstance(payload, dict):
        for key in ("data", "Data", "result", "results"):
            rows = payload.get(key)
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]

    return []


def is_suspended(value: Any) -> bool:
    marker = clean_text(value).upper()
    return marker not in ("", "N", "NO", "0", "FALSE", "否", "無")


def parse_market(payload: Any, market: str) -> tuple[dict[str, dict[str, Any]], str]:
    records = unwrap_records(payload)
    result: dict[str, dict[str, Any]] = {}
    dates: list[str] = []

    for row in records:
        code = normalize_code(pick_value(row, CODE_KEYS))
        if not code:
            continue

        reference_date = clean_text(pick_value(row, DATE_KEYS))
        if reference_date:
            dates.append(reference_date)

        suspended = is_suspended(pick_value(row, SUSPENSION_KEYS))
        result[code] = {
            "DayTradeEligible": True,
            "SellFirstDayTradeAllowed": not suspended,
        }

    if len(result) < 300:
        raise RuntimeError(f"{market} eligibility list is unexpectedly small: {len(result)}")

    return result, max(dates, default="")


def enrich() -> dict[str, Any]:
    with STOCKS_PATH.open(encoding="utf-8") as file:
        payload = json.load(file)

    stocks = payload.get("data", [])
    if not isinstance(stocks, list) or not stocks:
        raise RuntimeError("stocks.json has no data array")

    market_maps: dict[str, dict[str, dict[str, Any]]] = {}
    market_dates: dict[str, str] = {}

    for market, url in SOURCES.items():
        records, reference_date = parse_market(fetch_json(url), market)
        market_maps[market] = records
        market_dates[market] = reference_date

    counts = {
        "eligible": 0,
        "buyFirstOnly": 0,
        "ineligible": 0,
        "unknown": 0,
    }

    changed = False

    def update_stock(stock: dict[str, Any], values: dict[str, Any]) -> None:
        nonlocal changed

        for deprecated_key in (
            "DayTradeStatus",
            "DayTradeEligibilityDate",
            "DayTradeEligibilitySource",
        ):
            if deprecated_key in stock:
                changed = True
                stock.pop(deprecated_key)

        if any(stock.get(key) != value for key, value in values.items()):
            changed = True

        stock.update(values)

    for stock in stocks:
        market = clean_text(stock.get("Market"))
        code = normalize_code(stock.get("Code"))
        market_map = market_maps.get(market)

        if market_map is None:
            update_stock(
                stock,
                {
                    "DayTradeEligible": False,
                    "SellFirstDayTradeAllowed": False,
                }
            )
            counts["unknown"] += 1
            continue

        eligibility = market_map.get(code)
        if eligibility is None:
            update_stock(
                stock,
                {
                    "DayTradeEligible": False,
                    "SellFirstDayTradeAllowed": False,
                }
            )
            counts["ineligible"] += 1
            continue

        update_stock(
            stock,
            eligibility,
        )

        if eligibility["SellFirstDayTradeAllowed"]:
            counts["eligible"] += 1
        else:
            counts["buyFirstOnly"] += 1

    previous_metadata = payload.get("dayTradeEligibility", {})
    metadata_without_time = {
        "sources": SOURCES,
        "marketDates": market_dates,
        "counts": counts,
    }

    if any(
        previous_metadata.get(key) != value
        for key, value in metadata_without_time.items()
    ):
        changed = True

    updated_at = (
        datetime.now(ZoneInfo("Asia/Taipei")).strftime("%Y-%m-%d %H:%M:%S")
        if changed or not previous_metadata.get("updatedAt")
        else previous_metadata["updatedAt"]
    )

    payload["dayTradeEligibility"] = {
        "updatedAt": updated_at,
        **metadata_without_time,
    }

    with STOCKS_PATH.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)

    return payload["dayTradeEligibility"]


if __name__ == "__main__":
    summary = enrich()
    print(json.dumps(summary, ensure_ascii=False, indent=2))
