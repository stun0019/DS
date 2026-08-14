"""Enrich stocks.json with official TWSE/TPEx day-trading eligibility."""

from __future__ import annotations

import json
import re
import ssl
import time
import urllib.request
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
STOCKS_PATH = ROOT / "stocks.json"

ELIGIBILITY_SOURCES = {
    "TWSE": "https://openapi.twse.com.tw/v1/exchangeReport/TWTB4U",
    "TPEX": "https://www.tpex.org.tw/openapi/v1/tpex_securities",
}

SUSPENSION_SOURCES = {
    "TWSE": "https://openapi.twse.com.tw/v1/exchangeReport/TWTBAU1",
    "TPEX": "https://www.tpex.org.tw/openapi/v1/tpex_intraday_trading_pre",
}

SOURCES = {
    "eligibility": ELIGIBILITY_SOURCES,
    "sellFirstSuspensions": SUSPENSION_SOURCES,
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


def is_certificate_verification_error(error: Exception) -> bool:
    pending: list[BaseException] = [error]
    visited: set[int] = set()

    while pending:
        current = pending.pop()
        if id(current) in visited:
            continue

        visited.add(id(current))

        if isinstance(current, ssl.SSLCertVerificationError):
            return True

        message = str(current).upper()
        if (
            "CERTIFICATE_VERIFY_FAILED" in message
            or "MISSING SUBJECT KEY IDENTIFIER" in message
        ):
            return True

        for nested in (
            getattr(current, "reason", None),
            current.__cause__,
            current.__context__,
        ):
            if isinstance(nested, BaseException):
                pending.append(nested)

    return False


def create_tpex_fallback_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def fetch_json(url: str) -> Any:
    last_error: Exception | None = None
    is_tpex = "tpex.org.tw" in url.lower()

    for attempt in range(1, 4):
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 Taiwan-Stock-Dashboard",
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://www.tpex.org.tw/" if is_tpex else "https://www.twse.com.tw/",
                "Cache-Control": "no-cache",
            },
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=45,
                context=ssl.create_default_context(),
            ) as response:
                return json.loads(response.read().decode("utf-8-sig"))

        except Exception as error:  # pragma: no cover - network error details vary
            last_error = error

            if is_tpex and is_certificate_verification_error(error):
                warnings.warn(
                    "TPEx certificate verification failed; retrying this TPEx "
                    "request only with certificate verification disabled.",
                    RuntimeWarning,
                    stacklevel=2,
                )

                try:
                    with urllib.request.urlopen(
                        request,
                        timeout=45,
                        context=create_tpex_fallback_context(),
                    ) as response:
                        return json.loads(response.read().decode("utf-8-sig"))
                except Exception as fallback_error:  # pragma: no cover
                    last_error = fallback_error

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
            "SellFirstSuspended": suspended,
        }

    if len(result) < 300:
        raise RuntimeError(f"{market} eligibility list is unexpectedly small: {len(result)}")

    return result, max(dates, default="")


def current_roc_date() -> str:
    now = datetime.now(ZoneInfo("Asia/Taipei"))
    return f"{now.year - 1911:03d}{now.month:02d}{now.day:02d}"


def normalize_date(value: Any) -> str:
    digits = re.sub(r"\D", "", clean_text(value))
    return digits if len(digits) == 7 else ""


def parse_suspensions(
    payload: Any,
    market: str,
    as_of_date: str,
) -> tuple[dict[str, dict[str, Any]], str]:
    result: dict[str, dict[str, Any]] = {}
    source_dates: list[str] = []

    for row in unwrap_records(payload):
        code = normalize_code(pick_value(row, CODE_KEYS))
        if not code:
            continue

        source_date = normalize_date(pick_value(row, DATE_KEYS))
        if source_date:
            source_dates.append(source_date)

        reason = clean_text(row.get("Reason"))

        if market == "TWSE":
            start_date = normalize_date(row.get("StartDate"))
            end_date = normalize_date(row.get("EndDate"))
            active = bool(
                start_date
                and end_date
                and start_date <= as_of_date <= end_date
            )
            resume_date = ""
        else:
            start_date = normalize_date(row.get("FirstDayToSuspendSellThenBuy"))
            resume_date = normalize_date(row.get("DayOfReinstatingSellThenBuy"))
            end_date = ""
            active = bool(
                start_date
                and resume_date
                and start_date <= as_of_date < resume_date
            )

        if not active:
            continue

        result[code] = {
            "SellFirstDayTradeAllowed": False,
            "SellFirstSuspended": True,
            "SellFirstSuspensionReason": reason,
            "SellFirstSuspensionStartDate": start_date,
            "SellFirstSuspensionEndDate": end_date,
            "SellFirstResumeDate": resume_date,
        }

    return result, max(source_dates, default=as_of_date if market == "TWSE" else "")


def enrich(as_of_date: str | None = None) -> dict[str, Any]:
    with STOCKS_PATH.open(encoding="utf-8") as file:
        payload = json.load(file)

    stocks = payload.get("data", [])
    if not isinstance(stocks, list) or not stocks:
        raise RuntimeError("stocks.json has no data array")

    market_maps: dict[str, dict[str, dict[str, Any]]] = {}
    market_dates: dict[str, str] = {}
    suspension_dates: dict[str, str] = {}
    source_suspension_counts: dict[str, int] = {}
    effective_date = normalize_date(as_of_date) or current_roc_date()

    for market, url in ELIGIBILITY_SOURCES.items():
        records, reference_date = parse_market(fetch_json(url), market)
        suspensions, suspension_date = parse_suspensions(
            fetch_json(SUSPENSION_SOURCES[market]),
            market,
            effective_date,
        )

        active_eligible_suspensions = 0
        for code, suspension in suspensions.items():
            eligibility = records.get(code)
            if eligibility is None:
                continue

            eligibility.update(suspension)
            active_eligible_suspensions += 1

        market_maps[market] = records
        market_dates[market] = reference_date
        suspension_dates[market] = suspension_date
        source_suspension_counts[market] = active_eligible_suspensions

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

        for optional_key in (
            "SellFirstSuspensionReason",
            "SellFirstSuspensionStartDate",
            "SellFirstSuspensionEndDate",
            "SellFirstResumeDate",
        ):
            if optional_key not in values and optional_key in stock:
                changed = True
                stock.pop(optional_key)

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
                    "SellFirstSuspended": False,
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
                    "SellFirstSuspended": False,
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

    suspension_counts = {
        market: sum(
            1
            for stock in stocks
            if clean_text(stock.get("Market")) == market
            and stock.get("SellFirstSuspended") is True
        )
        for market in ELIGIBILITY_SOURCES
    }

    previous_metadata = payload.get("dayTradeEligibility", {})
    metadata_without_time = {
        "sources": SOURCES,
        "marketDates": market_dates,
        "sellFirstSuspensions": {
            "asOfDate": effective_date,
            "sourceDates": suspension_dates,
            "counts": suspension_counts,
            "sourceEligibleCounts": source_suspension_counts,
        },
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
