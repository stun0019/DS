"""Validate the generated stocks.json contract before it is published."""

from __future__ import annotations

import json
import os

from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)

from scripts.trading_calendar import get_previous_trading_date



def main():
    with open("stocks.json", encoding="utf-8") as file:
        payload = json.load(file)

    stocks = payload.get("data", [])

    if not stocks:
        raise SystemExit("stocks.json is empty")

    valid_for_trading_date = payload.get("validForTradingDate", "")
    expected_previous_trading_date = payload.get(
        "expectedPreviousTradingDate", ""
    )
    trading_calendar = payload.get("tradingCalendar")

    if valid_for_trading_date:
        recomputed_previous_trading_date = get_previous_trading_date(
            valid_for_trading_date,
            trading_calendar,
        )

        if not recomputed_previous_trading_date:
            raise SystemExit("Candidate trading calendar is incomplete")

        if (
            recomputed_previous_trading_date
            != expected_previous_trading_date
        ):
            raise SystemExit("Expected previous trading date mismatch")

        if payload.get("tradeDateISO") != expected_previous_trading_date:
            raise SystemExit(
                "Candidate data is not the actual previous trading date"
            )

    eligibility = payload.get("dayTradeEligibility", {})
    eligibility_counts = eligibility.get("counts", {})
    suspension_meta = eligibility.get("sellFirstSuspensions", {})

    if eligibility_counts.get("eligible", 0) < 300:
        raise SystemExit("Day-trading eligibility coverage is too small")

    if not suspension_meta.get("asOfDate"):
        raise SystemExit("Missing sell-first suspension as-of date")

    tpex_unclassified = sum(
        1
        for stock in stocks
        if stock.get("Market") == "TPEX"
        and stock.get("Industry") == "未分類"
    )

    if tpex_unclassified > 10:
        raise SystemExit(
            "Too many unclassified TPEx stocks: "
            + str(tpex_unclassified)
        )

    for stock in stocks:
        if not isinstance(stock.get("DayTradeEligible"), bool):
            raise SystemExit(
                "Missing DayTradeEligible for " + str(stock.get("Code"))
            )

        if not isinstance(stock.get("SellFirstDayTradeAllowed"), bool):
            raise SystemExit(
                "Missing SellFirstDayTradeAllowed for "
                + str(stock.get("Code"))
            )

        if not isinstance(stock.get("SellFirstSuspended"), bool):
            raise SystemExit(
                "Missing SellFirstSuspended for "
                + str(stock.get("Code"))
            )

    trade_date = payload.get("tradeDate", "")

    print("Trade Date:", trade_date)
    print("Trade Date ISO:", payload.get("tradeDateISO", ""))
    print("Updated At:", payload.get("updatedAt"))
    print("Market Trade Dates:", payload.get("marketTradeDates", {}))
    print("Sync Status:", payload.get("syncStatus", "legacy"))
    print("Total:", payload.get("count"))
    print("Markets:", payload.get("marketCounts"))
    print("Mode:", payload.get("volumeMode"))

    invalid = []

    for stock in stocks:
        code = stock.get("Code")
        market = stock.get("Market")
        stock_date = stock.get("Date", "")

        if (
            payload.get("syncStatus") == "SYNCED"
            and stock_date != trade_date
        ):
            invalid.append(
                (code, f"date={stock_date}, tradeDate={trade_date}")
            )
            continue

        broker = int(
            stock.get(
                "BrokerComparableVolume",
                stock.get("AdjustedTradeVolume", 0),
            ) or 0
        )

        adjusted = int(stock.get("AdjustedTradeVolume", 0) or 0)

        if broker != adjusted:
            invalid.append(
                (code, f"broker={broker}, adjusted={adjusted}")
            )
            continue

        if market == "TWSE":
            total = int(stock.get("TotalTradeVolume", 0) or 0)
            odd = int(stock.get("OddLotVolume", 0) or 0)
            block = int(stock.get("BlockTradeVolume", 0) or 0)
            expected = max(0, total - odd - block)

        elif market == "TPEX":
            mainboard = int(
                stock.get(
                    "MainboardTradeVolume",
                    stock.get("TradeVolume", 0),
                ) or 0
            )
            fixed = int(stock.get("AfterHoursFixedVolume", 0) or 0)
            expected = mainboard + fixed

        else:
            invalid.append((code, "Unknown market"))
            continue

        if broker != expected:
            invalid.append(
                (code, f"broker={broker}, expected={expected}")
            )

    if invalid:
        print("Invalid records:")
        for item in invalid[:30]:
            print(item)
        raise SystemExit("Volume/date validation failed")

    print("")
    print("Validation OK")

    verify_codes = {"2344", "6770", "5904"}

    print("")
    print("Verification stocks:")

    for stock in stocks:
        if stock.get("Code") not in verify_codes:
            continue

        print("")
        print(
            stock.get("MarketName"),
            stock.get("Code"),
            stock.get("Name"),
        )
        print("Date:", stock.get("Date"))

        if stock.get("Market") == "TPEX":
            print(
                "Mainboard lots:",
                round(
                    int(
                        stock.get(
                            "MainboardTradeVolume",
                            stock.get("TradeVolume", 0),
                        ) or 0
                    ) / 1000,
                    3,
                ),
            )
            print(
                "Fixed lots:",
                stock.get(
                    "AfterHoursFixedLots",
                    int(stock.get("AfterHoursFixedVolume", 0) or 0) // 1000,
                ),
            )

        print(
            "Broker lots:",
            round(
                int(
                    stock.get(
                        "BrokerComparableVolume",
                        stock.get("AdjustedTradeVolume", 0),
                    ) or 0
                ) / 1000,
                3,
            ),
        )

    top10 = sorted(
        stocks,
        key=lambda stock: int(
            stock.get(
                "BrokerComparableVolume",
                stock.get("AdjustedTradeVolume", 0),
            ) or 0
        ),
        reverse=True,
    )[:10]

    print("")
    print("TOP 10")

    for index, stock in enumerate(top10, 1):
        print(
            index,
            stock.get("MarketName"),
            stock.get("Code"),
            stock.get("Name"),
            round(
                int(
                    stock.get(
                        "BrokerComparableVolume",
                        stock.get("AdjustedTradeVolume", 0),
                    ) or 0
                ) / 1000
            ),
            "張",
        )


if __name__ == "__main__":
    main()
