#!/usr/bin/env python3
"""Fail a PR diff that moves a seed unique key onto a different primary key.

loadUpdateData updates by PK. Unique constraints then fire when two rows
swap natural keys, as in sitmun-application-stack#45 (STM_CODELIST 53/54).
"""

from __future__ import annotations

import argparse
import csv
import io
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class IdentityTable:
    path_suffixes: tuple[str, ...]
    pk: str
    unique_key: tuple[str, ...]


CODELIST = IdentityTable(
    path_suffixes=(
        "02_codelists/STM_CODELIST.csv",
        "02_codelists/stm_codelist.csv",
    ),
    pk="COD_ID",
    unique_key=("COD_LIST", "COD_VALUE"),
)
TABLES = (CODELIST,)


@dataclass(frozen=True)
class Swap:
    path: str
    unique_key: tuple[str, ...]
    base_pk: str
    head_pk: str


@dataclass(frozen=True)
class CheckResult:
    swaps: tuple[Swap, ...]
    errors: tuple[str, ...]


def _header(name: str) -> str:
    return name.strip().strip('"').upper()


def table_for_path(rel: str) -> IdentityTable | None:
    normalized = rel.replace("\\", "/")
    for table in TABLES:
        if any(normalized.endswith(suffix) for suffix in table.path_suffixes):
            return table
    return None


def parse_rows(text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("CSV has no header")
    rows: list[dict[str, str]] = []
    for raw in reader:
        rows.append(
            {
                _header(key): (value or "").strip()
                for key, value in raw.items()
                if key is not None
            }
        )
    return rows


def _index(
    rows: list[dict[str, str]], spec: IdentityTable, path: str
) -> tuple[dict[tuple[str, ...], str], list[str]]:
    unique_to_pk: dict[tuple[str, ...], str] = {}
    errors: list[str] = []
    seen_pk: set[str] = set()
    for row in rows:
        missing = [spec.pk, *spec.unique_key]
        if any(col not in row for col in missing):
            errors.append(f"{path}: missing columns {spec.pk} or {spec.unique_key}")
            continue
        pk = row[spec.pk]
        uk = tuple(row[col] for col in spec.unique_key)
        if pk in seen_pk:
            errors.append(f"{path}: duplicate {spec.pk} {pk}")
        seen_pk.add(pk)
        prior = unique_to_pk.get(uk)
        if prior is not None:
            errors.append(
                f"{path}: duplicate unique key {spec.unique_key}={uk} "
                f"on {spec.pk} {prior} and {pk}"
            )
            continue
        unique_to_pk[uk] = pk
    return unique_to_pk, errors


def check_texts(base_text: str, head_text: str, path: str) -> CheckResult | None:
    spec = table_for_path(path)
    if spec is None:
        return None
    try:
        base_rows = parse_rows(base_text)
        head_rows = parse_rows(head_text)
    except ValueError as exc:
        return CheckResult((), (f"{path}: {exc}",))
    base_map, base_errors = _index(base_rows, spec, path)
    head_map, head_errors = _index(head_rows, spec, path)
    swaps = tuple(
        Swap(path=path, unique_key=uk, base_pk=base_map[uk], head_pk=head_map[uk])
        for uk in sorted(set(base_map) & set(head_map))
        if base_map[uk] != head_map[uk]
    )
    return CheckResult(swaps, tuple(base_errors + head_errors))


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=True,
    )


def _git_show(repo: Path, ref: str, rel: str) -> str | None:
    proc = _git(repo, "show", f"{ref}:{rel}")
    if proc.returncode != 0:
        return None
    return proc.stdout


def _changed_paths(repo: Path, base: str) -> list[str]:
    proc = _git(repo, "diff", "--name-only", "--diff-filter=AM", f"{base}...HEAD")
    proc.check_returncode()
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def format_messages(result: CheckResult) -> list[str]:
    messages = list(result.errors)
    if not result.swaps:
        return messages
    spec = table_for_path(result.swaps[0].path)
    pk_name = spec.pk if spec else "PK"
    uk_name = spec.unique_key if spec else "unique key"
    for swap in result.swaps:
        messages.append(
            f"identity swap in {swap.path}: unique key {uk_name}={swap.unique_key} "
            f"moved from {pk_name} {swap.base_pk} to {swap.head_pk}"
        )
    return messages


def check_path(repo: Path, rel: str, base_text: str | None) -> list[str]:
    if table_for_path(rel) is None:
        return []
    head_file = repo / rel
    if not head_file.is_file():
        return []
    head_text = head_file.read_text(encoding="utf-8")
    if base_text is None:
        result = check_texts(head_text, head_text, rel)
        if result is None:
            return []
        return list(result.errors)
    result = check_texts(base_text, head_text, rel)
    if result is None:
        return []
    return format_messages(result)


def evaluate(
    repo: Path,
    *,
    base: str | None,
    changed_files: list[str],
    use_git: bool,
) -> list[str]:
    if changed_files:
        rels = changed_files
    elif use_git:
        if not base:
            raise SystemExit("--base is required unless --changed-file or --no-git")
        rels = _changed_paths(repo, base)
    else:
        rels = []
    messages: list[str] = []
    for rel in rels:
        base_text = _git_show(repo, base, rel) if use_git and base else None
        messages.extend(check_path(repo, rel, base_text))
    return messages


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fail when a seed CSV moves a unique key onto a different PK."
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
    )
    parser.add_argument("--base", help="Git ref for the PR base (old CSV).")
    parser.add_argument(
        "--changed-file",
        action="append",
        default=[],
        dest="changed_files",
        help="Limit the check to these repo-relative paths.",
    )
    parser.add_argument(
        "--no-git",
        action="store_true",
        help="Do not read git. Duplicate unique keys still fail for --changed-file.",
    )
    args = parser.parse_args(argv)
    repo = args.repo_root.resolve()
    messages = evaluate(
        repo,
        base=args.base,
        changed_files=args.changed_files,
        use_git=not args.no_git,
    )
    for message in messages:
        print(message, file=sys.stderr)
    return 1 if messages else 0


if __name__ == "__main__":
    raise SystemExit(main())
