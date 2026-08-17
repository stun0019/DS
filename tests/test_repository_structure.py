"""Repository boundaries that keep automation maintainable."""

from __future__ import annotations

import importlib
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class RepositoryStructureTests(unittest.TestCase):
    def test_data_scripts_are_import_safe(self):
        update_module = importlib.import_module("scripts.update_stock_data")
        validate_module = importlib.import_module("scripts.validate_stock_data")

        self.assertTrue(callable(update_module.main))
        self.assertTrue(callable(validate_module.main))

    def test_workflow_delegates_to_versioned_scripts(self):
        workflow_path = ROOT / ".github" / "workflows" / "update-stock-data.yml"
        workflow = workflow_path.read_text(encoding="utf-8")

        self.assertNotIn("python <<'PY'", workflow)
        self.assertIn("python scripts/update_stock_data.py", workflow)
        self.assertIn("python scripts/validate_stock_data.py", workflow)
        self.assertLess(len(workflow.splitlines()), 100)


if __name__ == "__main__":
    unittest.main()
