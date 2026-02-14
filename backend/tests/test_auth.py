def test_register_login_refresh(client):
    register_response = client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert register_response.status_code == 201
    register_payload = register_response.get_json()
    assert "user" in register_payload
    assert "access_token" not in register_payload
    assert "refresh_token" not in register_payload

    login_response = client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert login_response.status_code == 200
    login_payload = login_response.get_json()
    assert "user" in login_payload

    refresh_response = client.post("/api/auth/refresh")
    assert refresh_response.status_code == 200
    refresh_payload = refresh_response.get_json()
    assert "user" in refresh_payload
