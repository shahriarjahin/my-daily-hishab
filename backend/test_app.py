"""The interface stays available with local assets and no cloud credentials."""
import unittest
from fastapi.testclient import TestClient
from backend.main import app


class ShellTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_shell_and_assets(self):
        for path in ["/", "/analyze"]:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertIn('id="root"', response.text)
            self.assertIn('type="module"', response.text)
            self.assertNotIn('/static/app.js', response.text)
            import re
            for asset in re.findall(r'(?:src|href)="(\./assets/[^\"]+)"', response.text):
                self.assertEqual(self.client.get('/'+asset[2:]).status_code, 200)


if __name__ == "__main__":
    unittest.main()
