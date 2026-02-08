import pytest
from unittest.mock import patch

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app import create_app
from app.extensions import db

@pytest.fixture()
def app(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-secret-key-with-minimum-32-chars-for-security")
    
    # Pass TESTING=True during creation, not after
    app = create_app(config={'TESTING': True})  # ← Changed this line
    
    with app.app_context():
        db.drop_all()
        db.create_all()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture
def authenticated_user(app, client):
    """Create a user and return authentication tokens"""
    with app.app_context():
        # Register a new user
        response = client.post('/api/auth/register', json={
            'email': 'test@example.com',
            'password': 'testpass123'
        })
        assert response.status_code == 201
        data = response.get_json()
        
        return {
            'user_id': data['user']['id'],
            'access_token': data['access_token'],
            'refresh_token': data['refresh_token']
        }


@pytest.fixture
def mock_quote():
    """Mock fetch_quote in routes and processor"""
    with patch('app.market_data.fetch_quote') as mock:
        with patch('app.order_processor.fetch_quote', new=mock):
            with patch('app.routes.fetch_quote', new=mock):
                mock.return_value = {
                    'price': 150.00,
                    'exchange': 'NMS',
                    'currency': 'USD'
                }
                yield mock


@pytest.fixture
def mock_current_price():
    """Mock the get_current_price function"""
    with patch('app.routes.get_current_price') as mock:
        mock.return_value = 150.00
        yield mock


@pytest.fixture
def mock_company_name():
    """Mock the fetch_company_name function"""
    with patch('app.routes.fetch_company_name') as mock:
        mock.return_value = 'Apple Inc.'
        yield mock


@pytest.fixture
def mock_market_open():
    """Mock is_market_open across the entire app surface area"""
    with patch('app.market_data.is_market_open') as mock:
        # Patch the processor (background jobs)
        with patch('app.order_processor.is_market_open', new=mock):
            # Patch the routes (API endpoints for instant fill)
            with patch('app.routes.is_market_open', new=mock):
                mock.return_value = True
                yield mock