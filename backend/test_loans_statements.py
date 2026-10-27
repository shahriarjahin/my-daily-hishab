"""Synthetic accounts only: repayment cash/expense invariants and PDF statements."""
import unittest
from backend import test_integrations as fixtures

class LoanStatementTests(unittest.TestCase):
    setUp = fixtures.CloudTests.setUp
    tearDown = fixtures.CloudTests.tearDown
    read = fixtures.CloudTests.read
    save = fixtures.CloudTests.save
    get_state = fixtures.CloudTests.get_state
    add = fixtures.CloudTests.add

    def request(self, path, data, method="post"):
        return getattr(self.client, method)("/api"+path, headers=self.headers, json=data)

    def loan(self, affect=True, direction="borrowed"):
        self.request("/wallets/1", {"opening_balance":1000}, "patch")
        body={"party":"Test", "direction":direction, "amount":500, "affect_wallet":affect, "wallet_id":1,
              "date":"2026-09-01T10:15:00+06:00"}
        self.assertEqual(self.request("/loans",body).status_code,201)
        return {**body,"affect_wallet":False,"wallet_id":None}

    def test_repayment_counts_once_as_expense_without_double_cash_deduction(self):
        self.loan()
        self.assertEqual(self.request("/loans/1/repayments",{"wallet_id":1,"amount":100}).status_code,200)
        state=self.get_state()
        self.assertEqual(state["wallets"][0]["balance"],1400)
        self.assertEqual(state["planning"]["spent"],100)
        self.assertEqual(state["planning"]["income"],0)
        expenses=[t for t in state["transactions"] if t.get("movement_id")]
        self.assertEqual(len(expenses),1)
        self.assertEqual(expenses[0]["amount"],100)
        self.assertEqual(self.records["account-a"]["data"]["transactions"],[])
        self.assertEqual(self.client.delete("/api/movements/2",headers=self.headers).status_code,200)
        self.assertEqual(self.get_state()["planning"]["spent"],0)
        self.assertEqual(self.get_state()["wallets"][0]["balance"],1500)

    def test_received_repayment_is_not_expense_or_income(self):
        self.loan(direction="lent")
        self.request("/loans/1/repayments",{"wallet_id":1,"amount":100})
        state=self.get_state()
        self.assertEqual(state["wallets"][0]["balance"],600)
        self.assertEqual(state["planning"]["spent"],0)
        self.assertEqual(state["planning"]["income"],0)

    def test_initial_amount_edit_after_repayment_adjusts_original_cash_only(self):
        body=self.loan()
        self.request("/loans/1/repayments",{"wallet_id":1,"amount":100})
        result=self.request("/loans/1",{**body,"party":"Updated", "amount":700},"put")
        self.assertEqual(result.status_code,200,result.text)
        state=self.get_state()
        self.assertEqual(state["wallets"][0]["balance"],1600)
        self.assertEqual(state["planning"]["owed"],600)
        self.assertEqual(state["planning"]["spent"],100)
        self.assertEqual(state["movements"][0]["amount"],700)
        self.assertEqual(self.request("/loans/1",{**body,"amount":99},"put").status_code,422)
        self.assertEqual(self.request("/loans/1",{**body,"direction":"lent"},"put").status_code,422)
        self.assertEqual(self.get_state()["wallets"][0]["balance"],1600)

    def test_existing_debt_edit_does_not_invent_cash_and_lent_edit_checks_funds(self):
        body=self.loan(affect=False)
        self.request("/loans/1/repayments",{"wallet_id":1,"amount":100})
        self.assertEqual(self.request("/loans/1",{**body,"amount":900},"put").status_code,200)
        self.assertEqual(self.get_state()["wallets"][0]["balance"],900)
        self.request("/loans",{**body,"direction":"lent","affect_wallet":True,"wallet_id":1})
        result=self.request("/loans/2",{**body,"direction":"lent","amount":1000},"put")
        self.assertEqual(result.status_code,422)
        self.assertEqual(self.get_state()["wallets"][0]["balance"],400)

    def test_lowering_borrowed_principal_checks_remaining_wallet_funds(self):
        body=self.loan()
        self.add(amount=1400)
        result=self.request("/loans/1",{**body,"amount":300},"put")
        self.assertEqual(result.status_code,422)
        self.assertEqual(self.get_state()["wallets"][0]["balance"],100)
        self.assertEqual(self.get_state()["loans"][0]["amount"],500)

    def test_statement_balances_and_dates_include_cash_movements_once(self):
        from backend.statements import statement_data, statement_period
        from datetime import date
        self.loan()
        self.request("/transfers", {"from_wallet_id":1,"to_wallet_id":2,"amount":100})
        self.request("/loans/1/repayments",{"wallet_id":1,"amount":100})
        from sqlmodel import Session, create_engine
        from backend.database import init_db
        from backend.workspace import import_workspace
        engine=create_engine("sqlite://")
        init_db(engine)
        try:
            with Session(engine) as session:
                import_workspace(session, self.records["account-a"]["data"])

                data=statement_data(session,date(2026,9,1),date(2026,12,31),None)
                self.assertEqual(data["opening"],1000)
                self.assertEqual(data["closing"],1400)
                self.assertEqual(data["debit"],200)
                self.assertEqual(data["credit"],600)
                self.assertEqual(len(data["entries"]),3)
                single=statement_data(session,date(2026,9,1),date(2026,12,31),1)
                self.assertEqual(single["closing"],1300)
        finally: engine.dispose()
        self.assertEqual(statement_period("1",None,None,date(2024,3,31)),(date(2024,2,29),date(2024,3,31)))
        self.assertEqual(statement_period("3",None,None,date(2026,1,31))[0],date(2025,10,31))
        self.assertEqual(statement_period("6",None,None,date(2026,10,27))[0],date(2026,4,27))
        self.assertEqual(statement_period("12",None,None,date(2024,2,29))[0],date(2023,2,28))

    def test_statement_is_authenticated_pdf_and_custom_dates_validate(self):
        self.loan()
        url="/api/statements/pdf?period=custom&start=2026-09-01&end=2026-10-27&wallet_id=1"
        result=self.client.get(url,headers=self.headers)
        self.assertEqual(result.status_code,200,result.text[:100] if not result.content.startswith(b"%PDF") else "")
        self.assertEqual(result.headers["content-type"],"application/pdf")
        self.assertTrue(result.content.startswith(b"%PDF"))
        self.assertIn("attachment",result.headers["content-disposition"])
        self.assertEqual(result.headers["cache-control"],"no-store")
        self.assertEqual(self.client.get("/api/statements/pdf?period=custom&start=2026-10-27&end=2026-09-01",headers=self.headers).status_code,422)
        self.assertEqual(self.client.get("/api/statements/pdf?wallet_id=999",headers=self.headers).status_code,404)
        self.assertEqual(self.client.get(url).status_code,401)
        from unittest.mock import patch
        with patch("backend.statements.render_statement", return_value=b"%PDF-test") as render:
            other=self.client.get("/api/statements/pdf",headers={"x-test-user":"account-b"})
            self.assertEqual(other.status_code,200)
            self.assertEqual(render.call_args.args[0]["entries"],[])
            self.assertEqual(render.call_args.args[0]["closing"],0)


if __name__=="__main__":unittest.main()
