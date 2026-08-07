#!/usr/bin/env python3
"""Unit tests for report_schema_drift.py (stdlib unittest)."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

BIN = Path(__file__).resolve().parent.parent / "bin"
sys.path.insert(0, str(BIN))

import report_schema_drift as rsd  # noqa: E402

FIXTURES = BIN / "testdata" / "schema_drift"


class CompareFixturesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.left_cols = rsd.load_columns(FIXTURES / "left.columns")
        self.right_cols = rsd.load_columns(FIXTURES / "right.columns")
        self.left_cons = rsd.load_constraints(FIXTURES / "left.constraints")
        self.right_cons = rsd.load_constraints(FIXTURES / "right.constraints")
        self.report = rsd.compare_schemas(
            self.left_cols, self.right_cols, self.left_cons, self.right_cons
        )

    def test_missing_column_is_problem(self) -> None:
        cats = {(d.category, d.table, d.column) for d in self.report.problems}
        self.assertIn(("column_only_reference", "STM_LOG", "LOG_EXTRA"), cats)
        self.assertIn(("table_only_reference", "STM_ONLY_REF", ""), cats)

    def test_narrower_length_is_problem(self) -> None:
        narrow = [
            d
            for d in self.report.problems
            if d.category == "length_narrower_fixable" and d.column == "PSE_NAME"
        ]
        self.assertEqual(len(narrow), 1)
        self.assertEqual(narrow[0].length, "50")

    def test_fk_only_on_reference_is_problem(self) -> None:
        fks = [
            d
            for d in self.report.problems
            if d.category == "constraint_only_reference" and d.ctype == "FK"
        ]
        tables_cols = {(d.table, d.cols) for d in fks}
        self.assertIn(("STM_LOG", ("LOG_APPID",)), tables_cols)
        self.assertIn(("STM_LOG", ("LOG_USERID",)), tables_cols)

    def test_fk_only_on_fixable_is_intentional_info(self) -> None:
        extra = [
            d
            for d in self.report.infos
            if d.category == "intentional_fixable_fk" and d.table == "STM_APP_BCKG"
        ]
        self.assertEqual(len(extra), 1)
        self.assertFalse(
            any(
                d.category == "constraint_only_fixable" and d.table == "STM_APP_BCKG"
                for d in self.report.problems
            )
        )

    def test_nullability_is_info(self) -> None:
        nulls = [d for d in self.report.infos if d.category == "nullability_diff"]
        self.assertTrue(any(d.column == "COL_NULL" for d in nulls))
        self.assertTrue(any(d.column == "PSE_NAME" for d in nulls))

    def test_changelog_emits_modify_and_add_fk(self) -> None:
        yaml = rsd.emit_changelog_yaml(
            self.report.drifts,
            dbms="postgresql",
            changeset_prefix="21_test",
        )
        self.assertIn("modifyDataType:", yaml)
        self.assertIn("PSE_NAME", yaml)
        self.assertIn("newDataType: VARCHAR(50)", yaml)
        self.assertIn("addForeignKeyConstraint:", yaml)
        self.assertIn("STM_LOG", yaml)
        self.assertIn("createTable:", yaml)
        self.assertIn("STM_ONLY_REF", yaml)
        self.assertIn("addColumn:", yaml)
        self.assertIn("LOG_EXTRA", yaml)
        self.assertNotIn("STM_APP_BCKG", yaml)  # intentional: no auto drop
        self.assertIn("DRAFT", yaml)

    def test_backfill_before_not_null(self) -> None:
        self.assertEqual(
            rsd.backfill_update_sql(
                "STM_X", "COL_B", "boolean", dbms="postgresql", java_default="false"
            ),
            "UPDATE STM_X SET COL_B = FALSE WHERE COL_B IS NULL",
        )
        self.assertEqual(
            rsd.sensible_backfill_literal("character varying", dbms="postgresql"),
            "''",
        )
        drift = rsd.Drift(
            category="column_only_reference",
            severity=rsd.SEVERITY_PROBLEM,
            table="STM_X",
            column="FLAG",
            detail="col",
            data_type="boolean",
            length="",
            nullable="NO",
        )
        yaml = rsd.emit_changelog_yaml(
            [drift], dbms="postgresql", changeset_prefix="21_nn"
        )
        self.assertIn("UPDATE STM_X SET FLAG = FALSE WHERE FLAG IS NULL", yaml)
        self.assertIn("addNotNullConstraint:", yaml)
        self.assertNotIn("nullable: false", yaml)

    def test_oracle_varchar_type(self) -> None:
        yaml = rsd.emit_changelog_yaml(
            self.report.drifts,
            dbms="oracle",
            changeset_prefix="21_test",
        )
        self.assertIn("VARCHAR2(50 CHAR)", yaml)

    def test_hints_annotate_nullability(self) -> None:
        report = rsd.compare_schemas(
            self.left_cols, self.right_cols, self.left_cons, self.right_cons
        )
        rsd.annotate_with_hints(
            report,
            {"STM_BOTH.COL_NULL": {"java_default": "false", "validated_not_null": True}},
        )
        hit = [
            d
            for d in report.infos
            if d.category == "nullability_diff" and d.column == "COL_NULL"
        ][0]
        self.assertIn("java_default='false'", hit.detail)
        self.assertIn("validated_not_null", hit.detail)

    def test_cli_writes_out_dir(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            out = Path(td)
            rc = rsd.main(
                [
                    "--left-columns",
                    str(FIXTURES / "left.columns"),
                    "--right-columns",
                    str(FIXTURES / "right.columns"),
                    "--left-constraints",
                    str(FIXTURES / "left.constraints"),
                    "--right-constraints",
                    str(FIXTURES / "right.constraints"),
                    "--out-dir",
                    str(out),
                    "--fail-on",
                    "none",
                    "--changeset-prefix",
                    "21_schema_drift_fix",
                ]
            )
            self.assertEqual(rc, 0)
            self.assertTrue((out / "21_schema_drift_fix.yaml").exists())
            self.assertTrue((out / "report.txt").exists())
            self.assertIn(
                "changelog/21_schema_drift_fix.yaml",
                (out / "MASTER_INCLUDE.txt").read_text(encoding="utf-8"),
            )

    def test_fail_on_problem(self) -> None:
        rc = rsd.main(
            [
                "--left-columns",
                str(FIXTURES / "left.columns"),
                "--right-columns",
                str(FIXTURES / "right.columns"),
                "--left-constraints",
                str(FIXTURES / "left.constraints"),
                "--right-constraints",
                str(FIXTURES / "right.constraints"),
                "--fail-on",
                "problem",
            ]
        )
        self.assertEqual(rc, 1)


class JpaModeSeverityTest(unittest.TestCase):
    def test_liquibase_only_objects_are_info(self) -> None:
        left = rsd.load_columns(FIXTURES / "left.columns")
        right = rsd.load_columns(FIXTURES / "right.columns")
        report = rsd.compare_schemas(left, right, [], [], mode="jpa")
        only_fix = [
            d
            for d in report.drifts
            if d.category in ("column_only_fixable", "table_only_fixable")
        ]
        self.assertTrue(only_fix)
        self.assertTrue(all(d.severity == "info" for d in only_fix))
        missing_mapped = [
            d for d in report.problems if d.category == "column_only_reference"
        ]
        self.assertTrue(missing_mapped)


if __name__ == "__main__":
    unittest.main()
