"""
Manual test for price alert email delivery.
Price alerts disabled - test commented out.

Run with: pytest tests/test_price_alert_email.py -v -s

Loads RESEND_API_KEY from backend/.env.
Uses the logged-in user flow: register -> create alert via API -> email sent to that user.
Resend test mode only allows sending to the account owner's email (mrchristianm6@gmail.com).
"""
# import os
# from pathlib import Path

# from dotenv import load_dotenv
# import pytest

# load_dotenv(Path(__file__).parent.parent / ".env")
# from unittest.mock import patch

# from app.extensions import db
# from app.models import PriceAlert, User
# from app.price_alert_processor import process_price_alerts


# @pytest.fixture()
# def app_with_logged_in_user(monkeypatch):
#     """App with a user registered via API (simulates logged-in user)."""
#     import sys

#     backend_dir = Path(__file__).parent.parent
#     sys.path.insert(0, str(backend_dir))

#     from app import create_app

#     monkeypatch.setenv("DATABASE_URL", "sqlite://")
#     monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-secret-key-with-minimum-32-chars-for-security")

#     app = create_app(config={"TESTING": True})

#     with app.app_context():
#         db.drop_all()
#         db.create_all()

#     yield app

#     with app.app_context():
#         db.session.remove()
#         db.drop_all()


# @pytest.mark.skipif(
#     not os.environ.get("RESEND_API_KEY"),
#     reason="RESEND_API_KEY required for email test. Run: RESEND_API_KEY=your_key pytest tests/test_price_alert_email.py -v -s",
# )
# def test_price_alert_email_fire_off(app_with_logged_in_user):
#     """
#     Simulates logged-in user creating a price alert; email is sent to that user.
#     Run from backend dir: pytest tests/test_price_alert_email.py -v -s
#     """
#     client = app_with_logged_in_user.test_client()

#     with app_with_logged_in_user.app_context():
#         response = client.post(
#             "/api/auth/register",
#             json={"email": "mrchristianm6@gmail.com", "password": "testpass123"},
#         )
#         assert response.status_code == 201

#         with patch("app.routes.get_current_price") as mock_price:
#             mock_price.return_value = 100.0
#             alert_response = client.post(
#                 "/api/price-alerts",
#                 json={"symbol": "TEST", "threshold_percent": -5.0},
#             )
#         assert alert_response.status_code == 201
#         alert_data = alert_response.get_json()
#         alert_id = alert_data["alert"]["id"]

#         with patch("app.price_alert_processor.fetch_quote") as mock_fetch:
#             mock_fetch.return_value = {"price": 94.0}
#             count = process_price_alerts()

#         assert count == 1
#         alert = db.session.get(PriceAlert, alert_id)
#         assert alert.triggered is True

#         user = db.session.get(User, alert.user_id)
#         assert user.email == "mrchristianm6@gmail.com"
