# Monorepo import pins

Day 0 re-runs this import with the versions in `pins.txt`. This directory does not run it.

`git filter-repo` `a40bce548d2c` with git `2.56.0`. A component import looks like this. The message callback calls `rewrite_message` for that repository. The stack import omits `--to-subdirectory-filter`.

```text
git filter-repo --to-subdirectory-filter <directory> --refs refs/heads/main refs/heads/dev
```

The stack repository is imported at the root. Each other repository is imported with `--to-subdirectory-filter`:

| Old repository | Directory |
| --- | --- |
| `sitmun-backend-core` | `sitmun-backend` |
| `sitmun-proxy-middleware` | `sitmun-proxy` |
| `sitmun-admin-app` | `sitmun-admin` |
| `sitmun-viewer-app` | `sitmun-viewer` |
| `sitmun-mbtiles` | `sitmun-addons/sitmun-mbtiles` |
| `sitmun-shared` | `sitmun-common` |
| `edition-mobile-app` | `sitmun-mobile/sitmun-edition` |
| `touristic-mobile-app` | `sitmun-mobile/sitmun-touristic` |

Only `main` and `dev` are imported. Commit messages go through `rewrite_message` in `rewrite_message.py`: a bare `#N` becomes `sitmun/<oldrepo>#N`. An already qualified `sitmun/<repo>#N` stays.

`tag-map.tsv` names every tag that existed when it was written. `legacy` renames the tag to the destination column. `drop` omits it. The import fails when a live tag has no row. `sitmun-shared`, `touristic-mobile-app`, and `edition-mobile-app` have no tags. `1.2.7-DIPTA` is not a current tag.
