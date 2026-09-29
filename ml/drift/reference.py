"""ml/drift/reference.py

The handbook lists reference.py and monitor.py as separate files inside ml/drift/.
reference_stats() was added to monitor.py for convenience; this module re-exports
it so both import paths work.
"""
from ml.drift.monitor import reference_stats  # noqa: F401  re-export

__all__ = ["reference_stats"]
