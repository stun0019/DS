"""Repair TPEx industry metadata from the official company OpenAPI."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from enrich_day_trade_eligibility import (
    clean_text,
    fetch_json,
    normalize_code,
    pick_value,
    unwrap_records,
)


ROOT = Path(__file__).resolve().parents[1]
STOCKS_PATH = ROOT / "stocks.json"
TPEX_COMPANY_API = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O"

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

CODE_KEYS = (
    "SecuritiesCompanyCode",
    "SecuritiesCode",
    "Code",
    "證券代號",
)

INDUSTRY_KEYS = (
    "SecuritiesIndustryCode",
    "IndustryCode",
    "Industry",
    "產業別",
    "產業類別",
)


def normalize_industry_code(value: Any) -> str:
    text = clean_text(value)
    return text.zfill(2) if text.isdigit() else text


def enrich() -> dict[str, int]:
    company_rows = unwrap_records(fetch_json(TPEX_COMPANY_API))
    company_industries: dict[str, tuple[str, str]] = {}

    for row in company_rows:
        code = normalize_code(pick_value(row, CODE_KEYS))
        industry_code = normalize_industry_code(pick_value(row, INDUSTRY_KEYS))

        if not code or not industry_code:
            continue

        company_industries[code] = (
            industry_code,
            INDUSTRY_MAP.get(industry_code, "未分類"),
        )

    if len(company_industries) < 800:
        raise RuntimeError(
            "TPEx company industry coverage is unexpectedly small: "
            + str(len(company_industries))
        )

    with STOCKS_PATH.open(encoding="utf-8") as file:
        payload = json.load(file)

    matched = 0
    unclassified = 0

    for stock in payload.get("data", []):
        if stock.get("Market") != "TPEX":
            continue

        industry = company_industries.get(normalize_code(stock.get("Code")))
        if industry is None:
            unclassified += 1
            continue

        stock["IndustryCode"] = industry[0]
        stock["Industry"] = industry[1]
        matched += 1

        if industry[1] == "未分類":
            unclassified += 1

    if matched < 800 or unclassified > 10:
        raise RuntimeError(
            f"TPEx industry validation failed: matched={matched}, "
            f"unclassified={unclassified}"
        )

    with STOCKS_PATH.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)

    return {
        "matched": matched,
        "unclassified": unclassified,
    }


if __name__ == "__main__":
    print(json.dumps(enrich(), ensure_ascii=False, indent=2))
