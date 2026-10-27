"""Rewrite bare GitHub issue numbers onto the old repository name."""

import re

_BARE_ISSUE = re.compile(r"(?<![\w/])#(\d+)")


def rewrite_message(message: str, repo: str) -> str:
    return _BARE_ISSUE.sub(rf"sitmun/{repo}#\1", message)
