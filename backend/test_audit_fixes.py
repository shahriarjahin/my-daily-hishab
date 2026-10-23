"""Audit regressions. Synthetic accounts, in-memory storage and mocked providers only."""
import json
import unittest
import io
from contextlib import redirect_stderr
from pathlib import Path
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from backend import ai, cloud


class WorkspaceFixes(unittest.TestCase):
    def setUp(self):
        from backend.test_integrations import CloudTests
        self.case = CloudTests()
        self.case.setUp()

    def tearDown(self):
        self.case.tearDown()

    def test_limit_is_rejected_before_cloud_write(self):
        c = self.case
        c.add()
        workspace = c.records['account-a']['data']
        workspace['wallets'] = [dict(workspace['wallets'][0], id=i, name=f'Wallet {i}') for i in range(1, 101)]
        before = deepcopy(c.records)
        result = c.client.post('/api/wallets', headers=c.headers, json={'name': 'Overflow'})
        self.assertEqual(result.status_code, 422)
        self.assertEqual(c.records, before)
        self.assertEqual(c.client.get('/api/state', headers=c.headers).status_code, 200)

    def test_duplicate_regular_snapshot_is_rejected(self):
        c = self.case
        c.add()
        workspace = deepcopy(c.records['account-a']['data'])
        workspace['regulars'] = [dict(id=i, name=f'Tracker {i}', category='Food', daily_limit=50, unit='pcs') for i in (1, 2)]
        result = c.client.post('/api/cloud/workspace', headers=c.headers, json={'expected_revision': 1, 'data': workspace})
        self.assertEqual(result.status_code, 422)
        self.assertEqual(c.get_state()['regulars'], [])

    def test_reviewed_import_is_atomic(self):
        c = self.case
        request = {'wallets': [{'name': 'Cash', 'balance': 1000, 'expected_balance': 0}],
                   'transactions': [{'description': 'Tea', 'amount': 20, 'category': 'Missing', 'wallet_id': 1, 'type': 'expense'}]}
        result = c.client.post('/api/imports/reviewed', headers=c.headers, json=request)
        self.assertEqual(result.status_code, 422)
        self.assertEqual(c.get_state()['wallets'][0]['balance'], 0)
        request['transactions'][0]['category'] = 'Food'
        result = c.client.post('/api/imports/reviewed', headers=c.headers, json=request)
        self.assertEqual(result.status_code, 200)
        state = c.get_state()
        self.assertEqual(state['revision'], 1)
        self.assertEqual(state['wallets'][0]['balance'], 980)

    def test_existing_loan_correction_never_moves_money(self):
        c = self.case
        body = {'party': 'Test', 'direction': 'borrowed', 'amount': 100, 'affect_wallet': False}
        self.assertEqual(c.client.post('/api/loans', headers=c.headers, json=body).status_code, 201)
        self.assertEqual(c.client.put('/api/loans/1', headers=c.headers, json={**body, 'amount': 200}).status_code, 200)
        state = c.get_state()
        self.assertEqual(state['planning']['owed'], 200)
        self.assertEqual(state['wallets'][0]['balance'], 0)
        self.assertEqual(c.client.delete('/api/loans/1', headers=c.headers).status_code, 200)
        self.assertEqual(c.get_state()['loans'], [])
        c.client.post('/api/loans', headers=c.headers, json={**body, 'affect_wallet': True, 'wallet_id': 1})
        self.assertEqual(c.client.delete('/api/loans/1', headers=c.headers).status_code, 422)


class SecurityFixes(unittest.TestCase):
    def test_missing_release_key_stops_before_building(self):
        from mobile import build
        with patch.object(build, 'ROOT', Path('backups/nonexistent-signing-test-root')), patch.object(build, 'prepare') as prepare, patch('sys.argv', ['build.py']), redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                build.main()
            prepare.assert_not_called()

    def test_auth_network_failure_is_not_signout(self):
        request = SimpleNamespace(headers={'authorization': 'Bearer sample'}, cookies={})
        with patch('backend.cloud.call', side_effect=HTTPException(503, 'Temporary outage')):
            with self.assertRaises(HTTPException) as caught:
                cloud.read_session(request)
            self.assertEqual(caught.exception.status_code, 503)
        with patch('backend.cloud.call', side_effect=HTTPException(401, 'Invalid token')):
            self.assertEqual(cloud.read_session(request), (None, None))

    def test_custom_endpoint_rejects_private_and_mixed_dns(self):
        for addresses in (['127.0.0.1'], ['10.0.0.1'], ['169.254.169.254'], ['::1'], ['::ffff:127.0.0.1'], ['8.8.8.8', '10.0.0.1']):
            answers = [(2, 1, 6, '', (ip, 443)) for ip in addresses]
            with self.subTest(addresses=addresses), patch('backend.ai.socket.getaddrinfo', return_value=answers):
                with self.assertRaises(ValueError):
                    ai.public_destination('https://custom.test/v1')

    def test_custom_connection_pins_ip_and_keeps_tls_hostname(self):
        answers = [(2, 1, 6, '', ('8.8.8.8', 443))]
        response = httpx.Response(200, json={'ok': True})
        with patch('backend.ai.socket.getaddrinfo', return_value=answers), patch('backend.ai.httpx.Client') as client:
            client.return_value.__enter__.return_value.request.return_value = response
            self.assertEqual(ai.post('https://custom.test/v1/chat/completions', {'Authorization': 'Bearer test'}, {}, 5, custom=True), {'ok': True})
            call = client.return_value.__enter__.return_value.request.call_args
            self.assertEqual(call.args[1], 'https://8.8.8.8/v1/chat/completions')
            self.assertEqual(call.kwargs['headers']['Host'], 'custom.test')
            self.assertEqual(call.kwargs['extensions']['sni_hostname'], 'custom.test')

    def test_configuration_network_read_does_not_hold_global_lock(self):
        def read():
            owned = getattr(ai.LOCK, '_is_owned', lambda: False)()
            self.assertFalse(owned)
            return {}
        with patch('backend.cloud.read_ai_configs', side_effect=read):
            ai.load_configs()

    def test_configuration_compare_and_swap_rejects_stale_save(self):
        from cryptography.fernet import Fernet
        identity = {'access_token': 'test', 'user': {'id': 'account-a'}, 'ai_config_updated_at': '2026-10-20T12:00:00+00:00'}
        token = cloud.CURRENT_USER.set(identity)
        try:
            with patch('backend.cloud.cipher', return_value=Fernet(Fernet.generate_key())), patch('backend.cloud.call', return_value=[]) as call:
                with self.assertRaises(HTTPException) as caught:
                    cloud.save_ai_configs({})
                self.assertEqual(caught.exception.status_code, 409)
                self.assertEqual(call.call_args.args[0], 'PATCH')
                self.assertIn('updated_at=eq.2026-10-20T12%3A00%3A00%2B00%3A00', call.call_args.args[1])
        finally:
            cloud.CURRENT_USER.reset(token)


if __name__ == '__main__':
    unittest.main()
