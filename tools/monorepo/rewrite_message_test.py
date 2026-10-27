"""Bare issue numbers in imported commit messages gain a repository prefix."""

import unittest

from rewrite_message import rewrite_message


class RewriteMessageTest(unittest.TestCase):
    def test_bare_number_gains_the_old_repository(self):
        self.assertEqual(
            rewrite_message("Fixes #4", "sitmun-shared"),
            "Fixes sitmun/sitmun-shared#4",
        )

    def test_already_qualified_number_stays(self):
        self.assertEqual(
            rewrite_message("sitmun/sitmun-shared#4", "sitmun-shared"),
            "sitmun/sitmun-shared#4",
        )

    def test_stack_issue_uses_the_stack_repository(self):
        self.assertEqual(
            rewrite_message("#105", "sitmun-application-stack"),
            "sitmun/sitmun-application-stack#105",
        )


if __name__ == "__main__":
    unittest.main()
