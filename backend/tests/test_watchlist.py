def _fake_watchlist(symbols=None, limit=20):
    symbols = symbols or []
    return [
        {
            "ticker": symbol,
            "company_name": symbol,
            "value": 100.0,
            "change_1d": 1.0,
            "52w_range": [90.0, 110.0],
        }
        for symbol in symbols
    ]


def test_watchlist_requires_auth(client):
    response = client.get("/api/market/watchlist")
    assert response.status_code in {401, 422}


def test_watchlist_add_remove(client, monkeypatch):
    import app.routes as routes

    monkeypatch.setattr(routes, "fetch_watchlist", _fake_watchlist)

    register_response = client.post(
        "/api/auth/register",
        json={"email": "watcher@example.com", "password": "password123"},
    )
    assert register_response.status_code == 201
    tokens = register_response.get_json()
    access_token = tokens["access_token"]

    add_response = client.post(
        "/api/market/watchlist",
        json={"symbol": "AAPL"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert add_response.status_code == 200
    add_payload = add_response.get_json()
    assert add_payload["items"][0]["ticker"] == "AAPL"

    remove_response = client.delete(
        "/api/market/watchlist/AAPL",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert remove_response.status_code == 200
    remove_payload = remove_response.get_json()
    assert remove_payload["items"] == []
