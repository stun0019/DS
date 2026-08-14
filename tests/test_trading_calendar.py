import unittest
from pathlib import Path

from scripts.trading_calendar import (
    TRADING_CALENDAR_SOURCE,
    build_twse_trading_calendar,
    get_candidate_valid_for_date,
    get_previous_trading_date,
    is_incoming_trade_date_older,
    is_trading_date,
)


def payload(*rows):
    return {
        "data": [list(row) for row in rows]
    }


class TradingCalendarTests(unittest.TestCase):
    def test_previous_trading_date_handles_weekend_and_holidays(self):
        calendar = build_twse_trading_calendar(
            {
                "2026": payload(
                    ("2026-01-01", "元旦", "休市"),
                    ("2026-02-11", "春節前最後交易日", "最後交易"),
                    ("2026-02-12", "市場無交易", "休市"),
                    ("2026-02-13", "市場無交易", "休市"),
                    ("2026-02-16", "春節", "休市"),
                    ("2026-02-17", "春節", "休市"),
                    ("2026-02-18", "春節", "休市"),
                    ("2026-02-19", "春節", "休市"),
                    ("2026-02-20", "春節補假", "休市"),
                    ("2026-02-23", "春節後開始交易日", "開始交易"),
                )
            }
        )

        self.assertEqual(
            get_previous_trading_date("2026-08-17", calendar),
            "2026-08-14",
        )
        self.assertEqual(
            get_candidate_valid_for_date(
                "2026-08-14", "2026-08-17", calendar
            ),
            "2026-08-17",
        )
        self.assertEqual(
            get_candidate_valid_for_date(
                "2026-08-13", "2026-08-17", calendar
            ),
            "",
        )
        self.assertEqual(
            get_previous_trading_date("2026-02-23", calendar),
            "2026-02-11",
        )

    def test_special_weekend_trading_day_is_supported(self):
        calendar = {
            "source": TRADING_CALENDAR_SOURCE,
            "syncStatus": "SYNCED",
            "coveredYears": ["2026"],
            "closedDates": [],
            "specialTradingDates": ["2026-08-15"],
        }

        self.assertTrue(is_trading_date("2026-08-15", calendar))
        self.assertEqual(
            get_previous_trading_date("2026-08-17", calendar),
            "2026-08-15",
        )

    def test_calendar_year_gap_fails_closed(self):
        calendar = {
            "source": TRADING_CALENDAR_SOURCE,
            "syncStatus": "SYNCED",
            "coveredYears": ["2026"],
            "closedDates": ["2026-01-01"],
            "specialTradingDates": ["2026-01-02"],
        }

        self.assertIsNone(
            get_previous_trading_date("2026-01-02", calendar)
        )

    def test_invalid_official_schedule_is_rejected(self):
        with self.assertRaises(ValueError):
            build_twse_trading_calendar(
                {
                    "2026": payload(
                        ("2025-12-31", "wrong year", "休市"),
                    )
                }
            )

    def test_older_incoming_market_data_is_blocked(self):
        self.assertTrue(
            is_incoming_trade_date_older("1150813", "1150814")
        )
        self.assertFalse(
            is_incoming_trade_date_older("1150814", "1150814")
        )
        self.assertFalse(
            is_incoming_trade_date_older("1150815", "1150814")
        )

        workflow = (
            Path(__file__).resolve().parents[1]
            / ".github"
            / "workflows"
            / "update-stock-data.yml"
        ).read_text(encoding="utf-8")

        older_guard = workflow.index("SKIP UPDATE - FETCHED DATE IS OLDER")
        skip_output = workflow.index(
            'set_step_output("skip_update", "true")',
            older_guard,
        )
        guard_exit = workflow.index("raise SystemExit(0)", skip_output)

        self.assertLess(older_guard, skip_output)
        self.assertLess(skip_output, guard_exit)
        self.assertGreaterEqual(
            workflow.count(
                "if: steps.market_data.outputs.skip_update != 'true'"
            ),
            5,
        )


if __name__ == "__main__":
    unittest.main()
