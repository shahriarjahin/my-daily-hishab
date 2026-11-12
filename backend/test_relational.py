"""Tests for Option B: Relational PostgreSQL schema, composite PKs, and sub-50ms writes."""
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine, select

from backend import database
from backend.api import router as api_router
from backend.database import ScopedSession, RelationalSession, init_db
from backend.models import AppSetting, Category, Transaction, Wallet


class RelationalEngineTests(unittest.TestCase):
    def setUp(self):
        # Create an in-memory database simulating relational PostgreSQL behavior
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        init_db(self.engine, user_id="user_a")
        init_db(self.engine, user_id="user_b")

    def tearDown(self):
        self.engine.dispose()

    def test_composite_pk_and_user_isolation(self):
        with ScopedSession(self.engine, user_id="user_a") as sa:
            t1 = Transaction(description="User A lunch", amount=150.0, category="Food", type="expense", wallet_id=1)
            sa.add(t1)
            sa.commit()
            self.assertEqual(t1.id, 1)
            self.assertEqual(t1.user_id, "user_a")

        with ScopedSession(self.engine, user_id="user_b") as sb:
            t2 = Transaction(description="User B dinner", amount=250.0, category="Food", type="expense", wallet_id=1)
            sb.add(t2)
            sb.commit()
            # User B also gets ID 1 without colliding with User A
            self.assertEqual(t2.id, 1)
            self.assertEqual(t2.user_id, "user_b")

        # Second transaction for User A gets ID 2
        with ScopedSession(self.engine, user_id="user_a") as sa:
            t3 = Transaction(description="User A snacks", amount=50.0, category="Food", type="expense", wallet_id=1)
            sa.add(t3)
            sa.commit()
            self.assertEqual(t3.id, 2)
            self.assertEqual(t3.user_id, "user_a")

            # Verify query scoping
            user_a_txs = sa.exec(select(Transaction).where(Transaction.user_id == "user_a")).all()
            self.assertEqual(len(user_a_txs), 2)
            descriptions = {t.description for t in user_a_txs}
            self.assertIn("User A lunch", descriptions)
            self.assertIn("User A snacks", descriptions)
            self.assertNotIn("User B dinner", descriptions)

    def test_relational_session_bumps_revision_on_commit(self):
        with RelationalSession(self.engine, user_id="user_a", revision=1) as session:
            setting = session.get(AppSetting, 1)
            self.assertEqual(setting.revision, 1)
            t = Transaction(description="Tea", amount=20.0, category="Food", type="expense", wallet_id=1)
            session.add(t)
            session.commit()
            self.assertEqual(session.revision, 2)

        with ScopedSession(self.engine, user_id="user_a") as session:
            setting = session.get(AppSetting, 1)
            self.assertEqual(setting.revision, 2)

    def test_write_latency_benchmark(self):
        """Verify that single-row expense inserts execute in well under 50ms."""
        with ScopedSession(self.engine, user_id="user_a") as session:
            latencies = []
            for i in range(10):
                start = time.perf_counter()
                t = Transaction(description=f"Item {i}", amount=10.0 + i, category="Food", type="expense", wallet_id=1)
                session.add(t)
                session.commit()
                elapsed_ms = (time.perf_counter() - start) * 1000
                latencies.append(elapsed_ms)

            avg_latency = sum(latencies) / len(latencies)
            # Direct relational insert should be extremely fast (typically <5ms in memory, <50ms over pooled DB)
            self.assertLess(avg_latency, 50.0, f"Average insert latency {avg_latency:.2f}ms exceeded 50ms target")


if __name__ == "__main__":
    unittest.main()
