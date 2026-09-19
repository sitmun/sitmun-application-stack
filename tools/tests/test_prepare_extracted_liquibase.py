#!/usr/bin/env python3
"""Harness helpers for extracted pre-1.2.7 Liquibase trees (stdlib unittest)."""

from __future__ import annotations

import csv
import io
import sys
import tempfile
import unittest
from pathlib import Path

BIN = Path(__file__).resolve().parent.parent / "bin"
sys.path.insert(0, str(BIN))

import prepare_extracted_liquibase as pel  # noqa: E402


class RewriteCsvWidthTest(unittest.TestCase):
    def test_quoted_tooltip_and_trailing_empty_stay_five_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "STM_TSK_UI.csv"
            original = (
                "TUI_ID,TUI_NAME,TUI_TOOLTIP,TUI_ORDER,TUI_TYPE\n"
                '7,sitna.drawMeasureModify,"Draw, Measure and Modify",0,\n'
            )
            path.write_text(original, encoding="utf-8")
            changed = pel.rewrite_csv_width(Path(tmp))
            self.assertEqual(changed, 0)
            self.assertEqual(path.read_text(encoding="utf-8"), original)

    def test_unquoted_jpeg_comma_merges_into_last_column(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "STM_CODELIST.csv"
            path.write_text(
                "COD_ID,COD_LIST,COD_VALUE,COD_DEFAULT,COD_SYSTEM,COD_DESCRIPTION\n"
                "106,queryTask.mimeType,image/jpeg,true,false,JPEG (.jpg, .jpeg)\n",
                encoding="utf-8",
            )
            changed = pel.rewrite_csv_width(Path(tmp))
            self.assertEqual(changed, 1)
            rows = list(csv.reader(io.StringIO(path.read_text(encoding="utf-8"))))
            self.assertEqual(len(rows[1]), 6)
            self.assertEqual(rows[1][-1], "JPEG (.jpg, .jpeg)")
            self.assertIn('"JPEG (.jpg, .jpeg)"', path.read_text(encoding="utf-8"))

    def test_short_row_is_padded_to_header_width(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "short.csv"
            path.write_text("A,B,C\n1,2\n", encoding="utf-8")
            changed = pel.rewrite_csv_width(Path(tmp))
            self.assertEqual(changed, 1)
            self.assertEqual(path.read_text(encoding="utf-8").splitlines()[1], "1,2,")


class AliasCsvCaseTest(unittest.TestCase):
    def test_exists_exact_uses_directory_listing_names(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory / "STM_USER.csv").write_text("id\n1\n", encoding="utf-8")
            self.assertTrue(pel.exists_exact(directory / "STM_USER.csv"))
            self.assertFalse(pel.exists_exact(directory / "stm_user.csv"))

    def test_alias_copies_lowercase_yaml_ref_on_case_sensitive_fs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root / "changelog" / "04_initial_data_prod"
            data.mkdir(parents=True)
            (data / "STM_USER.csv").write_text("USE_ID\n1\n", encoding="utf-8")
            (root / "changelog" / "04_initial_data_prod.yaml").write_text(
                "            file: 04_initial_data_prod/stm_user.csv\n",
                encoding="utf-8",
            )
            (data / "probe").write_text("x", encoding="utf-8")
            case_sensitive = not (data / "PROBE").exists()
            (data / "probe").unlink()
            created = pel.alias_csv_case(root)
            if case_sensitive:
                self.assertEqual(created, 1)
                self.assertTrue(pel.exists_exact(data / "stm_user.csv"))
                self.assertTrue(pel.exists_exact(data / "STM_USER.csv"))
            else:
                self.assertEqual(created, 0)


if __name__ == "__main__":
    unittest.main()
