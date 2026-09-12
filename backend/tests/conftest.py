"""Keep historical Task 1–5 regression fixtures deterministic and offline."""

import pytest


@pytest.fixture(autouse=True)
def scenario_profile(request, monkeypatch):
    # New public-data tests opt in explicitly; historical assertions intentionally
    # continue exercising the exact legacy scenario and documented demo edges.
    mode = "cached" if request.node.get_closest_marker("public_data") else "demo"
    monkeypatch.setenv("EVACROUTE_DATA_MODE", mode)
    monkeypatch.delenv("EVACROUTE_PROCESSED_DATA_PATH", raising=False)
