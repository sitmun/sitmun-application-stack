#!/usr/bin/env python3
"""Fail a PR that edits an already-shipped Liquibase include.

Checksums live in DATABASECHANGELOG. Editing an applied changeset breaks
upgrade. This gate looks at the PR diff, not git ancestry.

Allow edits to the highest numbered include in that tree, includes that were
not on the diff base, master files, and the seed paths in TREE_ALLOWLIST.
Everything else with a lower number fails.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

INCLUDE_XML = re.compile(r"<include\s+file=\"([^\"]+)\"")
INCLUDE_YAML = re.compile(r"^\s+file:\s+(\S+)", re.M)
PREFIX_RE = re.compile(r"(?:^|/)(\d+)_")

DEFAULT_TREES = (
    "profiles/development/backend/liquibase",
    "profiles/postgres/liquibase",
    "profiles/oracle/liquibase",
    "back/backend/sitmun-backend-core/config/db/changelog",
)

TREE_ALLOWLIST: dict[str, tuple[str, ...]] = {
    "profiles/postgres/liquibase": (
        "changelog/02_codelists.yaml",
        "changelog/02_codelists/",
        "changelog/03_task_types.yaml",
        "changelog/03_task_types/",
        "changelog/04_seed_data.yaml",
        "changelog/04_seed_data/",
        "changelog/05_translations.yaml",
        "changelog/05_translations/",
        "changelog/06_params.yaml",
        "changelog/06_params/",
    ),
    "profiles/oracle/liquibase": (
        "changelog/02_codelists.yaml",
        "changelog/02_codelists/",
        "changelog/03_task_types.yaml",
        "changelog/03_task_types/",
        "changelog/04_seed_data.yaml",
        "changelog/04_seed_data/",
        "changelog/05_translations.yaml",
        "changelog/05_translations/",
        "changelog/06_params.yaml",
        "changelog/06_params/",
    ),
    "profiles/development/backend/liquibase": (
        "changelog/04_initial_data_dev.yaml",
        "changelog/04_initial_data_dev/",
    ),
}

MASTER_NAMES = frozenset({"master.xml", "db.changelog-master.yaml"})


@dataclass(frozen=True)
class Violation:
    rel_path: str
    prefix: int
    max_prefix: int
    tree: str


def repo_root_from_here() -> Path:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=Path(__file__).resolve().parent,
            capture_output=True,
            text=True,
            check=True,
        )
        return Path(out.stdout.strip())
    except subprocess.CalledProcessError:
        return Path(__file__).resolve().parents[2]


def include_prefix(path: str) -> int | None:
    match = PREFIX_RE.search(path.replace("\\", "/"))
    return int(match.group(1)) if match else None


def posix_rel(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def is_allowlisted(tree_key: str, rel_path: str) -> bool:
    rel = rel_path.replace("\\", "/")
    for pattern in TREE_ALLOWLIST.get(tree_key, ()):
        if pattern.endswith("/"):
            if rel == pattern[:-1] or rel.startswith(pattern):
                return True
        elif rel == pattern:
            return True
    return False


def find_master(liquibase_dir: Path) -> Path:
    xml = liquibase_dir / "master.xml"
    if xml.is_file():
        return xml
    yaml = liquibase_dir / "db.changelog-master.yaml"
    if yaml.is_file():
        return yaml
    raise FileNotFoundError(f"no master.xml or db.changelog-master.yaml in {liquibase_dir}")


def parse_includes_text(text: str, *, xml: bool) -> list[str]:
    if xml:
        return INCLUDE_XML.findall(text)
    return [p.strip().strip("\"'") for p in INCLUDE_YAML.findall(text)]


def parse_includes(master: Path) -> list[str]:
    return parse_includes_text(master.read_text(encoding="utf-8"), xml=master.suffix == ".xml")


def git_diff_start(repo_root: Path, base: str | None) -> str:
    if not base:
        return "HEAD"
    mb = subprocess.run(
        ["git", "merge-base", "HEAD", base],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    return mb.stdout.strip() if mb.returncode == 0 and mb.stdout.strip() else base


def includes_at_ref(repo_root: Path, tree_rel: str, ref: str) -> frozenset[str] | None:
    verified = subprocess.run(
        ["git", "rev-parse", "--verify", ref],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if verified.returncode != 0:
        return None
    for name, xml in (("master.xml", True), ("db.changelog-master.yaml", False)):
        shown = subprocess.run(
            ["git", "show", f"{ref}:{tree_rel}/{name}"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=False,
        )
        if shown.returncode == 0:
            return frozenset(parse_includes_text(shown.stdout, xml=xml))
    return frozenset()


def matching_include(rel_path: str, includes: list[str]) -> str | None:
    rel = rel_path.replace("\\", "/")
    for include in includes:
        inc = include.replace("\\", "/")
        if rel == inc:
            return include
        stem, _, _ = inc.rpartition(".")
        if stem and (rel == stem or rel.startswith(stem + "/")):
            return include
    return None


def check_tree(
    liquibase_dir: Path,
    changed_files: list[str],
    repo_root: Path,
    shipped_includes: frozenset[str] | None = None,
) -> list[Violation]:
    liquibase_dir = liquibase_dir.resolve()
    repo_root = repo_root.resolve()
    tree_key = posix_rel(liquibase_dir, repo_root)
    master = find_master(liquibase_dir)
    includes = parse_includes(master)
    prefixes = [p for p in (include_prefix(i) for i in includes) if p is not None]
    max_prefix = max(prefixes) if prefixes else 0
    violations: list[Violation] = []
    seen: set[str] = set()
    for raw in changed_files:
        if not raw:
            continue
        changed = Path(raw)
        abs_path = changed if changed.is_absolute() else (repo_root / changed)
        try:
            rel = posix_rel(abs_path, liquibase_dir)
        except ValueError:
            continue
        if rel in seen:
            continue
        seen.add(rel)
        if Path(rel).name in MASTER_NAMES:
            continue
        if is_allowlisted(tree_key, rel):
            continue
        include = matching_include(rel, includes)
        if include is None:
            continue
        prefix = include_prefix(include)
        if prefix is None or prefix >= max_prefix:
            continue
        if shipped_includes is not None and include not in shipped_includes:
            continue
        violations.append(
            Violation(rel_path=rel, prefix=prefix, max_prefix=max_prefix, tree=tree_key)
        )
    return violations


def git_changed_files(repo_root: Path, base: str | None) -> list[str]:
    files: set[str] = set()
    if base:
        start = git_diff_start(repo_root, base)
        diff = subprocess.run(
            ["git", "diff", "--name-only", f"{start}...HEAD"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=True,
        )
        files.update(line.strip() for line in diff.stdout.splitlines() if line.strip())
    else:
        for args in (
            ["git", "diff", "--name-only", "HEAD"],
            ["git", "diff", "--name-only", "--cached"],
        ):
            diff = subprocess.run(
                args,
                cwd=repo_root,
                capture_output=True,
                text=True,
                check=True,
            )
            files.update(line.strip() for line in diff.stdout.splitlines() if line.strip())
    return sorted(files)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fail when a diff edits a Liquibase include below the tree tip."
    )
    parser.add_argument("--repo-root", type=Path, default=None)
    parser.add_argument("--tree", action="append", dest="trees", default=None)
    parser.add_argument("--changed-file", action="append", dest="changed_files", default=None)
    parser.add_argument("--base", default=None, help="Git ref to diff against (CI merge base).")
    parser.add_argument(
        "--no-git",
        action="store_true",
        help="Do not inspect git. Use --changed-file only.",
    )
    args = parser.parse_args(argv)

    repo_root = (args.repo_root or repo_root_from_here()).resolve()
    tree_args = args.trees or list(DEFAULT_TREES)
    trees = [(repo_root / t).resolve() if not Path(t).is_absolute() else Path(t).resolve() for t in tree_args]

    if args.changed_files is not None:
        changed = [p for p in args.changed_files if p]
        start = None
    elif args.no_git:
        changed = []
        start = None
    else:
        changed = git_changed_files(repo_root, args.base)
        start = git_diff_start(repo_root, args.base)

    all_violations: list[Violation] = []
    for tree in trees:
        if not tree.is_dir():
            print(f"skip missing tree: {tree}", file=sys.stderr)
            continue
        shipped = includes_at_ref(repo_root, posix_rel(tree, repo_root), start) if start else None
        all_violations.extend(check_tree(tree, changed, repo_root, shipped_includes=shipped))

    if all_violations:
        print("Liquibase immutability: do not edit includes below the tree tip.")
        print("Add a new numbered changeset and a master include instead.")
        print()
        for v in all_violations:
            print(f"  {v.tree}/{v.rel_path}  (changelog {v.prefix} < tip {v.max_prefix})")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
