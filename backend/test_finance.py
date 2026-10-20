"""Financial invariants exercised across independent cloud requests, with no real account writes."""
import base64
from datetime import datetime
import unittest
from unittest.mock import patch

from backend import test_integrations as cloud_test
from backend.workspace import validate_workspace
from backend import ai


class FinanceTests(unittest.TestCase):
    setUp = cloud_test.CloudTests.setUp
    tearDown = cloud_test.CloudTests.tearDown
    read = cloud_test.CloudTests.read
    save = cloud_test.CloudTests.save
    get_state = cloud_test.CloudTests.get_state
    add = cloud_test.CloudTests.add

    def post(self, path, body):
        return self.client.post('/api' + path, headers=self.headers, json=body)

    def put(self, path, body):
        return self.client.put('/api' + path, headers=self.headers, json=body)

    def fund(self, amount=1000):
        response = self.client.patch('/api/wallets/1', headers=self.headers, json={'opening_balance': amount})
        self.assertEqual(response.status_code, 200, response.text)

    def test_existing_loan_records_debt_without_inventing_cash(self):
        self.fund()
        result = self.post('/loans', {'party': 'Past loan', 'direction': 'borrowed', 'amount': 5000,
            'affect_wallet': False, 'date': '2026-09-10T12:00:00+06:00'})
        self.assertEqual(result.status_code, 201, result.text)
        state = self.get_state()
        self.assertEqual(state['wallets'][0]['balance'], 1000)
        self.assertEqual(state['planning']['owed'], 5000)
        self.assertEqual(state['planning']['income'], 0)
        self.assertEqual(state['movements'], [])
        self.assertTrue(state['loans'][0]['date'].startswith('2026-09-10'))
        validate_workspace(self.records['account-a']['data'])
        loan = state['loans'][0]['id']
        self.assertEqual(self.post(f'/loans/{loan}/repayments', {'amount': 200, 'wallet_id': 1}).status_code, 200)
        self.assertEqual(self.get_state()['wallets'][0]['balance'], 800)
        self.assertEqual(self.get_state()['planning']['owed'], 4800)
        self.assertEqual(self.post('/loans', {'party': 'New', 'direction': 'borrowed', 'amount': 100}).status_code, 422)

    def test_transfers_preserve_totals_and_survive_cloud_hydration(self):
        self.fund()
        result = self.post('/transfers', {'from_wallet_id': 1, 'to_wallet_id': 2, 'amount': 300})
        self.assertEqual(result.status_code, 201, result.text)
        state = self.get_state()
        self.assertEqual([w['balance'] for w in state['wallets']], [700, 300])
        self.assertEqual(state['planning']['income'], 0)
        self.assertEqual(state['planning']['spent'], 0)
        self.assertEqual(self.get_state('account-b')['movements'], [])
        self.assertEqual(self.post('/transfers', {'from_wallet_id': 1, 'to_wallet_id': 1, 'amount': 10}).status_code, 422)
        self.assertEqual(self.post('/transfers', {'from_wallet_id': 1, 'to_wallet_id': 2, 'amount': 701}).status_code, 422)
        self.assertEqual(len(self.get_state()['movements']), 1)

    def test_reserved_savings_protect_funds_and_do_not_change_cash(self):
        self.fund()
        self.assertEqual(self.post('/goals', {'name': 'Emergency fund', 'target': 5000}).status_code, 201)
        goal_id = self.get_state()['goals'][0]['id']
        result = self.post('/savings', {'amount': 400, 'wallet_id': 1, 'category': 'Savings', 'goal_id': goal_id})
        self.assertEqual(result.status_code, 201, result.text)
        state = self.get_state()
        self.assertEqual(state['wallets'][0]['balance'], 1000)
        self.assertEqual(state['planning']['available'], 600)
        self.assertEqual(state['planning']['monthly_saved'], 400)
        self.assertEqual(self.post('/transfers', {'amount': 601, 'from_wallet_id': 1, 'to_wallet_id': 2}).status_code, 422)
        self.assertEqual(self.post('/savings', {'amount': 601, 'wallet_id': 1, 'category': 'Savings'}).status_code, 422)
        self.client.delete('/api/goals/'+str(goal_id), headers=self.headers)
        self.assertIsNone(self.get_state()['savings'][0]['goal_id'])
        self.client.delete('/api/savings/'+str(state['savings'][0]['id']), headers=self.headers)
        self.assertEqual(self.get_state()['planning']['available'], 1000)

    def test_loans_repayments_are_not_income_or_expenses(self):
        self.fund()
        result = self.post('/loans', {'party': 'Friend', 'direction': 'borrowed', 'amount': 500, 'wallet_id': 1})
        self.assertEqual(result.status_code, 201, result.text)
        state = self.get_state()
        self.assertEqual(state['wallets'][0]['balance'], 1500)
        self.assertEqual(state['planning']['owed'], 500)
        self.assertEqual(state['planning']['net_position'], 1000)
        lid = state['loans'][0]['id']
        self.assertEqual(self.post(f'/loans/{lid}/repayments', {'amount': 200, 'wallet_id': 1}).status_code, 200)
        self.assertEqual(self.post(f'/loans/{lid}/repayments', {'amount': 301, 'wallet_id': 1}).status_code, 422)
        self.assertEqual(self.get_state()['planning']['owed'], 300)
        self.assertEqual(self.post('/loans', {'party': 'Sibling', 'direction': 'lent', 'amount': 100, 'wallet_id': 1}).status_code, 201)
        state = self.get_state()
        self.assertEqual(state['planning']['receivable'], 100)
        self.assertEqual(state['planning']['net_position'], 1000)
        self.assertEqual(state['planning']['income'], 0)
        self.assertEqual(state['planning']['spent'], 0)

    def test_category_rename_archive_and_cloud_roundtrip(self):
        category = {'name': 'Groceries', 'kind': 'expense', 'bucket': 'needs', 'icon': 'shopping', 'color': '#123456', 'archived': False}
        self.assertEqual(self.post('/categories', category).status_code, 201)
        self.assertEqual(self.add(category='Groceries').status_code, 201)
        self.assertEqual(self.put('/budgets', {'category': 'Groceries', 'amount': 500}).status_code, 200)
        cid = next(c['id'] for c in self.get_state()['category_details'] if c['name'] == 'Groceries')
        category['name'] = 'Market'
        self.assertEqual(self.put(f'/categories/{cid}', category).status_code, 200)
        state = self.get_state()
        self.assertEqual(state['transactions'][0]['category'], 'Market')
        self.assertEqual(state['budgets'][0]['category'], 'Market')
        category['archived'] = True
        self.put(f'/categories/{cid}', category)
        self.assertEqual(self.add(category='Market').status_code, 422)
        self.assertEqual(self.get_state()['transactions'][0]['category'], 'Market')
        self.assertEqual(self.post('/categories', category | {'name': 'market'}).status_code, 409)

    def test_plan_validation_atomic_allocation_and_pacing(self):
        plan = {'monthly_budget': 24000, 'planned_income': 30000, 'savings_target': 6000,
            'needs_percent': 50, 'wants_percent': 30, 'savings_percent': 20,
            'allocations': [{'category': 'Food', 'amount': 10000}, {'category': 'Transport', 'amount': 5000}]}
        self.assertEqual(self.put('/plan', plan).status_code, 200)
        self.assertEqual(self.put('/plan', plan | {'wants_percent': 31}).status_code, 422)
        self.assertEqual(self.put('/plan', plan | {'monthly_budget': 30001}).status_code, 422)
        self.assertEqual(self.put('/plan', plan | {'allocations': [{'category': 'Food', 'amount': 25000}]}).status_code, 422)
        state = self.get_state()
        self.assertEqual(state['planning']['budget'], 24000)
        self.assertEqual(len(state['budgets']), 2)
        self.add(amount=70)
        state = self.get_state()
        p = state['planning']
        self.assertEqual(p['spent'], 70)
        self.assertEqual(p['remaining'], 23930)
        self.assertEqual(p['today_remaining'], max(0, round(p['daily_limit']-70, 2)))
        self.assertEqual(p['groups'][0]['target'], 15000)
        self.assertEqual(p['groups'][0]['spent'], 70)

    def test_ai_previews_never_apply_plan_or_transactions(self):
        self.client.patch("/api/settings", headers=self.headers, json={"ai_enabled": True})
        def suggest(prompt, text, validator):
            return validator({'monthly_budget': 1000, 'planned_income': 1500, 'savings_target': 500,
                'needs_percent': 50, 'wants_percent': 30, 'savings_percent': 20,
                'allocations': [{'category': 'Food', 'amount': 1000}], 'summary': 'Review this plan.'}) | {'provider': 'Test'}
        with patch('backend.ai.extract', side_effect=suggest):
            result = self.post('/plan/preview', {'message': 'Income 1500, budget 1000.'})
            self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.get_state()['budgets'], [])
        self.assertEqual(self.get_state()['planning']['budget'], 0)
        with patch('backend.ai.extract', side_effect=lambda p,t,v: v({'answer': 'Set your income first.'}) | {'provider': 'Test'}):
            self.assertEqual(self.post('/advisor', {'message': 'Help me budget.'}).status_code, 200)
        self.assertEqual(len(self.get_state()['advisor_messages']), 2)
        self.assertEqual(self.get_state('account-b')['advisor_messages'], [])
        self.assertEqual(self.get_state()['transactions'], [])
        with patch('backend.ai.extract', side_effect=ai.ProviderError('No providers available')):
            self.assertEqual(self.post('/advisor', {'message': 'Help'}).status_code, 503)

    def test_balance_import_after_transfer_includes_all_movements(self):
        self.fund()
        self.post('/transfers', {'amount': 100, 'from_wallet_id': 1, 'to_wallet_id': 2})
        result = self.post('/wallets/balances', {'wallets': [{'name': 'Cash', 'balance': 700, 'expected_balance': 900}]})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.get_state()['wallets'][0]['balance'], 700)
        self.assertEqual(self.get_state()['wallets'][1]['balance'], 100)

    def test_snapshot_backwards_compatibility_and_invalid_references(self):
        self.fund()
        raw = self.records['account-a']['data']
        for name in ('category_details', 'movements', 'loans', 'savings', 'goals', 'advisor_messages'):
            raw.pop(name, None)
        raw['settings'] = {'name': 'Old account', 'theme': 'dark', 'review_before_saving': True}
        self.assertEqual(len(validate_workspace(raw)['category_details']), 23)
        self.assertEqual(self.get_state()['settings']['name'], 'Old account')
        raw['movements'] = [{'id': 1, 'amount': 5, 'description': 'Bad reference', 'kind': 'transfer', 'from_wallet_id': 1, 'to_wallet_id': 99, 'date': '2026-10-18T12:00:00+06:00'}]
        with self.assertRaises(ValueError):
            validate_workspace(raw)

    def test_receipt_rejects_non_image_and_is_preview_only(self):
        self.client.patch("/api/settings", headers=self.headers, json={"ai_enabled": True})
        result = self.post('/extract', {'text': 'Receipt', 'mode': 'transactions', 'image': base64.b64encode(b'<svg>invalid image</svg>').decode()})
        self.assertEqual(result.status_code, 422)
        def extract(prompt, text, validator):
            self.assertIsInstance(text, dict)
            return validator({'wallets': [], 'transactions': [{'description': 'Receipt', 'amount': 70, 'category': 'Food', 'type': 'expense', 'wallet_id': 1}]}) | {'provider': 'Test'}
        image = base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'\x00'*20).decode()
        with patch('backend.ai.extract', side_effect=extract):
            result = self.post('/extract', {'text': 'Read receipt', 'mode': 'transactions', 'image': image, 'mime_type': 'image/png'})
            self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.get_state()['transactions'], [])

    def test_regular_tracker_quantities_and_category_rename_persist(self):
        result = self.post('/regulars', {'name': 'Lunches', 'category': 'Food', 'daily_limit': 150, 'unit': 'meals'})
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(self.add(amount=100, quantity=2, unit='meals').status_code, 201)
        state = self.get_state()
        self.assertEqual(state['transactions'][0]['quantity'], 2)
        self.assertEqual(state['transactions'][0]['unit'], 'meals')
        self.assertEqual(state['regulars'][0]['daily_limit'], 150)
        cat = next(c for c in state['category_details'] if c['name'] == 'Food')
        cid = cat.pop('id')
        cat['name'] = 'Meals'
        self.assertEqual(self.put('/categories/'+str(cid), cat).status_code, 200)
        self.assertEqual(self.get_state()['regulars'][0]['category'], 'Meals')
        self.assertEqual(self.get_state()['transactions'][0]['category'], 'Meals')

    def test_successful_writes_return_new_revision_for_consecutive_changes(self):
        first = self.client.patch('/api/settings', headers=self.headers | {'X-Workspace-Revision': '0'}, json={'theme': 'light'})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.headers['X-Workspace-Revision'], '1')
        second = self.client.patch('/api/settings', headers=self.headers | {'X-Workspace-Revision': first.headers['X-Workspace-Revision']}, json={'theme': 'dark'})
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(second.headers['X-Workspace-Revision'], '2')

    def test_glass_theme_is_persisted_and_account_owned(self):
        result = self.client.patch('/api/settings', headers=self.headers, json={'theme': 'glass'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.get_state()['settings']['theme'], 'glass')
        self.assertEqual(self.get_state('account-b')['settings']['theme'], 'dark')
        invalid = self.client.patch('/api/settings', headers=self.headers, json={'theme': 'invalid'})
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(self.get_state()['settings']['theme'], 'glass')

    def test_language_preference_is_validated_persisted_and_account_owned(self):
        result = self.client.patch('/api/settings', headers=self.headers, json={'language': 'bn'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.get_state()['settings']['language'], 'bn')
        self.assertEqual(self.get_state('account-b')['settings']['language'], 'en')
        invalid = self.client.patch('/api/settings', headers=self.headers, json={'language': 'xx'})
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(self.get_state()['settings']['language'], 'bn')
        self.client.patch('/api/settings', headers=self.headers, json={'language': 'en'})
        self.assertEqual(self.get_state()['settings']['language'], 'en')

    def test_correcting_movements_keeps_loan_totals_consistent(self):
        self.fund()
        self.post('/loans', {'party': 'Friend', 'direction': 'borrowed', 'amount': 500, 'wallet_id': 1})
        loan_id = self.get_state()['loans'][0]['id']
        self.post(f'/loans/{loan_id}/repayments', {'amount': 200, 'wallet_id': 1})
        movements = self.get_state()['movements']
        original = next(m for m in movements if m['kind'] == 'loan')
        repayment = next(m for m in movements if m['kind'] == 'repayment')
        self.assertEqual(self.client.delete('/api/movements/'+str(original['id']), headers=self.headers).status_code, 422)
        self.assertEqual(self.client.delete('/api/movements/'+str(repayment['id']), headers=self.headers).status_code, 200)
        self.assertEqual(self.get_state()['planning']['owed'], 500)
        self.assertEqual(self.client.delete('/api/movements/'+str(original['id']), headers=self.headers).status_code, 200)
        state = self.get_state()
        self.assertEqual(state['loans'], [])
        self.assertEqual(state['movements'], [])
        self.assertEqual(state['wallets'][0]['balance'], 1000)


if __name__ == '__main__':
    unittest.main()
