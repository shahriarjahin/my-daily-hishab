"""Read-only, account-scoped PDF statements. No financial records are changed."""
import calendar
from datetime import date
from decimal import Decimal
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Literal
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlmodel import Session
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from .api import now, local_date, require_row
from .database import get_session
from .finance import rows
from .models import AppSetting, Wallet, Transaction, Movement

router = APIRouter(prefix="/api/statements")
STATIC = Path(__file__).parent / "static"
Period = Literal["1", "3", "6", "12", "custom"]


def statement_period(period: Period, start: date | None, end: date | None, today: date):
    if period == "custom":
        if start is None or end is None:
            raise HTTPException(422, "Choose both statement dates.")
    else:
        end = today
        month_index = end.year * 12 + end.month - 1 - int(period)
        year, month = divmod(month_index, 12)
        start = date(year, month + 1, min(end.day, calendar.monthrange(year, month + 1)[1]))
    if start > end or end > today:
        raise HTTPException(422, "Choose a valid date range ending today or earlier.")
    return start, end


def statement_data(session, start: date, end: date, wallet_id: int | None):
    wallets = rows(session, Wallet)
    if wallet_id is not None:
        require_row(session, Wallet, wallet_id)
        wallets = [w for w in wallets if w.id == wallet_id]
    selected = {w.id for w in wallets}
    names = {w.id: w.name for w in rows(session, Wallet)}
    events = []
    opening = Decimal(0)
    def event(when, reference, description, debit=0, credit=0):
        events.append({"date": local_date(when), "reference": reference, "description": description,
                       "debit": Decimal(str(debit)), "credit": Decimal(str(credit))})
    for wallet in wallets:
        if wallet.created_at is None or local_date(wallet.created_at).date() < start:
            opening += Decimal(str(wallet.opening_balance))
        elif wallet.opening_balance:
            value = Decimal(str(wallet.opening_balance))
            event(wallet.created_at, f"OPEN-{wallet.id:06d}", "Opening balance / " + wallet.name,
                  debit=max(Decimal(0), -value), credit=max(Decimal(0), value))
    for t in rows(session, Transaction):
        if t.wallet_id in selected:
            event(t.date, f"TX-{t.id:06d}", f"{t.description} / {t.category} / {names[t.wallet_id]}",
                  debit=t.amount if t.type == "expense" else 0, credit=t.amount if t.type == "income" else 0)
    for m in rows(session, Movement):
        debit = m.amount if m.from_wallet_id in selected else 0
        credit = m.amount if m.to_wallet_id in selected else 0
        if debit or credit:
            source = names.get(m.from_wallet_id, "External")
            target = names.get(m.to_wallet_id, "External")
            label = "Loan repayment (expense)" if m.kind == "repayment" and m.from_wallet_id else m.kind.title()
            event(m.date, f"MV-{m.id:06d}", f"{m.description} / {label} / {source} -> {target}", debit, credit)
    events.sort(key=lambda e: (e["date"], e["reference"]))
    included = []
    for item in events:
        day = item["date"].date()
        if day < start:
            opening += item["credit"] - item["debit"]
        elif day <= end:
            included.append(item)
    balance = opening
    for item in included:
        balance += item["credit"] - item["debit"]
        item["balance"] = balance
    return {"wallet": wallets[0].name if wallet_id is not None else "All wallets (combined)",
            "opening": opening, "closing": balance, "entries": included,
            "debit": sum((e["debit"] for e in included), Decimal(0)),
            "credit": sum((e["credit"] for e in included), Decimal(0))}


@lru_cache(maxsize=1)
def register_fonts():
    for name, filename in [("Hishab", "NotoSansBengali-400.ttf"), ("HishabBold", "NotoSansBengali-600.ttf")]:
        pdfmetrics.registerFont(TTFont(name, str(STATIC / filename), shapable=True))
    pdfmetrics.registerFontFamily("Hishab", normal="Hishab", bold="HishabBold")


class StatementCanvas(Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.saved_pages = []
    def showPage(self):
        self.saved_pages.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        pages = len(self.saved_pages)
        for state in self.saved_pages:
            self.__dict__.update(state)
            self.setStrokeColor(colors.HexColor("#cdd3d0"))
            self.line(34, 51, A4[0]-34, 51)
            self.drawImage(str(STATIC / "digitxbd-logo.png"), 34, 13, width=68, height=30,
                           preserveAspectRatio=True, anchor="sw", mask="auto")
            self.setFont("Helvetica", 7)
            self.setFillColor(colors.HexColor("#66716b"))
            self.drawCentredString(A4[0]/2, 33, "Computer-generated personal finance statement. No signature required.")
            self.drawCentredString(A4[0]/2, 22, "Generated by Hishab. Not a bank-issued statement.")
            self.drawRightString(A4[0]-34, 33, f"Page {self._pageNumber} of {pages}")
            super().showPage()
        super().save()


def render_statement(data, name, currency, start, end, generated):
    register_fonts()
    out = BytesIO()
    document = SimpleDocTemplate(out, pagesize=A4, rightMargin=34, leftMargin=34,
        topMargin=90, bottomMargin=65, title="Hishab account statement", author="Hishab / DigitXBD")
    normal = ParagraphStyle("statement", fontName="Hishab", fontSize=8, leading=12, shaping=1,
                            textColor=colors.HexColor("#192c26"), wordWrap="CJK")
    right = ParagraphStyle("amount", parent=normal, alignment=2)
    bold = ParagraphStyle("label", parent=normal, fontName="HishabBold")
    def para(value, style=normal):
        return Paragraph(escape(str(value)).replace("\n", "<br/>"), style)
    def number(value):
        return f"{value:,.2f}"
    def header(canvas, doc):
        canvas.saveState()
        canvas.drawImage(str(STATIC / "hishab-logo-v2.png"), 34, A4[1]-75, width=55, height=55,
                         preserveAspectRatio=True, mask="auto")
        canvas.setFont("Helvetica-Bold", 17)
        canvas.setFillColor(colors.HexColor("#163d32"))
        canvas.drawString(102, A4[1]-43, "HISHAB")
        canvas.setFont("Helvetica", 8)
        canvas.drawString(102, A4[1]-58, "PERSONAL FINANCE")
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawRightString(A4[0]-34, A4[1]-43, "ACCOUNT STATEMENT")
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(A4[0]-34, A4[1]-59, f"{start:%d %b %Y} to {end:%d %b %Y}")
        canvas.restoreState()
    width = A4[0]-68
    details = Table([
        [para("ACCOUNT TITLE", bold), para(name or "Hishab user"), para("CURRENCY", bold), para(currency)],
        [para("WALLET", bold), para(data["wallet"]), para("GENERATED", bold), para(generated.strftime("%d %b %Y %H:%M")+" (Dhaka)")],
    ], colWidths=[82, 190, 66, width-338])
    details.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("BOTTOMPADDING",(0,0),(-1,-1),9)]))
    story = [details, Spacer(1, 12)]
    summary = Table([[para("Opening balance",bold),para("Money out (debit)",bold),para("Money in (credit)",bold),para("Closing balance",bold)],
                     [para(number(data[k]),bold) for k in ("opening","debit","credit","closing")]],colWidths=[width/4]*4)
    summary.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#edf4f0")),("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8)]))
    story += [summary, Spacer(1,14), para(f"STATEMENT FOR THE PERIOD: {start:%d %b %Y} to {end:%d %b %Y}",bold), Spacer(1,7)]
    table_rows = [[para(h,bold) for h in ["Date / time", "Reference", "Description", "Debit", "Credit", "Balance"]],
                  ["", "", para("BALANCE AT PERIOD START",bold), "", "", para(number(data["opening"]),right)]]
    for e in data["entries"]:
        table_rows.append([para(e["date"].strftime("%d %b %Y\n%H:%M")),para(e["reference"]),para(e["description"]),
                           para(number(e["debit"]),right),para(number(e["credit"]),right),para(number(e["balance"]),right)])
    if not data["entries"]:
        table_rows.append(["", "", para("No transactions in this period."), "", "", ""])
    table_rows.append(["", "", para("TOTAL / CLOSING BALANCE",bold),para(number(data["debit"]),right),para(number(data["credit"]),right),para(number(data["closing"]),right)])
    ledger = Table(table_rows, colWidths=[64,62,width-64-62-64*3,64,64,64], repeatRows=1, hAlign="LEFT")
    ledger.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LINEABOVE",(0,0),(-1,0),1,colors.HexColor("#163d32")),("LINEBELOW",(0,0),(-1,0),1,colors.HexColor("#163d32")),
        ("ROWBACKGROUNDS",(0,1),(-1,-2),[colors.white,colors.HexColor("#f7f9f8")]),
        ("LINEABOVE",(0,-1),(-1,-1),0.8,colors.HexColor("#163d32")),
        ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),
        ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)]))
    story += [ledger,Spacer(1,12),para(f"{len(data['entries'])} entries. Times use Asia/Dhaka (UTC+06:00). Transfers and loan movements are shown once. Savings reservations do not move cash.")]
    document.build(story,onFirstPage=header,onLaterPages=header,canvasmaker=StatementCanvas)
    return out.getvalue()


@router.get("/pdf")
def download_statement(period: Period = "1", start: date | None = None, end: date | None = None,
                       wallet_id: int | None = Query(default=None, gt=0), session: Session = Depends(get_session)):
    generated = now()
    start, end = statement_period(period,start,end,generated.date())
    data = statement_data(session,start,end,wallet_id)
    settings = session.get(AppSetting,1) or AppSetting()
    result = render_statement(data,settings.name,settings.currency,start,end,generated)
    return Response(result,media_type="application/pdf",headers={"Content-Disposition":
        f'attachment; filename="hishab-statement-{start.isoformat()}-{end.isoformat()}.pdf"', "Cache-Control":"no-store"})
