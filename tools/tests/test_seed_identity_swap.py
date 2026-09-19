#!/usr/bin/env python3
"""PR-diff seed identity-swap gate (stdlib unittest)."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

BIN = Path(__file__).resolve().parent.parent / "bin"
sys.path.insert(0, str(BIN))

import check_seed_identity_swap as csi  # noqa: E402

HEADER = "COD_ID,COD_LIST,COD_VALUE,COD_SYSTEM,COD_DEFAULT,COD_DESCRIPTION\n"
PRE_45 = HEADER + (
    "53,service.authenticationMode,None,true,true,None\n"
    "54,service.authenticationMode,HTTP Basic authentication,true,false,HTTP Basic authentication\n"
)
POST_45 = HEADER + (
    "53,service.authenticationMode,HTTP Basic authentication,true,false,HTTP Basic authentication\n"
    "54,service.authenticationMode,None,true,true,None\n"
)
PATH = "profiles/postgres/liquibase/changelog/02_codelists/STM_CODELIST.csv"


class FindSwapsTest(unittest.TestCase):
    def test_issue_45_auth_mode_ids_53_and_54_swap_unique_keys(self) -> None:
        result = csi.check_texts(PRE_45, POST_45, PATH)
        self.assertEqual(
            {
                (("service.authenticationMode", "None"), "53", "54"),
                (
                    ("service.authenticationMode", "HTTP Basic authentication"),
                    "54",
                    "53",
                ),
            },
            {(s.unique_key, s.base_pk, s.head_pk) for s in result.swaps},
        )
        self.assertEqual((), result.errors)

    def test_description_only_change_is_not_a_swap(self) -> None:
        head = HEADER + (
            "53,service.authenticationMode,None,true,true,No authentication\n"
            "54,service.authenticationMode,HTTP Basic authentication,true,false,HTTP Basic authentication\n"
        )
        result = csi.check_texts(PRE_45, head, PATH)
        self.assertEqual((), result.swaps)
        self.assertEqual((), result.errors)

    def test_new_row_with_new_id_is_not_a_swap(self) -> None:
        head = PRE_45 + "55,service.authenticationMode,Digest,false,false,Digest\n"
        result = csi.check_texts(PRE_45, head, PATH)
        self.assertEqual((), result.swaps)
        self.assertEqual((), result.errors)

    def test_rename_value_on_same_id_when_new_value_is_fresh(self) -> None:
        head = HEADER + (
            "53,service.authenticationMode,Anonymous,true,true,Anonymous\n"
            "54,service.authenticationMode,HTTP Basic authentication,true,false,HTTP Basic authentication\n"
        )
        result = csi.check_texts(PRE_45, head, PATH)
        self.assertEqual((), result.swaps)
        self.assertEqual((), result.errors)

    def test_development_quoted_csv_detects_the_same_swap(self) -> None:
        pre = (
            '"cod_id","cod_list","cod_description","cod_system","cod_default","cod_value"\n'
            '"53","service.authenticationMode","None","true","true","None"\n'
            '"54","service.authenticationMode","HTTP Basic authentication","true","false","HTTP Basic authentication"\n'
        )
        post = (
            '"cod_id","cod_list","cod_description","cod_system","cod_default","cod_value"\n'
            '"53","service.authenticationMode","HTTP Basic authentication","true","false","HTTP Basic authentication"\n'
            '"54","service.authenticationMode","None","true","true","None"\n'
        )
        dev_path = (
            "profiles/development/backend/liquibase/changelog/02_codelists/stm_codelist.csv"
        )
        result = csi.check_texts(pre, post, dev_path)
        self.assertEqual(
            {
                (("service.authenticationMode", "None"), "53", "54"),
                (
                    ("service.authenticationMode", "HTTP Basic authentication"),
                    "54",
                    "53",
                ),
            },
            {(s.unique_key, s.base_pk, s.head_pk) for s in result.swaps},
        )

    def test_duplicate_unique_key_in_head_is_an_error(self) -> None:
        head = HEADER + (
            "53,service.authenticationMode,None,true,true,None\n"
            "54,service.authenticationMode,None,true,false,None\n"
        )
        result = csi.check_texts(PRE_45, head, PATH)
        self.assertEqual((), result.swaps)
        self.assertEqual(
            (
                f"{PATH}: duplicate unique key ('COD_LIST', 'COD_VALUE')="
                "('service.authenticationMode', 'None') on COD_ID 53 and 54",
            ),
            result.errors,
        )

    def test_unregistered_csv_is_ignored(self) -> None:
        result = csi.check_texts(
            "USE_ID,USE_USER\n1,admin\n",
            "USE_ID,USE_USER\n2,admin\n",
            "profiles/postgres/liquibase/changelog/04_seed_data/STM_USER.csv",
        )
        self.assertIsNone(result)


class CliTest(unittest.TestCase):
    def test_check_path_fails_on_issue_45_swap(self) -> None:
        workspace = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory(dir=workspace) as tmp:
            root = Path(tmp)
            csv = root / PATH
            csv.parent.mkdir(parents=True)
            csv.write_text(POST_45, encoding="utf-8")
            messages = csi.check_path(root, PATH, PRE_45)
            self.assertEqual(
                {
                    (
                        "identity swap in profiles/postgres/liquibase/changelog/"
                        "02_codelists/STM_CODELIST.csv: unique key ('COD_LIST', 'COD_VALUE')="
                        "('service.authenticationMode', 'HTTP Basic authentication') "
                        "moved from COD_ID 54 to 53"
                    ),
                    (
                        "identity swap in profiles/postgres/liquibase/changelog/"
                        "02_codelists/STM_CODELIST.csv: unique key ('COD_LIST', 'COD_VALUE')="
                        "('service.authenticationMode', 'None') moved from COD_ID 53 to 54"
                    ),
                },
                set(messages),
            )

    def test_empty_diff_exits_zero(self) -> None:
        rc = csi.main(
            [
                "--repo-root",
                str(Path(__file__).resolve().parents[2]),
                "--no-git",
                "--changed-file",
                "README.md",
            ]
        )
        self.assertEqual(0, rc)


if __name__ == "__main__":
    unittest.main()
