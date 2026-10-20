"""Generate reproducible fictional showcase records; never connects to an account."""
import calendar
import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

from backend.models import default_categories
from backend.workspace import validate_workspace


def generate():
    rng = random.Random(20261020)
    end = date(2026, 10, 20)
    start = date(2025, 5, 1)
    stamp = lambda d, h=12: f"{d.isoformat()}T{h:02}:00:00+06:00"
    w = dict(schema_version=1, wallets=[], transactions=[], budgets=[],
             settings=dict(name="Demo User", theme="light", language="en", tutorial_seen=True,
                           ai_enabled=False, review_before_saving=True, currency="BDT", bottom_nav="wallets",
                           monthly_budget=58000, planned_income=90000, savings_target=18000,
                           needs_percent=50, wants_percent=30, savings_percent=20),
             category_details=default_categories(), movements=[], goals=[], savings=[], loans=[],
             advisor_messages=[], regulars=[])
    for i, (name, opening) in enumerate([("Cash", 18000), ("City Bank", 120000), ("bKash", 10000),
                                         ("PrimeNOW", 30000), ("Sonali Bank", 50000)], 1):
        w["wallets"].append(dict(id=i, name=name, opening_balance=opening, created_at=stamp(start, 0)))
    def add(key, **row):
        w[key].append(dict(id=len(w[key])+1, **row))
    def tx(d, description, amount, category, wallet=1, kind="expense", quantity=None, unit=""):
        add("transactions", description=description, amount=amount, category=category, wallet_id=wallet,
            type=kind, date=stamp(d, rng.randint(8, 21)), quantity=quantity, unit=unit)
    months = [(y,m) for y in (2025,2026) for m in range(1,13) if (2025,5)<=(y,m)<=(2026,10)]
    for index,(y,m) in enumerate(months):
        first=date(y,m,1)
        tx(first,"Monthly salary",72000+index*650,"Salary",2,"income")
        tx(date(y,m,10),"Freelance design project",rng.randrange(7000,14000,500),"Freelance",4,"income")
        tx(date(y,m,5),"Apartment rent",16000,"Rent",2)
        tx(date(y,m,8),"Electricity and internet",rng.randrange(2400,3400,100),"Utilities",3)
        for daynum in (2,12):
            add("movements", description="Cash withdrawal", amount=18000, from_wallet_id=2,
                to_wallet_id=1, kind="transfer", loan_id=None, date=stamp(date(y,m,daynum)))
        add("movements",description="bKash top-up",amount=11000,from_wallet_id=2,to_wallet_id=3,
            kind="transfer",loan_id=None,date=stamp(date(y,m,3)))
        add("movements",description="Savings account transfer",amount=8000,from_wallet_id=2,to_wallet_id=5,
            kind="transfer",loan_id=None,date=stamp(date(y,m,4)))
    d=start
    while d<=end:
        tx(d,"Breakfast",rng.choice([60,80,100,120]),"Food",quantity=1,unit="meal")
        tx(d,"Lunch",rng.choice([140,160,180,220]),"Food",quantity=1,unit="meal")
        tx(d,"Evening groceries",rng.choice([120,180,250,320]),"Food",rng.choice([1,3]))
        tx(d,"Office commute",rng.choice([40,60,80,100]),"Transport")
        tx(d,"Tea and snacks",rng.choice([30,40,50,60]),"Food",quantity=2,unit="cups")
        tx(d,"Return commute",rng.choice([40,60,80,100]),"Transport",rng.choice([1,3]))
        if d.weekday()==4: tx(d,"Weekend dinner",rng.randrange(400,850,50),"Entertainment",3)
        if d.day in (7,19): tx(d,"Household essentials",rng.randrange(600,1800,100),"Shopping",4)
        if d.day==15: tx(d,"Pharmacy and checkup",rng.randrange(300,1000,100),"Health",1)
        if d.day==18: tx(d,"Online learning subscription",650,"Education",4)
        if d.day==20: tx(d,"Family gift",1000,"Gifts",1)
        d+=timedelta(days=1)
    for name,target,due,color in [("Emergency fund",180000,"2027-06-01","#4caf88"),
                                  ("Cox’s Bazar holiday",65000,"2027-03-01","#dca33b"),
                                  ("New laptop",120000,"2027-08-01","#56bfc2"),
                                  ("Professional course",35000,"2027-02-01","#bf94d3")]:
        add("goals",name=name,target=target,due_date=due,color=color)
    for i,(y,m) in enumerate(months):
        for goal,amount,wallet in [(1,6000,5),(2,1800,4),(3,2500,5),(4,800,4)]:
            add("savings",amount=amount,category="Bank Deposit",wallet_id=wallet,goal_id=goal,
                note="Monthly goal allocation",date=stamp(date(y,m,6)))
    for category,amount in [("Food",19000),("Transport",6000),("Rent",16000),("Utilities",3500),
                            ("Shopping",5000),("Health",2500),("Entertainment",3500),("Education",1000),("Gifts",1500)]:
        add("budgets",category=category,amount=amount)
    for party,direction,amount,repaid in [("Demo friend — Rahim","borrowed",12000,4000),
                                          ("Demo colleague — Mina","lent",8000,3000)]:
        add("loans",party=party,direction=direction,amount=amount,repaid=repaid,date=stamp(date(2026,9,15)),
            due_date="2026-12-01",note="Fictional historical loan; original cash no longer held")
        lid=len(w["loans"])
        add("movements",description="Partial loan repayment",amount=repaid,kind="repayment",loan_id=lid,
            from_wallet_id=2 if direction=="borrowed" else None,to_wallet_id=2 if direction=="lent" else None,
            date=stamp(date(2026,10,12)))
    for name,category,limit,unit in [("Meals & groceries","Food",650,"meal"),("Daily commute","Transport",220,"trip")]:
        add("regulars",name=name,category=category,daily_limit=limit,unit=unit)
    # Future dates must never leak into an historical showcase.
    for key in ("transactions","movements","savings"):
        w[key]=[r for r in w[key] if datetime.fromisoformat(r["date"]).date()<=end]
    return validate_workspace(w)


if __name__ == "__main__":
    data=generate()
    target=Path("docs/demo/hishab-demo-18-months.json")
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"{target}: {len(data['transactions'])} transactions, {len(data['movements'])} movements, {len(data['savings'])} savings")
