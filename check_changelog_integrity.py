#!/usr/bin/env python3
"""
Liquibase Changelog Integrity Checker

Rule: Modifications to changelog N are valid only if they occurred 
      before changelog N+1 was committed.

LIQUIBASE PRINCIPLE:
  Once a changelog has been applied to a database, it should NEVER be modified.
  Liquibase computes MD5 checksums - modifications cause deployment failures.

OUR APPROXIMATION:
  Once changelog N+1 exists, changelog N has likely been deployed and must
  be considered immutable. Any modifications after N+1 was committed are
  violations.

IMPLEMENTATION:
  Uses 'git merge-base --is-ancestor' to check if modification commits are
  in the ancestry chain of the next changelog's initial commit. If a
  modification is NOT an ancestor, it was integrated after the next changelog
  and is therefore invalid.

TESTED & VERIFIED:
  - Correctly identifies modifications made after next changelog
  - Handles data files in subdirectories (e.g., 03_task_types/*.json)
  - Works with standard git workflows on main branch
"""

import subprocess
import re
from pathlib import Path
from typing import Optional, List, Tuple
from dataclasses import dataclass


@dataclass
class Modification:
    """Represents a file modification commit"""
    commit_hash: str
    date: str
    message: str


@dataclass
class Violation:
    """Represents an invalid modification violation"""
    file_path: str
    changelog_num: int
    next_changelog: str
    next_commit_date: str
    invalid_modifications: List[Modification]


class ChangelogChecker:
    """Checks Liquibase changelog integrity"""
    
    def __init__(self, changelog_dir: str = "back/backend/config/liquibase/changelog"):
        self.changelog_dir = Path(changelog_dir)
        self.repo_root = Path(__file__).parent
        
    def run_git_command(self, cmd: List[str]) -> str:
        """Run a git command and return output"""
        try:
            result = subprocess.run(
                ["git"] + cmd,
                cwd=self.repo_root,
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return ""
    
    def get_tracked_files(self) -> List[str]:
        """Get all tracked files in changelog directory"""
        output = self.run_git_command([
            "ls-files", str(self.changelog_dir)
        ])
        return [f for f in output.split("\n") if f]
    
    def get_changelog_number(self, file_path: str) -> Optional[int]:
        """Extract changelog number from filename"""
        filename = Path(file_path).name
        match = re.match(r"^(\d+)_", filename)
        if match:
            return int(match.group(1))
        return None
    
    def find_parent_changelog(self, file_path: str) -> Optional[int]:
        """Find parent changelog number for data files"""
        file_path_obj = Path(file_path)
        dir_path = file_path_obj.parent
        
        # First, check if directory name contains a changelog number
        # e.g., "03_task_types" -> 3
        dir_name = dir_path.name
        dir_match = re.match(r"^(\d+)_", dir_name)
        if dir_match:
            return int(dir_match.group(1))
        
        # Look for YAML or SQL files in the same directory
        for ext in ["*.yaml", "*.sql"]:
            for parent_file in dir_path.glob(ext):
                if parent_file.name[0].isdigit():
                    num = self.get_changelog_number(str(parent_file))
                    if num:
                        return num
        
        # Look in parent directory (changelog root) for matching changelog
        parent_dir = dir_path.parent
        if parent_dir == self.changelog_dir:
            # We're in a subdirectory, look for changelog file in parent
            for ext in ["*.yaml", "*.sql"]:
                for parent_file in parent_dir.glob(ext):
                    if parent_file.name[0].isdigit():
                        num = self.get_changelog_number(str(parent_file))
                        if num:
                            return num
        
        return None
    
    def find_next_changelog(self, changelog_num: int) -> Optional[str]:
        """Find the next changelog file (N+1)"""
        next_num = changelog_num + 1
        # Format with leading zero if needed
        pattern = f"{next_num:02d}_*"
        
        output = self.run_git_command([
            "ls-files", f"{self.changelog_dir}/{pattern}"
        ])
        
        files = [f for f in output.split("\n") if f]
        # Return first matching file (should be only one)
        return files[0] if files else None
    
    def get_initial_commit(self, file_path: str) -> Optional[Tuple[str, str]]:
        """Get initial commit hash and date for a file"""
        output = self.run_git_command([
            "log", "--diff-filter=A", "--format=%H|%ai", "--", file_path
        ])
        
        if not output:
            return None
        
        lines = output.split("\n")
        if not lines:
            return None
        
        # Get the last line (oldest commit)
        last_line = lines[-1]
        if "|" in last_line:
            commit_hash, date = last_line.split("|", 1)
            return (commit_hash.strip(), date.strip())
        
        return None
    
    def get_modifications(self, file_path: str) -> List[Modification]:
        """Get all modification commits for a file"""
        output = self.run_git_command([
            "log", "--diff-filter=M", "--format=%H|%ai|%s", "--", file_path
        ])
        
        if not output:
            return []
        
        modifications = []
        for line in output.split("\n"):
            if "|" in line:
                parts = line.split("|", 2)
                if len(parts) == 3:
                    modifications.append(Modification(
                        commit_hash=parts[0].strip(),
                        date=parts[1].strip(),
                        message=parts[2].strip()
                    ))
        
        return modifications
    
    def is_ancestor(self, commit1: str, commit2: str) -> bool:
        """Check if commit1 is an ancestor of commit2 (commit1 happened before commit2)"""
        try:
            result = subprocess.run(
                ["git", "merge-base", "--is-ancestor", commit1, commit2],
                cwd=self.repo_root,
                capture_output=True,
                check=False
            )
            return result.returncode == 0
        except Exception:
            return False
    
    def check_file(self, file_path: str) -> Optional[Violation]:
        """Check a single file for violations"""
        file_path_obj = Path(file_path)
        
        # For files in subdirectories, prefer directory-based changelog number
        # For files directly in changelog dir, use filename-based number
        if file_path_obj.parent != self.changelog_dir:
            # File is in a subdirectory, check directory name first
            changelog_num = self.find_parent_changelog(file_path)
            if changelog_num is None:
                # Fallback to filename
                changelog_num = self.get_changelog_number(file_path)
        else:
            # File is directly in changelog directory, use filename
            changelog_num = self.get_changelog_number(file_path)
            if changelog_num is None:
                changelog_num = self.find_parent_changelog(file_path)
        
        if changelog_num is None:
            return None
        
        # Check if file has modifications
        modifications = self.get_modifications(file_path)
        if not modifications:
            return None
        
        # Find next changelog
        next_file = self.find_next_changelog(changelog_num)
        
        # If no next changelog, all modifications are valid
        if not next_file:
            return None
        
        # Get next changelog's initial commit
        next_commit_info = self.get_initial_commit(next_file)
        if not next_commit_info:
            return None
        
        next_commit_hash, next_commit_date = next_commit_info
        
        # Check each modification
        invalid_mods = []
        for mod in modifications:
            # If modification is NOT an ancestor of next commit, it's invalid
            if not self.is_ancestor(mod.commit_hash, next_commit_hash):
                invalid_mods.append(mod)
        
        if invalid_mods:
            return Violation(
                file_path=file_path,
                changelog_num=changelog_num,
                next_changelog=Path(next_file).name,
                next_commit_date=next_commit_date,
                invalid_modifications=invalid_mods
            )
        
        return None
    
    def check_all(self) -> Tuple[List[Violation], int]:
        """Check all files and return violations and valid count"""
        files = self.get_tracked_files()
        violations = []
        valid_count = 0
        
        for file_path in sorted(files):
            violation = self.check_file(file_path)
            if violation:
                violations.append(violation)
            else:
                # Check if file has modifications (valid ones)
                mods = self.get_modifications(file_path)
                if mods:
                    valid_count += 1
        
        return violations, valid_count
    
    def print_report(self):
        """Print the integrity report"""
        print("=== REVISED LIQUIBASE CHANGELOG INTEGRITY REPORT ===")
        print()
        print("Rule: Modifications to changelog N are valid only if they occurred")
        print("      before changelog N+1 was committed")
        print()
        
        violations, valid_count = self.check_all()
        
        if violations:
            print("=== INVALID MODIFICATIONS (VIOLATIONS) ===")
            print()
            for violation in violations:
                print(f"File: {violation.file_path} (changelog {violation.changelog_num})")
                print(f"  Next changelog: {violation.next_changelog} (committed: {violation.next_commit_date})")
                for mod in violation.invalid_modifications:
                    print(f"  INVALID modification: {mod.commit_hash} ({mod.date})")
                    print(f"    Message: {mod.message}")
                print()
        else:
            print("=== NO VIOLATIONS FOUND ===")
            print()
        
        total_files = len(self.get_tracked_files())
        print("=== SUMMARY ===")
        print(f"Total files checked: {total_files}")
        print(f"Files with valid modifications: {valid_count}")
        print(f"Files with invalid modifications: {len(violations)}")


if __name__ == "__main__":
    checker = ChangelogChecker()
    checker.print_report()
