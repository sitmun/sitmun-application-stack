#!/usr/bin/env python3
"""
Switch the default language for SITMUN deployment.
Swaps content between English (current default) and target language.

This tool modifies:
- master-translations.json (swap en/target for all entries)
- STM_LANGUAGE.csv (language names)
- STM_CODELIST.csv (descriptions)
- STM_TER_TYP.csv (territory type names)
- STM_TSK_UI.csv (task UI tooltips)
- STM_USER.csv (user display names USE_NAME)
- STM_CONF.csv (language.default config)
- Regenerates all translation CSV files

Usage:
    python3 switch_default_language.py es              # Switch to Spanish
    python3 switch_default_language.py ca --dry-run    # Preview Catalan switch
    python3 switch_default_language.py --rollback      # Restore from backup
"""

import json
import csv
import sys
import argparse
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Tuple
import subprocess

from _profile_paths import get_liquibase_root, get_scenario_from_env, SCENARIOS


class LanguageSwitcher:
    """Handles switching the default language in SITMUN system."""
    
    def __init__(self, target_language: str, dry_run: bool = False, scenario: str = None):
        self.target_language = target_language
        self.dry_run = dry_run
        self.scenario = (scenario or get_scenario_from_env()).strip().lower()
        if self.scenario not in SCENARIOS:
            raise ValueError(f"scenario must be one of {SCENARIOS}, got {scenario!r}")
        self.workspace_root = Path(__file__).parent.parent.parent
        self.tools_dir = Path(__file__).parent
        self.backup_dir = self.tools_dir / "backups"
        liquibase_root = get_liquibase_root(self.workspace_root, self.scenario)
        
        # File paths (from selected scenario)
        self.master_file = self.tools_dir / "master-translations.json"
        self.language_csv = liquibase_root / "changelog/05_translations/STM_LANGUAGE.csv"
        self.codelist_csv = liquibase_root / "changelog/02_codelists/STM_CODELIST.csv"
        self.territory_csv = liquibase_root / "changelog/04_seed_data/STM_TER_TYP.csv"
        self.taskui_csv = liquibase_root / "changelog/04_seed_data/STM_TSK_UI.csv"
        self.user_csv = liquibase_root / "changelog/04_seed_data/STM_USER.csv"
        self.config_csv = liquibase_root / "changelog/06_params/STM_CONF.csv"
        
        # State
        self.master_data = None
        self.current_default = None
        self.changes_summary = []
        
    def validate(self) -> bool:
        """Validate that target language exists and has complete translations."""
        print("=" * 60)
        print("Validating target language...")
        print("=" * 60)
        
        # Load master translations
        if not self.master_file.exists():
            print(f"ERROR: Master translations file not found: {self.master_file}")
            return False
        
        with open(self.master_file, 'r', encoding='utf-8') as f:
            self.master_data = json.load(f)
        
        self.current_default = self.master_data["metadata"]["defaultLanguage"]
        
        # Check if target language exists
        if self.target_language not in self.master_data["metadata"]["languages"]:
            print(f"ERROR: Target language '{self.target_language}' not found")
            print(f"Available languages: {', '.join(self.master_data['metadata']['languages'])}")
            return False
        
        # Check if target is already default
        if self.target_language == self.current_default:
            print(f"ERROR: '{self.target_language}' is already the default language")
            return False
        
        # Check translation completeness
        print(f"\nChecking translation completeness for '{self.target_language}'...")
        incomplete = []
        
        for entity_name, entity_data in self.master_data["entities"].items():
            for entry in entity_data["translations"]:
                if not entry.get(self.target_language, "").strip():
                    incomplete.append(f"{entity_name} ID {entry['id']}: {entry['en']}")
        
        if incomplete:
            print(f"\nERROR: Target language has {len(incomplete)} incomplete translations:")
            for item in incomplete[:10]:
                print(f"  - {item}")
            if len(incomplete) > 10:
                print(f"  ... and {len(incomplete) - 10} more")
            print("\nRun 'python3 check_translations.py' for full report")
            return False
        
        # Validate all required files exist
        required_files = [
            self.language_csv,
            self.codelist_csv,
            self.territory_csv,
            self.taskui_csv,
            self.config_csv
        ]
        
        missing_files = [f for f in required_files if not f.exists()]
        if missing_files:
            print("\nERROR: Required files not found:")
            for f in missing_files:
                print(f"  - {f}")
            return False
        
        print(f"\n✓ Target language '{self.target_language}' is valid and complete")
        print(f"✓ Current default: '{self.current_default}'")
        print(f"✓ All required files exist")
        return True
    
    def create_backup(self) -> str:
        """Create timestamped backup of all files to be modified."""
        if self.dry_run:
            print("\n[DRY-RUN] Would create backup")
            return "dry-run"
        
        print("\n" + "=" * 60)
        print("Creating backup...")
        print("=" * 60)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{self.current_default}_to_{self.target_language}_{timestamp}"
        backup_path = self.backup_dir / backup_name
        backup_path.mkdir(parents=True, exist_ok=True)
        
        files_to_backup = [
            ("master-translations.json", self.master_file),
            ("STM_LANGUAGE.csv", self.language_csv),
            ("STM_CODELIST.csv", self.codelist_csv),
            ("STM_TER_TYP.csv", self.territory_csv),
            ("STM_TSK_UI.csv", self.taskui_csv),
            ("STM_USER.csv", self.user_csv),
            ("STM_CONF.csv", self.config_csv),
        ]
        
        for name, filepath in files_to_backup:
            if filepath.exists():
                dest = backup_path / name
                shutil.copy2(filepath, dest)
                print(f"  ✓ Backed up {name}")
        
        # Save backup metadata
        metadata = {
            "timestamp": timestamp,
            "from_language": self.current_default,
            "to_language": self.target_language,
            "scenario": self.scenario,
            "files": [name for name, _ in files_to_backup]
        }
        
        with open(backup_path / "backup_info.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n✓ Backup created: {backup_path}")
        return str(backup_path)
    
    def swap_master_translations(self):
        """Swap 'en' and target language in master-translations.json."""
        print("\n" + "=" * 60)
        print(f"Swapping translations: '{self.current_default}' ↔ '{self.target_language}'")
        print("=" * 60)
        
        swap_count = 0
        
        for entity_name, entity_data in self.master_data["entities"].items():
            for entry in entity_data["translations"]:
                # Swap the values
                en_value = entry.get(self.current_default, "")
                target_value = entry.get(self.target_language, "")
                
                entry[self.current_default] = target_value
                entry[self.target_language] = en_value
                swap_count += 1
                
                # Log first few changes
                if swap_count <= 5:
                    print(f"  {entity_name} ID {entry['id']}:")
                    print(f"    '{self.current_default}': {en_value} → {target_value}")
                    print(f"    '{self.target_language}': {target_value} → {en_value}")
        
        # Update metadata
        self.master_data["metadata"]["defaultLanguage"] = self.target_language
        self.master_data["metadata"]["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")
        
        print(f"\n✓ Swapped {swap_count} translation entries")
        self.changes_summary.append(f"Master translations: {swap_count} entries swapped")
    
    def update_language_csv(self):
        """Update STM_LANGUAGE.csv with translated language names."""
        print("\n" + "=" * 60)
        print("Updating STM_LANGUAGE.csv...")
        print("=" * 60)
        
        rows = self._read_csv(self.language_csv)
        if not rows:
            return
        
        # Find Language entity in master data
        language_entity = self.master_data["entities"].get("Language")
        if not language_entity:
            print("  WARNING: Language entity not found in master translations")
            return
        
        updated_count = 0
        for row in rows:
            lan_id = int(row["LAN_ID"])
            
            # Find translation for this language ID
            translation = next((t for t in language_entity["translations"] if t["id"] == lan_id), None)
            if translation:
                old_name = row["LAN_NAME"]
                new_name = translation[self.target_language]
                row["LAN_NAME"] = new_name
                updated_count += 1
                print(f"  ID {lan_id}: {old_name} → {new_name}")
        
        if not self.dry_run:
            self._write_csv(self.language_csv, rows, ["LAN_ID", "LAN_SHORTNAME", "LAN_NAME"])
        
        print(f"\n✓ Updated {updated_count} language names")
        self.changes_summary.append(f"STM_LANGUAGE.csv: {updated_count} names updated")
    
    def update_codelist_csv(self):
        """Update STM_CODELIST.csv with translated descriptions."""
        print("\n" + "=" * 60)
        print("Updating STM_CODELIST.csv...")
        print("=" * 60)
        
        rows = self._read_csv(self.codelist_csv)
        if not rows:
            return
        
        # Find CodeListValue entity in master data
        codelist_entity = self.master_data["entities"].get("CodeListValue")
        if not codelist_entity:
            print("  WARNING: CodeListValue entity not found in master translations")
            return
        
        updated_count = 0
        for row in rows:
            cod_id = int(row["COD_ID"])
            
            # Find translation for this codelist ID
            translation = next((t for t in codelist_entity["translations"] if t["id"] == cod_id), None)
            if translation:
                old_desc = row["COD_DESCRIPTION"]
                new_desc = translation[self.target_language]
                row["COD_DESCRIPTION"] = new_desc
                updated_count += 1
                
                if updated_count <= 5:
                    print(f"  ID {cod_id}: {old_desc} → {new_desc}")
        
        if updated_count > 5:
            print(f"  ... and {updated_count - 5} more")
        
        if not self.dry_run:
            fieldnames = ["COD_ID", "COD_LIST", "COD_VALUE", "COD_SYSTEM", "COD_DEFAULT", "COD_DESCRIPTION"]
            self._write_csv(self.codelist_csv, rows, fieldnames)
        
        print(f"\n✓ Updated {updated_count} codelist descriptions")
        self.changes_summary.append(f"STM_CODELIST.csv: {updated_count} descriptions updated")
    
    def update_territory_csv(self):
        """Update STM_TER_TYP.csv with translated territory type names."""
        print("\n" + "=" * 60)
        print("Updating STM_TER_TYP.csv...")
        print("=" * 60)
        
        rows = self._read_csv(self.territory_csv)
        if not rows:
            return
        
        # Find TerritoryType entity in master data
        territory_entity = self.master_data["entities"].get("TerritoryType")
        if not territory_entity:
            print("  WARNING: TerritoryType entity not found in master translations")
            return
        
        updated_count = 0
        for row in rows:
            tet_id = int(row["TET_ID"])
            
            # Find translation for this territory type ID
            translation = next((t for t in territory_entity["translations"] if t["id"] == tet_id), None)
            if translation:
                old_name = row["TET_NAME"]
                new_name = translation[self.target_language]
                row["TET_NAME"] = new_name
                updated_count += 1
                print(f"  ID {tet_id}: {old_name} → {new_name}")
        
        if not self.dry_run:
            fieldnames = ["TET_ID", "TET_NAME", "TET_OFFICIAL", "TET_TOP", "TET_BOTTOM"]
            self._write_csv(self.territory_csv, rows, fieldnames)
        
        print(f"\n✓ Updated {updated_count} territory type names")
        self.changes_summary.append(f"STM_TER_TYP.csv: {updated_count} names updated")
    
    def update_taskui_csv(self):
        """Update STM_TSK_UI.csv with translated tooltip values."""
        print("\n" + "=" * 60)
        print("Updating STM_TSK_UI.csv...")
        print("=" * 60)
        
        rows = self._read_csv(self.taskui_csv)
        if not rows:
            return
        
        # Find TaskUITooltip entity in master data
        taskui_entity = self.master_data["entities"].get("TaskUITooltip")
        if not taskui_entity:
            print("  WARNING: TaskUITooltip entity not found in master translations")
            return
        
        updated_count = 0
        for row in rows:
            tui_id = int(row["TUI_ID"])
            
            # Find translation for this task UI ID
            translation = next((t for t in taskui_entity["translations"] if t["id"] == tui_id), None)
            if translation:
                old_tooltip = row["TUI_TOOLTIP"]
                new_tooltip = translation[self.target_language]
                row["TUI_TOOLTIP"] = new_tooltip
                updated_count += 1
                print(f"  ID {tui_id}: {old_tooltip} → {new_tooltip}")
        
        if not self.dry_run:
            fieldnames = ["TUI_ID", "TUI_NAME", "TUI_TOOLTIP", "TUI_ORDER", "TUI_TYPE"]
            self._write_csv(self.taskui_csv, rows, fieldnames)
        
        print(f"\n✓ Updated {updated_count} task UI tooltips")
        self.changes_summary.append(f"STM_TSK_UI.csv: {updated_count} tooltips updated")
    
    def update_task_csv(self):
        """Update STM_TASK.csv with translated task names."""
        print("\n" + "=" * 60)
        print("Updating STM_TASK.csv...")
        print("=" * 60)
        
        task_csv = get_liquibase_root(self.workspace_root, self.scenario) / "changelog/04_seed_data/STM_TASK.csv"
        rows = self._read_csv(task_csv)
        if not rows:
            return
        
        # Find Task entity in master data
        task_entity = self.master_data["entities"].get("Task")
        if not task_entity:
            print("  WARNING: Task entity not found in master translations")
            return
        
        updated_count = 0
        for row in rows:
            tas_id = int(row["TAS_ID"])
            
            # Find translation for this task ID
            translation = next((t for t in task_entity["translations"] if t["id"] == tas_id), None)
            if translation:
                old_name = row["TAS_NAME"]
                new_name = translation[self.target_language]
                row["TAS_NAME"] = new_name
                updated_count += 1
                print(f"  ID {tas_id}: {old_name} → {new_name}")
        
        if not self.dry_run:
            fieldnames = ["TAS_ID", "TAS_NAME", "TAS_CREATED", "TAS_ORDER", "TAS_GIID", "TAS_SERID", "TAS_GTASKID", "TAS_TTASKID", "TAS_TUIID", "TAS_CONNID", "TAS_PARAMS"]
            self._write_csv(task_csv, rows, fieldnames)
        
        print(f"\n✓ Updated {updated_count} task names")
        self.changes_summary.append(f"STM_TASK.csv: {updated_count} task names updated")
    
    def update_user_csv(self):
        """Update STM_USER.csv USE_NAME with translated display names (seedDataOnly, like tooltips)."""
        print("\n" + "=" * 60)
        print("Updating STM_USER.csv...")
        print("=" * 60)
        
        rows = self._read_csv(self.user_csv)
        if not rows:
            return
        
        user_entity = self.master_data["entities"].get("User")
        if not user_entity:
            print("  WARNING: User entity not found in master translations")
            return
        
        updated_count = 0
        for row in rows:
            use_id = int(row["USE_ID"])
            translation = next((t for t in user_entity["translations"] if t["id"] == use_id), None)
            if translation:
                old_name = row.get("USE_NAME", "")
                new_name = translation.get(self.target_language, "") or ""
                row["USE_NAME"] = new_name
                updated_count += 1
                print(f"  ID {use_id}: {old_name!r} → {new_name!r}")
        
        if not self.dry_run:
            fieldnames = ["USE_ID", "USE_USER", "USE_PWD", "USE_NAME", "USE_SURNAME", "USE_ADM", "USE_BLOCKED", "USE_CREATED"]
            self._write_csv(self.user_csv, rows, fieldnames)
        
        print(f"\n✓ Updated {updated_count} user display names (USE_NAME)")
        self.changes_summary.append(f"STM_USER.csv: {updated_count} USE_NAME updated")
    
    def update_configuration(self):
        """Update STM_CONF.csv language.default value."""
        print("\n" + "=" * 60)
        print("Updating STM_CONF.csv...")
        print("=" * 60)
        
        rows = self._read_csv(self.config_csv)
        if not rows:
            return
        
        updated = False
        for row in rows:
            if row["CNF_NAME"] == "language.default":
                old_value = row["CNF_VALUE"]
                row["CNF_VALUE"] = self.target_language
                print(f"  language.default: {old_value} → {self.target_language}")
                updated = True
                break
        
        if not updated:
            print("  WARNING: language.default not found in STM_CONF.csv")
            return
        
        if not self.dry_run:
            fieldnames = ["CNF_ID", "CNF_NAME", "CNF_VALUE"]
            self._write_csv(self.config_csv, rows, fieldnames)
        
        print(f"\n✓ Updated configuration")
        self.changes_summary.append(f"STM_CONF.csv: language.default = {self.target_language}")
    
    def save_master_translations(self):
        """Save the modified master-translations.json."""
        if self.dry_run:
            print("\n[DRY-RUN] Would save master-translations.json")
            return
        
        print("\n" + "=" * 60)
        print("Saving master-translations.json...")
        print("=" * 60)
        
        with open(self.master_file, 'w', encoding='utf-8') as f:
            json.dump(self.master_data, f, indent=2, ensure_ascii=False)
        
        print("✓ Master translations saved")
    
    def regenerate_translations(self):
        """Call generate_translation_files.py to regenerate translation CSVs."""
        if self.dry_run:
            print("\n[DRY-RUN] Would regenerate translation CSV files")
            return
        
        print("\n" + "=" * 60)
        print("Regenerating translation CSV files...")
        print("=" * 60)
        
        generate_script = self.tools_dir / "generate_translation_files.py"
        if not generate_script.exists():
            print(f"  WARNING: generate_translation_files.py not found at {generate_script}")
            return
        
        try:
            result = subprocess.run(
                [sys.executable, str(generate_script)],
                cwd=str(self.tools_dir),
                capture_output=True,
                text=True,
                check=True
            )
            print(result.stdout)
            print("✓ Translation files regenerated")
            self.changes_summary.append("Translation CSVs: Regenerated all files")
        except subprocess.CalledProcessError as e:
            print(f"ERROR: Failed to regenerate translation files")
            print(e.stderr)
            raise
    
    def _read_csv(self, filepath: Path) -> List[Dict[str, str]]:
        """Read CSV file and return list of dictionaries."""
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return list(reader)
    
    def _write_csv(self, filepath: Path, rows: List[Dict[str, str]], fieldnames: List[str]):
        """Write CSV file from list of dictionaries."""
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    
    def execute(self) -> bool:
        """Execute the full language switch process."""
        try:
            # Step 1: Validate
            if not self.validate():
                return False
            
            # Step 2: Create backup
            backup_path = self.create_backup()
            
            # Step 3: Swap master translations
            self.swap_master_translations()
            
            # Step 4: Update STM_LANGUAGE.csv
            self.update_language_csv()
            
            # Step 5: Update seed data CSVs
            self.update_codelist_csv()
            self.update_territory_csv()
            self.update_taskui_csv()
            self.update_task_csv()
            self.update_user_csv()
            
            # Step 6: Update configuration
            self.update_configuration()
            
            # Step 7: Save master translations
            self.save_master_translations()
            
            # Step 8: Regenerate translation CSVs
            self.regenerate_translations()
            
            # Summary
            print("\n" + "=" * 60)
            print("SUMMARY")
            print("=" * 60)
            for change in self.changes_summary:
                print(f"  ✓ {change}")
            
            if self.dry_run:
                print("\n[DRY-RUN] No files were modified")
            else:
                print(f"\n✓ Successfully switched default language:")
                print(f"  From: {self.current_default}")
                print(f"  To:   {self.target_language}")
                print(f"\n✓ Backup saved: {backup_path}")
            
            return True
            
        except Exception as e:
            print(f"\n✗ ERROR: {e}")
            import traceback
            traceback.print_exc()
            return False


def rollback(backup_name: str = None, scenario: str = None):
    """Restore files from a backup. Scenario from backup metadata, or --scenario / SITMUN_PROFILE."""
    tools_dir = Path(__file__).parent
    backup_dir = tools_dir / "backups"
    workspace_root = tools_dir.parent.parent
    
    if not backup_dir.exists():
        print("ERROR: No backups directory found")
        return False
    
    # Find backup
    if backup_name:
        backup_path = backup_dir / backup_name
    else:
        backups = sorted(backup_dir.glob("backup_*"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not backups:
            print("ERROR: No backups found")
            return False
        backup_path = backups[0]
    
    if not backup_path.exists():
        print(f"ERROR: Backup not found: {backup_path}")
        return False
    
    # Scenario: backup metadata > CLI/env
    scenario = (scenario or get_scenario_from_env()).strip().lower()
    metadata_file = backup_path / "backup_info.json"
    meta = {}
    if metadata_file.exists():
        with open(metadata_file, 'r') as f:
            meta = json.load(f)
        scenario = meta.get("scenario") or scenario
    if scenario not in SCENARIOS:
        scenario = "postgres"
    liquibase_root = get_liquibase_root(workspace_root, scenario)
    
    print("=" * 60)
    print(f"Rolling back from: {backup_path.name}")
    print("=" * 60)
    if meta:
        print(f"  Backup from: {meta.get('timestamp', '?')}")
        print(f"  Language: {meta.get('from_language', '?')} → {meta.get('to_language', '?')}")
    print(f"  Scenario: {scenario}")
    print()
    
    file_mappings = {
        "master-translations.json": tools_dir / "master-translations.json",
        "STM_LANGUAGE.csv": liquibase_root / "changelog/05_translations/STM_LANGUAGE.csv",
        "STM_CODELIST.csv": liquibase_root / "changelog/02_codelists/STM_CODELIST.csv",
        "STM_TER_TYP.csv": liquibase_root / "changelog/04_seed_data/STM_TER_TYP.csv",
        "STM_TSK_UI.csv": liquibase_root / "changelog/04_seed_data/STM_TSK_UI.csv",
        "STM_USER.csv": liquibase_root / "changelog/04_seed_data/STM_USER.csv",
        "STM_CONF.csv": liquibase_root / "changelog/06_params/STM_CONF.csv",
    }
    
    for backup_file, dest_path in file_mappings.items():
        source = backup_path / backup_file
        if source.exists():
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest_path)
            print(f"  ✓ Restored {backup_file}")
    
    print("\nRegenerating translation CSV files...")
    generate_script = tools_dir / "generate_translation_files.py"
    if generate_script.exists():
        try:
            subprocess.run(
                [sys.executable, str(generate_script), "--scenario", scenario],
                cwd=str(tools_dir),
                check=True,
            )
            print("✓ Translation files regenerated")
        except subprocess.CalledProcessError as e:
            print(f"WARNING: Failed to regenerate translation files: {e}")
    
    print("\n✓ Rollback complete")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Switch the default language for SITMUN deployment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 switch_default_language.py es              # Switch to Spanish
  python3 switch_default_language.py ca --dry-run    # Preview Catalan switch
  python3 switch_default_language.py --rollback      # Restore from latest backup
        """
    )
    
    parser.add_argument(
        "language",
        nargs="?",
        help="Target language code (es, ca, fr, oc-aranes)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying files"
    )
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Restore from most recent backup"
    )
    parser.add_argument(
        "--backup-name",
        help="Specific backup name to restore from"
    )
    parser.add_argument(
        "--scenario",
        choices=SCENARIOS,
        default=get_scenario_from_env(),
        help="Profile to modify (default: SITMUN_PROFILE or postgres)"
    )
    
    args = parser.parse_args()
    
    # Handle rollback
    if args.rollback:
        success = rollback(args.backup_name, scenario=args.scenario)
        sys.exit(0 if success else 1)
    
    # Require language for switch operation
    if not args.language:
        parser.error("language is required (unless using --rollback)")
    
    # Execute switch
    switcher = LanguageSwitcher(args.language, dry_run=args.dry_run, scenario=args.scenario)
    success = switcher.execute()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
