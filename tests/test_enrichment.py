from __future__ import annotations

import ssl
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from enrich_day_trade_eligibility import (  # noqa: E402
    fetch_json,
    is_certificate_verification_error,
    parse_suspensions,
)


class FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return self.payload


class SuspensionParsingTests(unittest.TestCase):
    def test_twse_suspension_end_date_is_inclusive(self) -> None:
        rows = [
            {
                "Code": "2330",
                "StartDate": "1150814",
                "EndDate": "1150820",
                "Reason": "除息",
            },
            {
                "Code": "2317",
                "StartDate": "1150821",
                "EndDate": "1150827",
                "Reason": "除權",
            },
        ]

        active, source_date = parse_suspensions(rows, "TWSE", "1150820")

        self.assertEqual(set(active), {"2330"})
        self.assertEqual(source_date, "1150820")
        self.assertTrue(active["2330"]["SellFirstSuspended"])

    def test_tpex_reinstating_date_is_exclusive(self) -> None:
        rows = [
            {
                "Date": "1150812",
                "SecuritiesCompanyCode": "6488",
                "FirstDayToSuspendSellThenBuy": "1150813",
                "DayOfReinstatingSellThenBuy": "1150820",
                "Reason": "除息",
            }
        ]

        active, source_date = parse_suspensions(rows, "TPEX", "1150819")
        reinstated, _ = parse_suspensions(rows, "TPEX", "1150820")

        self.assertEqual(set(active), {"6488"})
        self.assertEqual(reinstated, {})
        self.assertEqual(source_date, "1150812")
        self.assertEqual(active["6488"]["SellFirstResumeDate"], "1150820")

    def test_ssl_fallback_only_classifies_certificate_errors(self) -> None:
        certificate_error = ssl.SSLCertVerificationError(1, "certificate failed")
        wrapped_error = urllib.error.URLError(certificate_error)

        self.assertTrue(is_certificate_verification_error(certificate_error))
        self.assertTrue(is_certificate_verification_error(wrapped_error))
        self.assertFalse(is_certificate_verification_error(RuntimeError("timeout")))

    def test_tpex_certificate_error_uses_unverified_fallback_once(self) -> None:
        verify_modes: list[ssl.VerifyMode] = []

        def fake_urlopen(*_args: object, **kwargs: object) -> FakeResponse:
            context = kwargs["context"]
            verify_modes.append(context.verify_mode)

            if len(verify_modes) == 1:
                raise urllib.error.URLError(
                    ssl.SSLCertVerificationError(1, "certificate failed")
                )

            return FakeResponse(b'{"ok": true}')

        with mock.patch(
            "enrich_day_trade_eligibility.urllib.request.urlopen",
            side_effect=fake_urlopen,
        ):
            with self.assertWarns(RuntimeWarning):
                result = fetch_json(
                    "https://www.tpex.org.tw/openapi/v1/tpex_securities"
                )

        self.assertEqual(result, {"ok": True})
        self.assertEqual(verify_modes, [ssl.CERT_REQUIRED, ssl.CERT_NONE])


if __name__ == "__main__":
    unittest.main()
