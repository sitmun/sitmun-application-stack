#!/usr/bin/env python3
"""Orden topológico de pasos de migración SITMUN 2→3.

Grafo = FK del esquema Oracle v3 que los INSERT de 10_migrate_core.sql pueden
rellenar (sin seed de plataforma). Algoritmo:

1. Nivel = 0 si no hay deps; si no, 1 + max(nivel de deps).
2. Orden = por nivel ascendente, y dentro del nivel por id lexicográfico.

Es un orden topológico válido (equiv. a Kahn con prioridad por nivel).

Uso:
  python3 06_topo_order.py              # imprime orden
  python3 06_topo_order.py --check      # verifica 10_migrate_core.sql
  python3 06_topo_order.py --apply      # reordena 10_migrate_core.sql
"""

from __future__ import annotations

import argparse
import re
import sys
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent
MIGRATE_SQL = HERE / "10_migrate_core.sql"

# id → tablas destino que debe preceder (aristas: dep → step)
# STM_TER_TYP / idiomas / codelist / STM_CONF siguen siendo seed (no pasos).
DEPS: dict[str, frozenset[str]] = {
    "STM_CONNECT": frozenset(),
    "STM_USER": frozenset(),
    "STM_GTER_TYP": frozenset(),
    "STM_TERRITORY": frozenset({"STM_GTER_TYP"}),
    "STM_GRP_TER": frozenset({"STM_TERRITORY"}),
    "STM_ROLE": frozenset(),
    "STM_GRP_GI": frozenset(),
    "STM_GRP_TSK": frozenset(),
    "STM_TSK_TYP": frozenset(),
    "STM_TSK_UI": frozenset(),
    "STM_SERVICE": frozenset(),
    "STM_PAR_SER": frozenset({"STM_SERVICE"}),
    "STM_GEOINFO": frozenset({"STM_SERVICE", "STM_CONNECT"}),
    "STM_PAR_GI": frozenset({"STM_GEOINFO"}),
    "STM_AVAIL_GI": frozenset({"STM_GEOINFO", "STM_TERRITORY"}),
    "STM_GGI_GI": frozenset({"STM_GRP_GI", "STM_GEOINFO"}),
    "STM_ROL_GGI": frozenset({"STM_ROLE", "STM_GRP_GI"}),
    "STM_BACKGRD": frozenset({"STM_GRP_GI"}),
    "STM_TASK": frozenset(
        {
            "STM_CONNECT",
            "STM_GEOINFO",
            "STM_SERVICE",
            "STM_GRP_TSK",
            "STM_TSK_TYP",
            "STM_TSK_UI",
        }
    ),
    "STM_AVAIL_TSK": frozenset({"STM_TASK", "STM_TERRITORY"}),
    "STM_ROL_TSK": frozenset({"STM_TASK", "STM_ROLE"}),
    "STM_APP": frozenset({"STM_GRP_GI"}),
    "STM_APP_ROL": frozenset({"STM_APP", "STM_ROLE"}),
    "STM_APP_BCKG": frozenset({"STM_APP", "STM_BACKGRD"}),
    "STM_PAR_APP": frozenset({"STM_APP"}),
    "STM_USR_CONF": frozenset({"STM_USER", "STM_TERRITORY", "STM_ROLE"}),
    "STM_POST": frozenset({"STM_USER", "STM_TERRITORY"}),
    "STM_TREE": frozenset(),
    "STM_TREE_NOD": frozenset({"STM_TREE", "STM_GEOINFO", "STM_TASK"}),
    "STM_APP_TREE": frozenset({"STM_APP", "STM_TREE"}),
    "STM_SEQUENCE": frozenset(),  # se completa tras construir el grafo
}

DEPS["STM_SEQUENCE"] = frozenset(k for k in DEPS if k != "STM_SEQUENCE")

PROMPT_RE = re.compile(r"^PROMPT === (\S+)", re.MULTILINE)


def topo_levels(deps: dict[str, frozenset[str]]) -> tuple[list[str], dict[str, int]]:
    """Orden topológico por nivel de dependencia + id."""
    nodes = set(deps)
    for ds in deps.values():
        unknown = ds - nodes
        if unknown:
            raise ValueError(f"Dependencias desconocidas: {sorted(unknown)}")

    visiting: set[str] = set()

    @lru_cache(maxsize=None)
    def level(n: str) -> int:
        if n in visiting:
            raise ValueError(f"Ciclo en el grafo de migración en {n}")
        visiting.add(n)
        try:
            ds = deps[n]
            return 0 if not ds else 1 + max(level(d) for d in ds)
        finally:
            visiting.remove(n)

    levels = {n: level(n) for n in nodes}
    ranked = sorted(nodes, key=lambda n: (levels[n], n))
    return ranked, levels


def parse_sections(text: str) -> tuple[str, dict[str, str], str]:
    """Separa preámbulo, bloques PROMPT === ID y epílogo (migrate_core terminado)."""
    lines = text.splitlines(keepends=True)
    preamble: list[str] = []
    sections: dict[str, list[str]] = {}
    current: str | None = None
    epilogue: list[str] = []
    in_epilogue = False

    for line in lines:
        if in_epilogue:
            epilogue.append(line)
            continue
        m = PROMPT_RE.match(line)
        if m:
            sid = m.group(1)
            if sid.startswith("migrate_core"):
                in_epilogue = True
                epilogue.append(line)
                current = None
                continue
            current = sid
            sections[current] = [line]
            continue
        if current is None:
            preamble.append(line)
        else:
            sections[current].append(line)

    return (
        "".join(preamble),
        {k: "".join(v) for k, v in sections.items()},
        "".join(epilogue),
    )


def order_comment(order: list[str], levels: dict[str, int]) -> str:
    lines = [
        "-- Orden de INSERT (topo por nivel de FK; ver 06_topo_order.py).",
        "-- Regenerar: python3 06_topo_order.py --apply",
        "--",
    ]
    for i, step in enumerate(order, 1):
        deps = sorted(DEPS[step])
        if step == "STM_SEQUENCE":
            dep_txt = "(todos los pasos previos)"
        elif deps:
            dep_txt = ", ".join(deps)
        else:
            dep_txt = "∅"
        lines.append(f"--   {i:02d}. [L{levels[step]}] {step}  ← {dep_txt}")
    lines.append("")
    return "\n".join(lines)


def strip_old_order_comment(preamble: str) -> str:
    lines = preamble.splitlines(keepends=True)
    out: list[str] = []
    skipping = False
    for line in lines:
        if line.startswith("-- Orden de INSERT"):
            skipping = True
            continue
        if skipping:
            # Bloque hasta la línea en blanco previa a SET DEFINE / WHENEVER.
            if line.startswith("--"):
                continue
            skipping = False
            if line.strip() == "":
                continue
        out.append(line)
    return "".join(out)


def rebuild(
    preamble: str,
    sections: dict[str, str],
    epilogue: str,
    order: list[str],
    levels: dict[str, int],
) -> str:
    missing = [s for s in order if s not in sections]
    extra = sorted(set(sections) - set(order))
    if missing:
        raise SystemExit(f"Faltan secciones en SQL: {missing}")
    if extra:
        raise SystemExit(f"Secciones en SQL no modeladas en DEPS: {extra}")

    body = "".join(sections[s] if sections[s].endswith("\n") else sections[s] + "\n" for s in order)
    pre = strip_old_order_comment(preamble)
    # Insertar comentario de orden tras el bloque de convenciones / antes de SET DEFINE
    marker = "SET DEFINE OFF"
    comment = order_comment(order, levels)
    if marker in pre:
        pre = pre.replace(marker, comment + marker, 1)
    else:
        pre = comment + pre
    return pre + body + epilogue


def current_sql_order(text: str) -> list[str]:
    return [
        m.group(1)
        for m in PROMPT_RE.finditer(text)
        if not m.group(1).startswith("migrate_core")
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 si el SQL no sigue el orden topo")
    parser.add_argument("--apply", action="store_true", help="reescribe 10_migrate_core.sql")
    args = parser.parse_args()

    order, levels = topo_levels(DEPS)

    if not args.check and not args.apply:
        for i, step in enumerate(order, 1):
            print(f"{i:02d}  L{levels[step]}  {step}")
        return 0

    text = MIGRATE_SQL.read_text(encoding="utf-8")
    preamble, sections, epilogue = parse_sections(text)
    actual = current_sql_order(text)

    if args.check:
        if actual != order:
            print("Orden actual ≠ topo por niveles:", file=sys.stderr)
            for i, (a, e) in enumerate(zip(actual, order), 1):
                if a != e:
                    print(f"  pos {i}: hay {a!r}, esperado {e!r}", file=sys.stderr)
            if len(actual) != len(order):
                print(f"  longitudes {len(actual)} vs {len(order)}", file=sys.stderr)
            return 1
        print("OK: 10_migrate_core.sql sigue el orden topológico.")
        return 0

    new_text = rebuild(preamble, sections, epilogue, order, levels)
    MIGRATE_SQL.write_text(new_text, encoding="utf-8")
    print(f"Reordenado {MIGRATE_SQL.name} ({len(order)} pasos).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
