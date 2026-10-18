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
            self.assertIn("/static/app.js", response.text)
            self.assertIn("/static/app.css", response.text)
            self.assertIn('id="entry-dialog"', response.text)
        for asset in ["/static/app.js", "/static/app.css"]:
            self.assertEqual(self.client.get(asset).status_code, 200)


if __name__ == "__main__":
    unittest.main()
