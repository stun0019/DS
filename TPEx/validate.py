from __future__ import annotations

import json
import re

from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "stocks.json"

EXPECTED_MARKET = "TPEX"
EXPECTED_VOLUME_MODE = "BROKER_COMPARABLE_V4"


def to_int(
    value: Any,
) -> int:

    text = (
        str(
            value
            if value is not None
            else ""
        )
        .replace(",", "")
        .replace("+", "")
        .strip()
    )

    if text in (
        "",
        "-",
        "--",
        "---",
    ):
        return 0

    try:
        return int(
            float(text)
        )

    except Exception:

        text = re.sub(
            r"[^0-9.\-]",
            "",
            text,
        )

        try:
            return int(
                float(text)
            )
        except Exception:
            return 0


def main():

    if not DATA_PATH.exists():

        raise SystemExit(
            "TPEx/stocks.json "
            "does not exist"
        )

    with DATA_PATH.open(
        encoding="utf-8"
    ) as file:

        payload = json.load(
            file
        )

    if payload.get(
        "market"
    ) != EXPECTED_MARKET:

        raise SystemExit(
            "Invalid TPEx market"
        )

    if payload.get(
        "volumeMode"
    ) != EXPECTED_VOLUME_MODE:

        raise SystemExit(
            "Invalid TPEx volumeMode"
        )

    trade_date = str(
        payload.get(
            "tradeDate",
            "",
        )
    )

    trade_date_iso = str(
        payload.get(
            "tradeDateISO",
            "",
        )
    )

    if not trade_date:

        raise SystemExit(
            "Missing TPEx tradeDate"
        )

    if not trade_date_iso:

        raise SystemExit(
            "Missing TPEx tradeDateISO"
        )

    stocks = payload.get(
        "data"
    )

    if not isinstance(
        stocks,
        list,
    ):

        raise SystemExit(
            "TPEx data must be array"
        )

    if len(stocks) < 500:

        raise SystemExit(
            "TPEx stock count too small: "
            +
            str(
                len(stocks)
            )
        )

    if payload.get(
        "count"
    ) != len(stocks):

        raise SystemExit(
            "TPEx count mismatch"
        )

    seen_codes = set()

    invalid = []

    eligible_count = 0

    unclassified = 0

    for stock in stocks:

        code = str(
            stock.get(
                "Code",
                "",
            )
        ).strip()

        if not code:

            invalid.append(
                (
                    code,
                    "missing code",
                )
            )

            continue

        if code in seen_codes:

            invalid.append(
                (
                    code,
                    "duplicate code",
                )
            )

            continue

        seen_codes.add(
            code
        )

        if stock.get(
            "Market"
        ) != EXPECTED_MARKET:

            invalid.append(
                (
                    code,
                    "invalid market",
                )
            )

            continue

        if str(
            stock.get(
                "Date",
                "",
            )
        ) != trade_date:

            invalid.append(
                (
                    code,
                    "trade date mismatch",
                )
            )

            continue

        if stock.get(
            "Industry"
        ) == "未分類":

            unclassified += 1

        if not isinstance(
            stock.get(
                "DayTradeEligible"
            ),
            bool,
        ):

            invalid.append(
                (
                    code,
                    "missing DayTradeEligible",
                )
            )

            continue

        if not isinstance(
            stock.get(
                "SellFirstDayTradeAllowed"
            ),
            bool,
        ):

            invalid.append(
                (
                    code,
                    "missing SellFirstDayTradeAllowed",
                )
            )

            continue

        if not isinstance(
            stock.get(
                "SellFirstSuspended"
            ),
            bool,
        ):

            invalid.append(
                (
                    code,
                    "missing SellFirstSuspended",
                )
            )

            continue

        if stock[
            "DayTradeEligible"
        ]:
            eligible_count += 1

        mainboard = to_int(
            stock.get(
                "MainboardTradeVolume",
                stock.get(
                    "TradeVolume",
                    0,
                ),
            )
        )

        fixed = to_int(
            stock.get(
                "AfterHoursFixedVolume",
                0,
            )
        )

        broker = to_int(
            stock.get(
                "BrokerComparableVolume",
                0,
            )
        )

        adjusted = to_int(
            stock.get(
                "AdjustedTradeVolume",
                0,
            )
        )

        expected = (
            mainboard
            +
            fixed
        )

        if broker != expected:

            invalid.append(
                (
                    code,
                    (
                        f"volume "
                        f"{broker} != "
                        f"{expected}"
                    ),
                )
            )

            continue

        if adjusted != broker:

            invalid.append(
                (
                    code,
                    "adjusted volume mismatch",
                )
            )

    if eligible_count < 300:

        raise SystemExit(
            "TPEx day-trading "
            "coverage too small: "
            +
            str(
                eligible_count
            )
        )

    if unclassified > 10:

        raise SystemExit(
            "Too many unclassified "
            "TPEx stocks: "
            +
            str(
                unclassified
            )
        )

    if invalid:

        print(
            "Invalid records:"
        )

        for row in invalid[
            :30
        ]:
            print(
                row
            )

        raise SystemExit(
            "TPEx validation failed"
        )

    print(
        "=============================="
    )
    print(
        "TPEX VALIDATION OK"
    )
    print(
        "=============================="
    )

    print(
        "Trade Date:",
        trade_date,
    )

    print(
        "Trade Date ISO:",
        trade_date_iso,
    )

    print(
        "Stocks:",
        len(stocks),
    )

    print(
        "Day Trade Eligible:",
        eligible_count,
    )

    print(
        "Unclassified:",
        unclassified,
    )

    print(
        "Volume Mode:",
        payload.get(
            "volumeMode"
        ),
    )


if __name__ == "__main__":
    main()
