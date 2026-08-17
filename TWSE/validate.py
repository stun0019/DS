from __future__ import annotations

import json
import re
import ssl
import time
import urllib.parse
import urllib.request

from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = ROOT / "stocks.json"

MARKET = "TWSE"
MARKET_NAME = "上市"

VOLUME_MODE = "BROKER_COMPARABLE_V4"

TWSE_OPENAPI = "https://openapi.twse.com.tw/v1"
TWSE_WEB = "https://www.twse.com.tw"

MARKET_API = (
    TWSE_OPENAPI
    + "/exchangeReport/STOCK_DAY_ALL"
)

COMPANY_API = (
    TWSE_OPENAPI
    + "/opendata/t187ap03_L"
)

DAY_TRADE_API = (
    TWSE_OPENAPI
    + "/exchangeReport/TWTB4U"
)

SELL_FIRST_SUSPENSION_API = (
    TWSE_OPENAPI
    + "/exchangeReport/TWTBAU1"
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
    "資料日期",
    "交易日期",
    "成交日期",
    "日期",
)

CODE_KEYS = (
    "Code",
    "SecuritiesCode",
    "SecuritiesCompanyCode",
    "證券代號",
    "股票代號",
    "公司代號",
)

SUSPENSION_KEYS = (
    "Suspension",
    "SuspendSellThenBuy",
    "暫停現股賣出後現款買進當沖註記",
    "暫停先賣後買當日沖銷註記",
)


def clean_text(value: Any) -> str:
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


def normalize_key(value: Any) -> str:
    return (
        clean_text(value)
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
        .lower()
    )


def normalize_code(value: Any) -> str:
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


def to_int(value: Any) -> int:
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


def normalize_industry_code(
    value: Any,
) -> str:

    text = clean_text(value)

    if not text:
        return ""

    if text.isdigit():
        return text.zfill(2)

    return text


def get_industry(
    value: Any,
) -> tuple[str, str]:

    code = normalize_industry_code(
        value
    )

    if not code:
        return "", "未分類"

    return (
        code,
        INDUSTRY_MAP.get(
            code,
            "未分類",
        ),
    )


def pick_value(
    row: dict[str, Any],
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


def normalize_trade_date(
    value: Any,
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
    value: str,
) -> str:

    roc = normalize_trade_date(
        value
    )

    if len(roc) != 7:
        raise RuntimeError(
            f"Invalid ROC date: {value}"
        )

    year = (
        int(roc[:3])
        +
        1911
    )

    return (
        f"{year}"
        +
        roc[3:]
    )


def roc_to_iso(
    value: str,
) -> str:

    date = roc_to_gregorian(
        value
    )

    return (
        f"{date[:4]}-"
        f"{date[4:6]}-"
        f"{date[6:8]}"
    )


def current_roc_date() -> str:

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


def fetch_json(
    url: str,
    required: bool = True,
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
        try:

            request = (
                urllib.request.Request(
                    url,
                    headers={
                        "User-Agent":
                            "Mozilla/5.0 DS",
                        "Accept":
                            "application/json,text/plain,*/*",
                        "Referer":
                            "https://www.twse.com.tw/",
                        "Cache-Control":
                            "no-cache",
                        "Pragma":
                            "no-cache",
                    },
                )
            )

            with urllib.request.urlopen(
                request,
                timeout=45,
                context=ssl.create_default_context(),
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
            f"API failed: {url}\n"
            f"{last_error}"
        )

    return []


def unwrap_records(
    payload,
) -> list[dict[str, Any]]:

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


def detect_latest_trade_date(
    rows,
) -> str:

    dates = []

    for row in rows:

        if not isinstance(
            row,
            dict,
        ):
            continue

        date = normalize_trade_date(
            pick_value(
                row,
                DATE_KEYS,
            )
        )

        if date:
            dates.append(
                date
            )

    if not dates:
        return ""

    counts = Counter(
        dates
    )

    print(
        "TWSE detected dates:",
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
    target_date: str,
) -> bool:

    row_date = normalize_trade_date(
        pick_value(
            row,
            DATE_KEYS,
        )
    )

    return (
        bool(row_date)
        and
        row_date == target_date
    )


def iter_twse_tables(
    payload,
):

    if not isinstance(
        payload,
        dict,
    ):
        return

    fields = payload.get(
        "fields"
    )

    data = payload.get(
        "data"
    )

    if (
        isinstance(
            fields,
            list,
        )
        and
        isinstance(
            data,
            list,
        )
    ):
        yield fields, data

    for index in range(
        1,
        40,
    ):

        fields = payload.get(
            f"fields{index}"
        )

        data = payload.get(
            f"data{index}"
        )

        if (
            isinstance(
                fields,
                list,
            )
            and
            isinstance(
                data,
                list,
            )
        ):
            yield fields, data

    tables = payload.get(
        "tables"
    )

    if isinstance(
        tables,
        list,
    ):

        for table in tables:

            if not isinstance(
                table,
                dict,
            ):
                continue

            fields = table.get(
                "fields"
            )

            data = table.get(
                "data"
            )

            if (
                isinstance(
                    fields,
                    list,
                )
                and
                isinstance(
                    data,
                    list,
                )
            ):
                yield fields, data


def find_field_index(
    fields,
    candidates,
):

    normalized_fields = [
        normalize_key(
            field
        )
        for field
        in fields
    ]

    normalized_candidates = [
        normalize_key(
            candidate
        )
        for candidate
        in candidates
    ]

    for index, field in enumerate(
        normalized_fields
    ):

        for candidate in (
            normalized_candidates
        ):

            if candidate in field:
                return index

    return None


def extract_twse_volume_map(
    payload,
    volume_fields,
    multiplier=1,
):

    result = {}

    for fields, rows in (
        iter_twse_tables(
            payload
        )
    ):

        code_index = (
            find_field_index(
                fields,
                (
                    "證券代號",
                    "股票代號",
                    "公司代號",
                    "Code",
                ),
            )
        )

        volume_index = (
            find_field_index(
                fields,
                volume_fields,
            )
        )

        if (
            code_index is None
            or
            volume_index is None
        ):
            continue

        for row in rows:

            if not isinstance(
                row,
                list,
            ):
                continue

            if len(row) <= max(
                code_index,
                volume_index,
            ):
                continue

            code = normalize_code(
                row[
                    code_index
                ]
            )

            if not code:
                continue

            volume = (
                to_int(
                    row[
                        volume_index
                    ]
                )
                *
                multiplier
            )

            result[code] = (
                result.get(
                    code,
                    0,
                )
                +
                volume
            )

    return result


def fetch_twse_report(
    urls,
    volume_fields,
    multiplier=1,
):

    errors = []

    for url in urls:

        try:

            payload = fetch_json(
                url
            )

            if isinstance(
                payload,
                dict,
            ):

                stat = clean_text(
                    payload.get(
                        "stat",
                        "OK",
                    )
                )

                if (
                    stat
                    and
                    stat != "OK"
                ):
                    raise RuntimeError(
                        f"TWSE stat={stat}"
                    )

            result = (
                extract_twse_volume_map(
                    payload,
                    volume_fields,
                    multiplier,
                )
            )

            print(
                "Parsed",
                len(result),
                "records",
            )

            return result

        except Exception as error:

            errors.append(
                f"{url}: {error}"
            )

    raise RuntimeError(
        "TWSE report failed:\n"
        +
        "\n".join(
            errors
        )
    )


def normalize_date(
    value,
) -> str:

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
) -> bool:

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
    eligibility_dates = []

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

        date = clean_text(
            pick_value(
                row,
                DATE_KEYS,
            )
        )

        if date:
            eligibility_dates.append(
                date
            )

        suspended = (
            is_suspended(
                pick_value(
                    row,
                    SUSPENSION_KEYS,
                )
            )
        )

        eligibility[code] = {
            "DayTradeEligible":
                True,
            "SellFirstDayTradeAllowed":
                not suspended,
            "SellFirstSuspended":
                suspended,
        }

    if len(eligibility) < 300:
        raise RuntimeError(
            "TWSE day-trading "
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
                "StartDate"
            )
        )

        end_date = normalize_date(
            row.get(
                "EndDate"
            )
        )

        if not (
            start_date
            and
            end_date
            and
            start_date
            <=
            as_of_date
            <=
            end_date
        ):
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
                end_date,
            "SellFirstResumeDate":
                "",
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
                    eligibility_dates,
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
        "TWSE UPDATE"
    )
    print(
        "=============================="
    )

    market_rows = fetch_json(
        MARKET_API
    )

    if (
        not isinstance(
            market_rows,
            list,
        )
        or
        len(market_rows) < 500
    ):
        raise RuntimeError(
            "TWSE market data too small"
        )

    trade_date = (
        detect_latest_trade_date(
            market_rows
        )
    )

    if not trade_date:
        raise RuntimeError(
            "Cannot detect TWSE "
            "trade date"
        )

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

    company_rows = fetch_json(
        COMPANY_API
    )

    if (
        not isinstance(
            company_rows,
            list,
        )
        or
        len(company_rows) < 500
    ):
        raise RuntimeError(
            "TWSE company data too small"
        )

    company_info = {}

    for company in company_rows:

        if not isinstance(
            company,
            dict,
        ):
            continue

        code = normalize_code(
            company.get(
                "公司代號",
                "",
            )
        )

        if not code:
            continue

        industry_code, industry = (
            get_industry(
                company.get(
                    "產業別",
                    "",
                )
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

    gregorian_date = (
        roc_to_gregorian(
            trade_date
        )
    )

    common_params = (
        urllib.parse.urlencode({
            "date":
                gregorian_date,
            "selectType":
                "ALLBUT0999",
            "response":
                "json",
        })
    )

    intraday_odd = (
        fetch_twse_report(
            (
                TWSE_WEB
                + "/rwd/zh/afterTrading/TWTC7U?"
                + common_params,

                TWSE_WEB
                + "/exchangeReport/TWTC7U?"
                + common_params,
            ),
            (
                "成交股數",
            ),
        )
    )

    after_hours_odd = (
        fetch_twse_report(
            (
                TWSE_WEB
                + "/rwd/zh/afterTrading/TWT53U?"
                + common_params,

                TWSE_WEB
                + "/exchangeReport/TWT53U?"
                + common_params,
            ),
            (
                "成交股數",
            ),
        )
    )

    after_hours_fixed = (
        fetch_twse_report(
            (
                TWSE_WEB
                + "/rwd/zh/afterTrading/BFT41U?"
                + common_params,

                TWSE_WEB
                + "/exchangeReport/BFT41U?"
                + common_params,
            ),
            (
                "成交數量",
            ),
            multiplier=1000,
        )
    )

    block_params = (
        urllib.parse.urlencode({
            "date":
                gregorian_date,
            "response":
                "json",
            "selectType":
                "S",
        })
    )

    block = fetch_twse_report(
        (
            TWSE_WEB
            + "/block/BFIAUU?"
            + block_params,
        ),
        (
            "成交股數",
        ),
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

    for stock in market_rows:

        if not isinstance(
            stock,
            dict,
        ):
            continue

        if not row_matches_date(
            stock,
            trade_date,
        ):
            continue

        code = normalize_code(
            stock.get(
                "Code",
                "",
            )
        )

        if (
            not code
            or
            code not in company_info
        ):
            continue

        close = clean_text(
            stock.get(
                "ClosingPrice",
                "",
            )
        )

        if close in (
            "",
            "-",
            "--",
            "---",
        ):
            continue

        item = dict(
            stock
        )

        item.update(
            company_info[
                code
            ]
        )

        item[
            "Market"
        ] = MARKET

        item[
            "MarketName"
        ] = MARKET_NAME

        total_volume = to_int(
            item.get(
                "TradeVolume",
                0,
            )
        )

        intraday_odd_volume = (
            intraday_odd.get(
                code,
                0,
            )
        )

        after_odd_volume = (
            after_hours_odd.get(
                code,
                0,
            )
        )

        odd_volume = (
            intraday_odd_volume
            +
            after_odd_volume
        )

        fixed_volume = (
            after_hours_fixed.get(
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

        broker_volume = max(
            0,
            total_volume
            -
            odd_volume
            -
            block_volume,
        )

        item.update({
            "TotalTradeVolume":
                total_volume,

            "IntradayOddLotVolume":
                intraday_odd_volume,

            "AfterHoursOddLotVolume":
                after_odd_volume,

            "OddLotVolume":
                odd_volume,

            "AfterHoursFixedVolume":
                fixed_volume,

            "BlockTradeVolume":
                block_volume,

            "BrokerComparableVolume":
                broker_volume,

            "AdjustedTradeVolume":
                broker_volume,

            "RegularTradeVolume":
                broker_volume,
        })

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
            "Too few TWSE stocks: "
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
            "TWSE official data",

        "type":
            "TWSE_STOCK_ONLY",

        "volumeMode":
            VOLUME_MODE,

        "volumeFormula":
            (
                "TotalTradeVolume "
                "- OddLotVolume "
                "- BlockTradeVolume"
            ),

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
