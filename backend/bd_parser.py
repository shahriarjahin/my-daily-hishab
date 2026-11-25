"""Deterministic parser for Bangladeshi mobile wallet/bank SMS alerts and quick entry text."""
import re
from typing import Any

# Maps common English, Banglish, and Bangla keywords to default Hishab categories.
KEYWORD_CATEGORIES: list[tuple[tuple[str, ...], str, str]] = [
    (("salary", "beton", "payroll", "paycheck", "বেতন"), "Salary", "income"),
    (("freelance", "upwork", "fiverr", "client pay", "ফ্রিল্যান্স"), "Freelance", "income"),
    (("allowance", "pocket money", "হাতখরচ"), "Allowance", "income"),
    (("dividend", "profit", "interest", "মুনাফা"), "Investment", "income"),
    (("cash in", "received", "credited", "deposited", "রিসিভ", "পেয়েছি"), "Other Income", "income"),
    (("rickshaw", "uber", "pathao", "cng", "bus", "metro", "train", "uber", "obhai", "fuel", "petrol", "octane", "fare", "vara", "রিকশা", "ভাড়া", "বাস", "সিএনজি"), "Transport", "expense"),
    (("tea", "cha", "coffee", "breakfast", "lunch", "dinner", "biryani", "kacchi", "khichuri", "burger", "pizza", "snacks", "bazar", "grocery", "groceries", "rice", "egg", "milk", "fish", "meat", "vegetable", "food", "khabar", "nasta", "চা", "নাস্তা", "খাবার", "বাজার", "দুপুরের খাবার"), "Food", "expense"),
    (("desco", "dpdc", "nesco", "wasa", "titas", "gas", "electric", "electricity", "wifi", "broadband", "internet", "recharge", "flexiload", "topup", "top-up", "mobile bill", "utility", "utilities", "bill", "বিকাশ ফি", "রিচার্জ", "বিল", "বিদ্যুৎ", "গ্যাস", "ইন্টারনেট"), "Utilities", "expense"),
    (("medicine", "pharmacy", "doctor", "hospital", "clinic", "diagnostic", "test", "med", "osudh", "dawai", "ওষুধ", "ডাক্তার", "হাসপাতাল"), "Health", "expense"),
    (("house rent", "basha vara", "rent", "flat rent", "mess rent", "বাসা ভাড়া", "ভাড়া"), "Rent", "expense"),
    (("tuition", "tutor", "book", "books", "pen", "exam", "semester", "course", "coaching", "school", "college", "university", "বই", "টিউশন", "পড়াশোনা"), "Education", "expense"),
    (("movie", "cinema", "cineplex", "netflix", "spotify", "youtube", "game", "games", "gaming", "ticket", "সিনেমা"), "Entertainment", "expense"),
    (("shirt", "pant", "panjabi", "saree", "shoe", "shoes", "daraz", "chaldal", "aarong", "cloth", "clothes", "shopping", "kapor", "শপিং", "জামা", "জুতা"), "Shopping", "expense"),
    (("gift", "salami", "eid", "birthday", "present", "উপহার", "সালামি"), "Gifts", "expense"),
    (("flight", "hotel", "resort", "cox", "sylhet", "bandarban", "sajek", "travel", "tour", "ভ্রমণ"), "Travel", "expense"),
]

_BANGLA_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def normalize_digits(text: str) -> str:
    return text.translate(_BANGLA_DIGITS)


def _parse_amount(raw: str) -> float | None:
    cleaned = raw.replace(",", "").strip()
    try:
        val = float(cleaned)
        return round(val, 2) if val > 0 else None
    except ValueError:
        return None


def suggest_category(text: str, active_categories: list[str] | None = None, entry_type: str = "expense") -> str:
    lower = normalize_digits(text).lower()
    available = set(active_categories) if active_categories else None
    for keywords, cat, kind in KEYWORD_CATEGORIES:
        if entry_type and kind != entry_type:
            continue
        for kw in keywords:
            if kw in lower:
                if available is None or cat in available:
                    return cat
    fallback = "Other Income" if entry_type == "income" else "Other"
    if available and fallback not in available:
        return next(iter(available), fallback)
    return fallback


def detect_wallet_hint(text: str) -> str | None:
    lower = text.lower()
    for name in ("bkash", "nagad", "rocket", "upay", "dbbl", "city", "brac", "ebl", "islami", "bank"):
        if name in lower:
            return name
    if re.search(r"\bcash\b(?!\s+(?:in|out)\b)", lower):
        return "cash"
    if "trxid" in lower or "fee tk" in lower:
        return "bkash"
    if "txnid" in lower or "charge tk" in lower:
        return "nagad"
    return None


def parse_bd_sms(raw: str, active_categories: list[str] | None = None) -> dict[str, Any] | None:
    """Parse common bKash, Nagad, Rocket, and Bangladeshi bank SMS alerts cleanly."""
    text = normalize_digits(raw).strip()
    if not text:
        return None
    lower = text.lower()

    # Heuristic: check if it looks like an SMS notification
    is_sms = any(k in lower for k in (
        "trxid", "txn", "balance", "a/c", "debited", "credited", "cash out", "cash in",
        "send money", "received tk", "payment", "fee tk", "charge tk", "mobile recharge", "bkash", "nagad", "rocket"
    ))
    if not is_sms:
        return None

    amt_match = re.search(r"(?:tk|bdt|৳)\s*([\d,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)
    if not amt_match:
        amt_match = re.search(r"(?:debited|credited|paid|received|payment of)\s*(?:tk|bdt)?\s*([\d,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)
    if not amt_match:
        return None
    amount = _parse_amount(amt_match.group(1))
    if amount is None:
        return None

    fee_match = re.search(r"(?:fee|charge|comm(?:ission)?)\s*(?:is)?\s*(?:tk|bdt|৳)?\s*([\d,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)
    fee = _parse_amount(fee_match.group(1)) if fee_match else 0.0
    if fee is None:
        fee = 0.0

    wallet_hint = detect_wallet_hint(text)

    # 1. Cash Out -> transfer to Cash (+ optional fee)
    if "cash out" in lower:
        target = re.search(r"cash out\s+(?:tk|bdt)?\s*[\d,.]+\s+(?:to|from)?\s*([A-Za-z0-9_+*-]+)", text, re.IGNORECASE)
        desc = f"{(wallet_hint or 'Mobile').title()} Cash Out"
        if target:
            desc += f" ({target.group(1)})"
        return {
            "kind": "transfer",
            "amount": amount,
            "fee": fee,
            "from_wallet_hint": wallet_hint,
            "to_wallet_hint": "cash",
            "description": desc[:240],
        }

    # 2. Cash In / Received / Credited -> income
    if any(k in lower for k in ("you have received", "received tk", "cash in", "credited")):
        sender = re.search(r"(?:from|by)\s+([A-Za-z0-9_+*.-]+)", text, re.IGNORECASE)
        cat = "Other Income"
        if active_categories and cat not in active_categories:
            cat = "Salary" if "Salary" in active_categories else suggest_category(text, active_categories, "income")
        desc = "Received" if "received" in lower else "Cash In" if "cash in" in lower else "Bank Credit"
        if sender:
            desc += f" from {sender.group(1)}"
        return {
            "kind": "transaction",
            "type": "income",
            "amount": amount,
            "category": cat,
            "wallet_hint": wallet_hint,
            "description": desc[:240],
        }

    # 3. Mobile Recharge -> Utilities expense
    if "recharge" in lower or "flexiload" in lower or "top-up" in lower:
        cat = "Utilities" if (not active_categories or "Utilities" in active_categories) else suggest_category(text, active_categories, "expense")
        num = re.search(r"(?:to|for)\s+(01\d{9})", text)
        desc = f"Mobile Recharge {num.group(1)}" if num else "Mobile Recharge"
        return {
            "kind": "transaction",
            "type": "expense",
            "amount": round(amount + fee, 2),
            "category": cat,
            "wallet_hint": wallet_hint,
            "description": desc[:240],
        }

    # 4. Payment / Send Money / Debited / Card purchase -> expense
    merchant_match = re.search(r"(?:to|at)\s+([A-Za-z0-9&'., _-]{2,40}?)(?:\s+(?:successful|is|on|ref|trxid|fee|charge|balance|\.|$))", text, re.IGNORECASE)
    merchant = merchant_match.group(1).strip(" .,-") if merchant_match else ""
    base_label = "Send Money" if "send money" in lower else "Payment" if "payment" in lower else "Card Spend"
    desc = f"{base_label}: {merchant}" if merchant else base_label
    cat = suggest_category(merchant or text, active_categories, "expense")
    total_expense = round(amount + fee, 2) if fee > 0 else amount
    return {
        "kind": "transaction",
        "type": "expense",
        "amount": total_expense,
        "category": cat,
        "wallet_hint": wallet_hint,
        "description": desc[:240],
    }


def parse_quick_text(raw: str, active_categories: list[str] | None = None) -> dict[str, Any] | None:
    """Parse short natural text like 'rickshaw 50' or 'salary 50000' without AI."""
    sms = parse_bd_sms(raw, active_categories)
    if sms:
        return sms
    text = normalize_digits(raw).strip()
    if not text:
        return None
    # Match amount with optional k/hajar suffix e.g. 500, 1.5k, 200 tk
    match = re.search(r"(?:^|\s)(?:tk|bdt|৳)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(k|hajar|tk|bdt|৳)?(?:\s|$)", text, re.IGNORECASE)
    if not match:
        return None
    raw_num = match.group(1).replace(",", "")
    try:
        amount = float(raw_num)
    except ValueError:
        return None
    suffix = (match.group(2) or "").lower()
    if suffix in ("k", "hajar"):
        amount *= 1000
    amount = round(amount, 2)
    if amount <= 0:
        return None

    # Clean description by removing the matched amount token and wallet hints if trailing
    cleaned = (text[:match.start()] + " " + text[match.end():]).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,-")
    lower = text.lower()
    entry_type = "income" if any(k in lower for k in ("salary", "beton", "freelance", "income", "received", "bonus", "allowance", "বেতন")) else "expense"
    cat = suggest_category(text, active_categories, entry_type)
    return {
        "kind": "transaction",
        "type": entry_type,
        "amount": amount,
        "category": cat,
        "wallet_hint": detect_wallet_hint(text),
        "description": (cleaned or cat)[:240],
    }
