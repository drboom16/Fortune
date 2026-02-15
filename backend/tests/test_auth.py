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


def test_logout_revokes_tokens_and_blocks_further_use(app, client):
    """Logout adds tokens to revoked_tokens; revoked tokens are rejected."""
    from app.models import RevokedToken

    # Register and login
    client.post(
        "/api/auth/register",
        json={"email": "revoke@example.com", "password": "password123"},
    )
    client.post(
        "/api/auth/login",
        json={"email": "revoke@example.com", "password": "password123"},
    )

    # /auth/me works while logged in
    me_before = client.get("/api/auth/me")
    assert me_before.status_code == 200

    # Logout
    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200

    # Tokens are in revoked_tokens table
    with app.app_context():
        revoked = RevokedToken.query.all()
        assert len(revoked) >= 1  # At least access or refresh token

    # /auth/me fails with revoked token
    me_after = client.get("/api/auth/me")
    assert me_after.status_code == 401

    # Refresh also fails
    refresh_after = client.post("/api/auth/refresh")
    assert refresh_after.status_code == 401


def test_logout_without_token_succeeds(client):
    """Logout without cookies still returns 200 (idempotent)."""
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 200
