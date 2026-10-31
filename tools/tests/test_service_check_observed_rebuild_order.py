#!/usr/bin/env python3
"""Oracle service-check timestamptz rebuild runs before the empty-column ALTER."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TREES = (
    (
        "profiles/oracle/liquibase/master.xml",
        "35_service_check_observed_timestamptz_rebuild.sql",
        "33_service_check_observed_timestamptz.yaml",
        "profiles/oracle/liquibase/changelog/35_service_check_observed_timestamptz_rebuild.sql",
    ),
    (
        "profiles/postgres/liquibase/master.xml",
        "35_service_check_observed_timestamptz_rebuild.sql",
        "33_service_check_observed_timestamptz.yaml",
        "profiles/postgres/liquibase/changelog/35_service_check_observed_timestamptz_rebuild.sql",
    ),
    (
        "profiles/development/backend/liquibase/master.xml",
        "91_service_check_observed_timestamptz_rebuild.sql",
        "89_service_check_observed_timestamptz.yaml",
        "profiles/development/backend/liquibase/changelog/91_service_check_observed_timestamptz_rebuild.sql",
    ),
)


class ServiceCheckObservedRebuildOrderTest(unittest.TestCase):
    def test_rebuild_is_included_before_empty_column_alter(self) -> None:
        for master_rel, rebuild_name, alter_name, rebuild_rel in TREES:
            master = (ROOT / master_rel).read_text(encoding="utf-8")
            rebuild_at = master.find(rebuild_name)
            alter_at = master.find(alter_name)
            self.assertGreaterEqual(rebuild_at, 0, master_rel)
            self.assertGreaterEqual(alter_at, 0, master_rel)
            self.assertLess(rebuild_at, alter_at, master_rel)

            rebuild = (ROOT / rebuild_rel).read_text(encoding="utf-8")
            self.assertIn(
                "UPDATE STM_SERVICE_CHECK SET SEC_OBSERVED_TZ = FROM_TZ(SEC_OBSERVED, ''UTC'')",
                rebuild,
            )
            self.assertIn(
                "UPDATE STM_SERVICE_CHECK_SAMPLE SET SCS_OBSERVED_TZ = FROM_TZ(SCS_OBSERVED, ''UTC'')",
                rebuild,
            )
            self.assertNotIn("DELETE FROM STM_SERVICE_CHECK", rebuild)
            self.assertIn("dbms:oracle", rebuild)

            alter = (ROOT / master_rel).parent.joinpath("changelog", alter_name).read_text(
                encoding="utf-8"
            )
            self.assertIn(
                "ALTER TABLE STM_SERVICE_CHECK MODIFY (SEC_OBSERVED TIMESTAMP(6) WITH TIME ZONE)",
                alter,
            )


if __name__ == "__main__":
    unittest.main()
