"""Fail-closed Taiwan trading-calendar helpers used by the data workflow."""

from __future__ import annotations

from datetime import date, timedelta
import re


TRADING_CALENDAR_SOURCE = "TWSE_OFFICIAL_HOLIDAY_SCHEDULE"
OPEN_MARKERS = (
    "開始交易",
    "最後交易",
    "補行交易",
    "恢復交易",
)


def normalize_trading_date(value):
    text = str(value or "").strip()

    iso_match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if iso_match:
        try:
            return date(*map(int, iso_match.groups())).isoformat()
        except ValueError:
            return None

    roc_match = re.fullmatch(r"(\d{3})(\d{2})(\d{2})", text)
    if roc_match:
        year, month, day = map(int, roc_match.groups())
        try:
            return date(year + 1911, month, day).isoformat()
        except ValueError:
            return None

    return None


def _calendar_rows(payload):
    if not isinstance(payload, dict):
        raise ValueError("TWSE holiday schedule payload must be an object")

    rows = payload.get("data")
    if not isinstance(rows, list) or not rows:
        raise ValueError("TWSE holiday schedule is missing data rows")

    normalized = []
    for row in rows:
        if isinstance(row, (list, tuple)) and len(row) >= 3:
            raw_date, name, description = row[:3]
        elif isinstance(row, dict):
            raw_date = row.get("Date") or row.get("date")
            name = row.get("Name") or row.get("name") or ""
            description = (
                row.get("Description") or row.get("description") or ""
            )
        else:
            raise ValueError("TWSE holiday schedule contains an invalid row")

        normalized_date = normalize_trading_date(raw_date)
        if not normalized_date:
            raise ValueError("TWSE holiday schedule contains an invalid date")

        normalized.append(
            {
                "date": normalized_date,
                "name": str(name or "").strip(),
                "description": str(description or "").strip(),
            }
        )

    return normalized


def build_twse_trading_calendar(payloads_by_year):
    if not isinstance(payloads_by_year, dict) or not payloads_by_year:
        raise ValueError("TWSE holiday calendar years are unavailable")

    covered_years = []
    closed_dates = set()
    special_trading_dates = set()

    for raw_year, payload in payloads_by_year.items():
        year = str(raw_year)
        if not re.fullmatch(r"\d{4}", year):
            raise ValueError("TWSE holiday calendar contains an invalid year")

        rows = _calendar_rows(payload)
        if any(row["date"][:4] != year for row in rows):
            raise ValueError(f"TWSE holiday calendar year mismatch: {year}")

        covered_years.append(year)

        for row in rows:
            calendar_text = f'{row["name"]} {row["description"]}'
            if any(marker in calendar_text for marker in OPEN_MARKERS):
                special_trading_dates.add(row["date"])
            else:
                closed_dates.add(row["date"])

    if closed_dates & special_trading_dates:
        raise ValueError("TWSE holiday calendar contains conflicting dates")

    return {
        "source": TRADING_CALENDAR_SOURCE,
        "syncStatus": "SYNCED",
        "coveredYears": sorted(set(covered_years)),
        "closedDates": sorted(closed_dates),
        "specialTradingDates": sorted(special_trading_dates),
    }


def _validated_calendar(calendar):
    if not isinstance(calendar, dict):
        return None
    if calendar.get("source") != TRADING_CALENDAR_SOURCE:
        return None
    if calendar.get("syncStatus") != "SYNCED":
        return None

    covered_years = calendar.get("coveredYears")
    closed_dates = calendar.get("closedDates")
    special_dates = calendar.get("specialTradingDates")

    if not isinstance(covered_years, list) or not covered_years:
        return None
    if not isinstance(closed_dates, list) or not isinstance(special_dates, list):
        return None

    years = {str(year) for year in covered_years}
    if any(not re.fullmatch(r"\d{4}", year) for year in years):
        return None

    normalized_closed = [normalize_trading_date(value) for value in closed_dates]
    normalized_special = [normalize_trading_date(value) for value in special_dates]

    if any(value is None for value in normalized_closed + normalized_special):
        return None
    if any(value[:4] not in years for value in normalized_closed + normalized_special):
        return None

    closed = set(normalized_closed)
    special = set(normalized_special)
    if closed & special:
        return None

    return years, closed, special


def is_trading_date(value, calendar):
    normalized_date = normalize_trading_date(value)
    validated = _validated_calendar(calendar)

    if not normalized_date or not validated:
        return None

    years, closed_dates, special_dates = validated
    if normalized_date[:4] not in years:
        return None

    if normalized_date in special_dates:
        return True
    if normalized_date in closed_dates:
        return False

    return date.fromisoformat(normalized_date).weekday() < 5


def get_previous_trading_date(live_session_date, calendar, max_lookback_days=370):
    session_date = normalize_trading_date(live_session_date)
    if not session_date or is_trading_date(session_date, calendar) is not True:
        return None

    cursor = date.fromisoformat(session_date) - timedelta(days=1)

    for _ in range(max_lookback_days):
        trading_status = is_trading_date(cursor.isoformat(), calendar)
        if trading_status is None:
            return None
        if trading_status:
            return cursor.isoformat()
        cursor -= timedelta(days=1)

    return None


def get_candidate_valid_for_date(candidate_trade_date, live_session_date, calendar):
    candidate_date = normalize_trading_date(candidate_trade_date)
    session_date = normalize_trading_date(live_session_date)
    expected_previous = get_previous_trading_date(session_date, calendar)

    if not candidate_date or candidate_date != expected_previous:
        return ""

    return session_date


def is_incoming_trade_date_older(incoming_trade_date, existing_trade_date):
    incoming = normalize_trading_date(incoming_trade_date)
    existing = normalize_trading_date(existing_trade_date)

    if not incoming or not existing:
        return False

    return incoming < existing
