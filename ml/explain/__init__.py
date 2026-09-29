"""ml/explain package init — re-exports Explainer from the sibling explain.py file.

Both ml/explain.py (containing the Explainer class) and ml/explain/ (the
directory with shap_explain.py) exist in the repo.  Python resolves
``ml.explain`` to the directory/package, so without this file the import in
api/services/scorer.py would raise ImportError at API startup.
"""
import importlib.util
import sys
from pathlib import Path

# Load ml/explain.py directly (the sibling file one directory above us)
# so the package directory does not shadow it.
_file = Path(__file__).resolve().parent.parent / "explain.py"
_spec = importlib.util.spec_from_file_location("ml._explain_impl", _file)
_mod = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
_spec.loader.exec_module(_mod)  # type: ignore[union-attr]
sys.modules.setdefault("ml._explain_impl", _mod)

Explainer = _mod.Explainer

__all__ = ["Explainer"]
