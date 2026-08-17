from __future__ import annotations

import json
import re
import ssl
import time
import urllib.request

from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = ROOT / "stocks.json"

MARKET = "TPEX"
MARKET_NAME = "上櫃"

VOLUME_MODE = "BROKER_COMPARABLE_V4"

TPEX_OPENAPI = (
    "https://www.tpex.org.tw/openapi/v1"
)

MARKET_API = (
    TPEX_OPENAPI
    + "/tpex_mainboard_quotes"
)

DATE_API = (
    TPEX_OPENAPI
    + "/tpex_mainboard_daily_close_quotes"
)

COMPANY_API = (
    TPEX_OPENAPI
    + "/mopsfin_t187ap03_O"
)

ODD_API = (
    TPEX_OPENAPI
    + "/tpex_odd_stock"
)

FIXED_API = (
    TPEX_OPENAPI
    + "/tpex_off_market"
)

BLOCK_API = (
    TPEX_OPENAPI
    + "/tpex_daily_qutoes_block"
)

DAY_TRADE_API = (
    TPEX_OPENAPI
    + "/tpex_securities"
)

SELL_FIRST_SUSPENSION_API = (
    TPEX_OPENAPI
    + "/tpex_intraday_trading_pre"
)


INDUSTRY_MAP = {
    "01": "水泥工業",
    "02": "食品工業",
    "03": "塑膠工業",
    "04": "紡織纖維",
    "05": "電機機械",
    "06": "電器電纜",
    "08": "玻璃陶瓷",
    "09": "造紙工業",
    "10": "鋼鐵工業",
    "11": "橡膠工業",
    "12": "汽車工業",
    "14": "建材營造",
    "15": "航運業",
    "16": "觀光餐旅",
    "17": "金融保險",
    "18": "貿易百貨",
    "19": "綜合",
    "20": "其他",
    "21": "化學工業",
    "22": "生技醫療業",
    "23": "油電燃氣業",
    "24": "半導體業",
    "25": "電腦及週邊設備業",
    "26": "光電業",
    "27": "通信網路業",
    "28": "電子零組件業",
    "29": "電子通路業",
    "30": "資訊服務業",
    "31": "其他電子業",
    "32": "文化創意業",
    "33": "農業科技業",
    "35": "綠能環保",
    "36": "數位雲端",
    "37": "運動休閒",
    "38": "居家生活",
    "80": "管理股票",
}


DATE_KEYS = (
    "Date",
    "TradeDate",
    "TradingDate",
    "TradeDateString",
    "DataDate",
    "資料日期",
    "交易日期",
    "成交日期",
    "日期",
)

CODE_KEYS = (
    "SecuritiesCompanyCode",
    "SecuritiesCode",
    "StockCode",
    "Code",
    "證券代號",
    "股票代號",
    "公司代號",
    "代號",
)

NAME_KEYS = (
    "CompanyName",
    "SecuritiesCompanyName",
    "SecuritiesName",
    "StockName",
    "Name",
    "公司簡稱",
    "證券名稱",
    "名稱",
)

VOLUME_KEYS = (
    "TradingShares",
    "TradingVolume",
    "TransactionShares",
    "TradeVolume",
    "Volume",
    "成交股數",
    "成交量",
    "成交數量",
    "成交張數",
)

INDUSTRY_KEYS = (
    "產業別",
    "產業類別",
    "Industry",
    "IndustryCode",
    "IndustryCategory",
    "SecuritiesIndustryCode",
)

SUSPENSION_KEYS = (
    "Suspension",
    "SuspendSellThenBuy",
    "暫停現股賣出後現款買進當沖註記",
    "暫停先賣後買當日沖銷註記",
)


def clean_text(
    value: Any,
) -> str:

    text = str(
        value
        if value is not None
        else ""
    )

    text = re.sub(
        r"<[^>]+>",
        "",
        text,
    )

    return (
        text
        .replace("\u3000", " ")
        .replace("&nbsp;", " ")
        .strip()
    )


def normalize_key(
    value: Any,
) -> str:

    return (
        clean_text(value)
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
        .lower()
    )


def normalize_code(
    value: Any,
) -> str:

    text = (
        clean_text(value)
        .replace('="', "")
        .replace('"', "")
        .replace("=", "")
    )

    return re.sub(
        r"[^0-9A-Za-z]",
        "",
        text,
    )


def to_int(
    value: Any,
) -> int:

    text = (
        clean_text(value)
        .replace(",", "")
        .replace("+", "")
    )

    if text in (
        "",
        "-",
        "--",
        "---",
        "----",
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


def pick_value(
    row,
    candidates,
    default="",
):

    if not isinstance(
        row,
        dict,
    ):
        return default

    for candidate in candidates:

        if candidate in row:

            value = row.get(
                candidate
            )

            if value not in (
                None,
                "",
            ):
                return value

    normalized_candidates = {
        normalize_key(
            candidate
        )
        for candidate
        in candidates
    }

    for key, value in row.items():

        if (
            normalize_key(key)
            in normalized_candidates
            and
            value not in (
                None,
                "",
            )
        ):
            return value

    return default


def unwrap_records(
    payload,
):

    if isinstance(
        payload,
        list,
    ):
        return [
            row
            for row in payload
            if isinstance(
                row,
                dict,
            )
        ]

    if isinstance(
        payload,
        dict,
    ):

        for key in (
            "data",
            "Data",
            "result",
            "results",
        ):

            rows = payload.get(
                key
            )

            if isinstance(
                rows,
                list,
            ):

                return [
                    row
                    for row in rows
                    if isinstance(
                        row,
                        dict,
                    )
                ]

    return []


def normalize_trade_date(
    value,
) -> str:

    raw = re.sub(
        r"\D",
        "",
        str(value or ""),
    )

    if len(raw) == 7:
        return raw

    if len(raw) == 8:

        year = (
            int(raw[:4])
            -
            1911
        )

        if year <= 0:
            return ""

        return (
            f"{year:03d}"
            +
            raw[4:]
        )

    return ""


def roc_to_gregorian(
    value,
) -> str:

    roc = normalize_trade_date(
        value
    )

    if len(roc) != 7:
        raise RuntimeError(
            "Invalid ROC date: "
            +
            str(value)
        )

    return (
        f"{int(roc[:3]) + 1911}"
        +
        roc[3:]
    )


def roc_to_iso(
    value,
) -> str:

    date = roc_to_gregorian(
        value
    )

    return (
        f"{date[:4]}-"
        f"{date[4:6]}-"
        f"{date[6:8]}"
    )


def current_roc_date():

    now = datetime.now(
        ZoneInfo(
            "Asia/Taipei"
        )
    )

    return (
        f"{now.year - 1911:03d}"
        f"{now.month:02d}"
        f"{now.day:02d}"
    )


def is_certificate_verification_error(
    error,
):

    pending = [
        error
    ]

    visited = set()

    while pending:

        current = (
            pending.pop()
        )

        if id(current) in visited:
            continue

        visited.add(
            id(current)
        )

        if isinstance(
            current,
            ssl.SSLCertVerificationError,
        ):
            return True

        message = (
            str(current)
            .upper()
        )

        if (
            "CERTIFICATE_VERIFY_FAILED"
            in message
            or
            "MISSING SUBJECT KEY IDENTIFIER"
            in message
        ):
            return True

        for nested in (
            getattr(
                current,
                "reason",
                None,
            ),
            current.__cause__,
            current.__context__,
        ):

            if isinstance(
                nested,
                BaseException,
            ):
                pending.append(
                    nested
                )

    return False


def create_fallback_context():

    context = (
        ssl.create_default_context()
    )

    context.check_hostname = False

    context.verify_mode = (
        ssl.CERT_NONE
    )

    return context


def fetch_json(
    url,
    required=True,
):

    print(
        "Fetching:",
        url,
    )

    last_error = None

    for attempt in range(
        1,
        4,
    ):

        request = (
            urllib.request.Request(
                url,
                headers={
                    "User-Agent":
                        "Mozilla/5.0 DS",
                    "Accept":
                        "application/json,text/plain,*/*",
                    "Referer":
                        "https://www.tpex.org.tw/",
                    "Cache-Control":
                        "no-cache",
                    "Pragma":
                        "no-cache",
                },
            )
        )

        try:

            try:

                with urllib.request.urlopen(
                    request,
                    timeout=45,
                    context=ssl.create_default_context(),
                ) as response:

                    raw = response.read()

            except Exception as error:

                if not (
                    is_certificate_verification_error(
                        error
                    )
                ):
                    raise

                print(
                    "SECURITY WARNING: "
                    "TPEx SSL verification "
                    "failed; using fallback "
                    "for this request."
                )

                with urllib.request.urlopen(
                    request,
                    timeout=45,
                    context=create_fallback_context(),
                ) as response:

                    raw = response.read()

            return json.loads(
                raw.decode(
                    "utf-8-sig"
                )
            )

        except Exception as error:

            last_error = error

            print(
                f"Attempt {attempt} failed:",
                repr(error),
            )

            if attempt < 3:

                time.sleep(
                    attempt * 2
                )

    if required:

        raise RuntimeError(
            f"TPEx API failed: "
            f"{url}\n"
            f"{last_error}"
        )

    return []


def extract_row_date(
    row,
):

    return normalize_trade_date(
        pick_value(
            row,
            DATE_KEYS,
        )
    )


def detect_latest_trade_date(
    payload,
    label,
):

    dates = []

    if isinstance(
        payload,
        dict,
    ):

        date = normalize_trade_date(
            pick_value(
                payload,
                DATE_KEYS,
            )
        )

        if date:
            dates.append(
                date
            )

    for row in unwrap_records(
        payload
    ):

        date = extract_row_date(
            row
        )

        if date:
            dates.append(
                date
            )

    if not dates:

        print(
            label,
            "has no date field",
        )

        return ""

    counts = Counter(
        dates
    )

    print(
        label,
        "dates:",
        dict(
            sorted(
                counts.items()
            )
        ),
    )

    return max(
        counts.keys()
    )


def row_matches_date(
    row,
    target_date,
    allow_missing=True,
):

    date = extract_row_date(
        row
    )

    if not date:
        return allow_missing

    return (
        date
        ==
        target_date
    )


def normalize_industry_code(
    value,
):

    text = clean_text(
        value
    )

    if not text:
        return ""

    if text.isdigit():
        return text.zfill(
            2
        )

    return text


def extract_volume_map(
    payload,
    target_date,
):

    result = {}

    for row in unwrap_records(
        payload
    ):

        if not row_matches_date(
            row,
            target_date,
            allow_missing=True,
        ):
            continue

        code = normalize_code(
            pick_value(
                row,
                CODE_KEYS,
            )
        )

        if not code:
            continue

        raw_volume = pick_value(
            row,
            VOLUME_KEYS,
        )

        if raw_volume in (
            "",
            None,
        ):
            continue

        result[code] = (
            result.get(
                code,
                0,
            )
            +
            to_int(
                raw_volume
            )
        )

    return result


def extract_fixed_map(
    payload,
    target_date,
):

    result = {}

    for row in unwrap_records(
        payload
    ):

        if not row_matches_date(
            row,
            target_date,
            allow_missing=True,
        ):
            continue

        code = normalize_code(
            pick_value(
                row,
                CODE_KEYS,
            )
        )

        if not code:
            continue

        raw_units = pick_value(
            row,
            VOLUME_KEYS,
        )

        if raw_units in (
            "",
            None,
        ):
            continue

        lots = to_int(
            raw_units
        )

        shares = (
            lots
            *
            1000
        )

        result[code] = (
            result.get(
                code,
                0,
            )
            +
            shares
        )

    return result


def normalize_date(
    value,
):

    digits = re.sub(
        r"\D",
        "",
        clean_text(value),
    )

    if len(digits) == 7:
        return digits

    return ""


def is_suspended(
    value,
):

    marker = (
        clean_text(value)
        .upper()
    )

    return marker not in (
        "",
        "N",
        "NO",
        "0",
        "FALSE",
        "否",
        "無",
    )


def build_eligibility():

    eligibility_payload = (
        fetch_json(
            DAY_TRADE_API
        )
    )

    suspension_payload = (
        fetch_json(
            SELL_FIRST_SUSPENSION_API
        )
    )

    eligibility = {}
    dates = []

    for row in unwrap_records(
        eligibility_payload
    ):

        code = normalize_code(
            pick_value(
                row,
                CODE_KEYS,
            )
        )

        if not code:
            continue

        reference_date = clean_text(
            pick_value(
                row,
                DATE_KEYS,
            )
        )

        if reference_date:
            dates.append(
                reference_date
            )

        suspended = (
            is_suspended(
                pick_value(
                    row,
                    SUSPENSION_KEYS,
                )
            )
        )

        eligibility[
            code
        ] = {
            "DayTradeEligible":
                True,
            "SellFirstDayTradeAllowed":
                not suspended,
            "SellFirstSuspended":
                suspended,
        }

    if len(eligibility) < 300:

        raise RuntimeError(
            "TPEx day-trading "
            "eligibility coverage "
            "is too small"
        )

    as_of_date = (
        current_roc_date()
    )

    active_suspensions = 0

    for row in unwrap_records(
        suspension_payload
    ):

        code = normalize_code(
            pick_value(
                row,
                CODE_KEYS,
            )
        )

        if (
            not code
            or
            code not in eligibility
        ):
            continue

        start_date = normalize_date(
            row.get(
                "FirstDayToSuspendSellThenBuy"
            )
        )

        resume_date = normalize_date(
            row.get(
                "DayOfReinstatingSellThenBuy"
            )
        )

        active = bool(
            start_date
            and
            resume_date
            and
            start_date
            <=
            as_of_date
            <
            resume_date
        )

        if not active:
            continue

        eligibility[
            code
        ].update({
            "SellFirstDayTradeAllowed":
                False,
            "SellFirstSuspended":
                True,
            "SellFirstSuspensionReason":
                clean_text(
                    row.get(
                        "Reason"
                    )
                ),
            "SellFirstSuspensionStartDate":
                start_date,
            "SellFirstSuspensionEndDate":
                "",
            "SellFirstResumeDate":
                resume_date,
        })

        active_suspensions += 1

    return (
        eligibility,
        {
            "source":
                DAY_TRADE_API,
            "suspensionSource":
                SELL_FIRST_SUSPENSION_API,
            "referenceDate":
                max(
                    dates,
                    default="",
                ),
            "asOfDate":
                as_of_date,
            "activeSuspensions":
                active_suspensions,
        },
    )


def read_existing():

    if not OUTPUT_PATH.exists():
        return None

    try:

        with OUTPUT_PATH.open(
            encoding="utf-8"
        ) as file:

            return json.load(
                file
            )

    except Exception:
        return None


def comparable_payload(
    payload,
):

    if not isinstance(
        payload,
        dict,
    ):
        return payload

    clone = dict(
        payload
    )

    clone.pop(
        "updatedAt",
        None,
    )

    return clone


def write_if_changed(
    payload,
):

    existing = read_existing()

    if (
        existing
        and
        comparable_payload(
            existing
        )
        ==
        comparable_payload(
            payload
        )
    ):

        print(
            "NO DATA CHANGE"
        )

        return False

    payload["updatedAt"] = (
        datetime.now(
            ZoneInfo(
                "Asia/Taipei"
            )
        )
        .strftime(
            "%Y-%m-%d %H:%M:%S"
        )
    )

    with OUTPUT_PATH.open(
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            payload,
            file,
            ensure_ascii=False,
            indent=2,
        )

    return True


def main():

    print(
        "=============================="
    )
    print(
        "TPEx UPDATE"
    )
    print(
        "=============================="
    )

    market_payload = fetch_json(
        MARKET_API
    )

    market_rows = unwrap_records(
        market_payload
    )

    if len(
        market_rows
    ) < 500:

        raise RuntimeError(
            "TPEx market data too small"
        )

    fixed_payload = fetch_json(
        FIXED_API
    )

    date_payload = fetch_json(
        DATE_API,
        required=False,
    )

    fixed_date = (
        detect_latest_trade_date(
            fixed_payload,
            "TPEx fixed",
        )
    )

    daily_date = (
        detect_latest_trade_date(
            date_payload,
            "TPEx daily close",
        )
    )

    quotes_date = (
        detect_latest_trade_date(
            market_payload,
            "TPEx mainboard quotes",
        )
    )

    trade_date = (
        fixed_date
        or
        daily_date
        or
        quotes_date
    )

    if not trade_date:

        raise RuntimeError(
            "Cannot detect TPEx "
            "trade date"
        )

    for label, date in (
        (
            "daily-close",
            daily_date,
        ),
        (
            "mainboard-quotes",
            quotes_date,
        ),
    ):

        if (
            date
            and
            date != trade_date
        ):

            print(
                "SKIP UPDATE - "
                "TPEx DATE MISMATCH"
            )

            print(
                label,
                date,
                "!=",
                trade_date,
            )

            return

    existing = read_existing()

    existing_date = (
        normalize_trade_date(
            existing.get(
                "tradeDate",
                "",
            )
        )
        if existing
        else ""
    )

    if (
        existing_date
        and
        trade_date
        <
        existing_date
    ):

        print(
            "SKIP UPDATE - "
            "FETCHED DATE IS OLDER"
        )

        return

    company_payload = fetch_json(
        COMPANY_API
    )

    company_rows = unwrap_records(
        company_payload
    )

    if len(
        company_rows
    ) < 500:

        raise RuntimeError(
            "TPEx company data too small"
        )

    company_info = {}

    for company in company_rows:

        code = normalize_code(
            pick_value(
                company,
                CODE_KEYS,
            )
        )

        if not code:
            continue

        industry_code = (
            normalize_industry_code(
                pick_value(
                    company,
                    INDUSTRY_KEYS,
                )
            )
        )

        industry = (
            INDUSTRY_MAP.get(
                industry_code,
                "未分類",
            )
        )

        company_info[
            code
        ] = {
            "IndustryCode":
                industry_code,
            "Industry":
                industry,
        }

    odd_payload = fetch_json(
        ODD_API,
        required=False,
    )

    block_payload = fetch_json(
        BLOCK_API,
        required=False,
    )

    odd = extract_volume_map(
        odd_payload,
        trade_date,
    )

    fixed = extract_fixed_map(
        fixed_payload,
        trade_date,
    )

    block = extract_volume_map(
        block_payload,
        trade_date,
    )

    eligibility, eligibility_meta = (
        build_eligibility()
    )

    stocks = []

    eligibility_counts = {
        "eligible": 0,
        "buyFirstOnly": 0,
        "ineligible": 0,
    }

    seen_codes = set()

    for row in market_rows:

        if not row_matches_date(
            row,
            trade_date,
            allow_missing=True,
        ):
            continue

        code = normalize_code(
            pick_value(
                row,
                CODE_KEYS,
            )
        )

        if (
            not code
            or
            code not in company_info
            or
            code in seen_codes
        ):
            continue

        seen_codes.add(
            code
        )

        close = clean_text(
            pick_value(
                row,
                (
                    "Close",
                    "ClosingPrice",
                    "收盤",
                    "收盤價",
                ),
            )
        )

        if close in (
            "",
            "-",
            "--",
            "---",
        ):
            continue

        name = clean_text(
            pick_value(
                row,
                NAME_KEYS,
            )
        )

        mainboard_volume = (
            to_int(
                pick_value(
                    row,
                    VOLUME_KEYS,
                    0,
                )
            )
        )

        fixed_volume = (
            fixed.get(
                code,
                0,
            )
        )

        odd_volume = (
            odd.get(
                code,
                0,
            )
        )

        block_volume = (
            block.get(
                code,
                0,
            )
        )

        broker_volume = (
            mainboard_volume
            +
            fixed_volume
        )

        item = {
            "Date":
                trade_date,

            "Code":
                code,

            "Name":
                name,

            "TradeVolume":
                str(
                    mainboard_volume
                ),

            "TradeValue":
                str(
                    to_int(
                        pick_value(
                            row,
                            (
                                "TransactionAmount",
                                "TradingAmount",
                                "TradeValue",
                                "成交金額",
                                "成交金額(元)",
                            ),
                            0,
                        )
                    )
                ),

            "Transaction":
                str(
                    to_int(
                        pick_value(
                            row,
                            (
                                "TransactionNumber",
                                "Transactions",
                                "Transaction",
                                "成交筆數",
                            ),
                            0,
                        )
                    )
                ),

            "OpeningPrice":
                clean_text(
                    pick_value(
                        row,
                        (
                            "Open",
                            "OpeningPrice",
                            "開盤",
                            "開盤價",
                        ),
                    )
                ),

            "HighestPrice":
                clean_text(
                    pick_value(
                        row,
                        (
                            "High",
                            "HighestPrice",
                            "最高",
                            "最高價",
                        ),
                    )
                ),

            "LowestPrice":
                clean_text(
                    pick_value(
                        row,
                        (
                            "Low",
                            "LowestPrice",
                            "最低",
                            "最低價",
                        ),
                    )
                ),

            "ClosingPrice":
                close,

            "Change":
                clean_text(
                    pick_value(
                        row,
                        (
                            "Change",
                            "ChangeAmount",
                            "漲跌",
                            "漲跌價差",
                        ),
                        "0",
                    )
                ),

            "IndustryCode":
                company_info[
                    code
                ][
                    "IndustryCode"
                ],

            "Industry":
                company_info[
                    code
                ][
                    "Industry"
                ],

            "Market":
                MARKET,

            "MarketName":
                MARKET_NAME,

            "MainboardTradeVolume":
                mainboard_volume,

            "TotalTradeVolume":
                broker_volume,

            "OddLotVolume":
                odd_volume,

            "AfterHoursFixedVolume":
                fixed_volume,

            "AfterHoursFixedLots":
                fixed_volume
                //
                1000,

            "BlockTradeVolume":
                block_volume,

            "BrokerComparableVolume":
                broker_volume,

            "AdjustedTradeVolume":
                broker_volume,

            "RegularTradeVolume":
                broker_volume,
        }

        eligibility_info = (
            eligibility.get(
                code
            )
        )

        if eligibility_info:

            item.update(
                eligibility_info
            )

            if item[
                "SellFirstDayTradeAllowed"
            ]:

                eligibility_counts[
                    "eligible"
                ] += 1

            else:

                eligibility_counts[
                    "buyFirstOnly"
                ] += 1

        else:

            item.update({
                "DayTradeEligible":
                    False,

                "SellFirstDayTradeAllowed":
                    False,

                "SellFirstSuspended":
                    False,
            })

            eligibility_counts[
                "ineligible"
            ] += 1

        stocks.append(
            item
        )

    if len(stocks) < 500:

        raise RuntimeError(
            "Too few TPEx stocks: "
            +
            str(
                len(stocks)
            )
        )

    stocks.sort(
        key=lambda stock: (
            str(
                stock.get(
                    "Code",
                    "",
                )
            )
        )
    )

    payload = {
        "market":
            MARKET,

        "marketName":
            MARKET_NAME,

        "tradeDate":
            trade_date,

        "tradeDateISO":
            roc_to_iso(
                trade_date
            ),

        "updatedAt":
            "",

        "source":
            "TPEx official data",

        "type":
            "TPEX_STOCK_ONLY",

        "volumeMode":
            VOLUME_MODE,

        "volumeFormula":
            (
                "MainboardTradeVolume "
                "+ AfterHoursFixedVolume"
            ),

        "dateSources": {
            "fixed":
                fixed_date,

            "dailyClose":
                daily_date,

            "mainboardQuotes":
                quotes_date,
        },

        "dayTradeEligibility": {
            **eligibility_meta,

            "counts":
                eligibility_counts,
        },

        "count":
            len(stocks),

        "data":
            stocks,
    }

    changed = write_if_changed(
        payload
    )

    print("")
    print(
        "Trade Date:",
        trade_date,
    )

    print(
        "Trade Date ISO:",
        payload[
            "tradeDateISO"
        ],
    )

    print(
        "Count:",
        len(stocks),
    )

    print(
        "Changed:",
        changed,
    )

    print(
        "Volume Mode:",
        VOLUME_MODE,
    )


if __name__ == "__main__":
    main()
