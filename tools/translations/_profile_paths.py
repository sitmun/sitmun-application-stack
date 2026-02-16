"""Resolve Liquibase profile paths by scenario (SITMUN_PROFILE)."""

import os
from pathlib import Path

SCENARIOS = ("development", "postgres", "oracle")
DEFAULT_SCENARIO = "postgres"


def get_scenario_from_env() -> str:
    """Scenario from SITMUN_PROFILE, or default."""
    return os.environ.get("SITMUN_PROFILE", DEFAULT_SCENARIO).strip().lower()


def get_liquibase_root(workspace_root: Path, scenario: str) -> Path:
    """
    Liquibase root for the given scenario.
    development → profiles/development/backend/liquibase
    postgres | oracle → profiles/<scenario>/liquibase
    """
    scenario = (scenario or DEFAULT_SCENARIO).strip().lower()
    if scenario not in SCENARIOS:
        raise ValueError(f"scenario must be one of {SCENARIOS}, got {scenario!r}")
    if scenario == "development":
        return workspace_root / "profiles" / "development" / "backend" / "liquibase"
    return workspace_root / "profiles" / scenario / "liquibase"
