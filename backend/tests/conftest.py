"""Keep historical Task 1–5 regression fixtures deterministic and offline."""

import pytest
import socket


@pytest.fixture(autouse=True)
def scenario_profile(request, monkeypatch):
    # New public-data tests opt in explicitly; historical assertions intentionally
    # continue exercising the exact legacy scenario and documented demo edges.
    mode = "cached" if request.node.get_closest_marker("public_data") else "demo"
    monkeypatch.setenv("EVACROUTE_DATA_MODE", mode)
    monkeypatch.delenv("EVACROUTE_PROCESSED_DATA_PATH", raising=False)
    original_connect = socket.socket.connect
    def no_network(sock, address):
        # Windows asyncio uses loopback sockets for its internal wakeup pipe.
        if isinstance(address, tuple) and address[0] in ("127.0.0.1", "::1"):
            return original_connect(sock, address)
        raise AssertionError("Tests must use bundled data or mock external services")
    monkeypatch.setattr(socket.socket, "connect", no_network)
