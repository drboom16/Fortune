"""
Test file for buy and sell stock operations
"""
import pytest
from decimal import Decimal

from app.extensions import db
from app.models import Order, Position


class TestBuyStock:
    """Test cases for buying stocks"""
    
    def test_buy_stock_success(self, client, authenticated_user, mock_quote, mock_company_name):
        """Test successful stock purchase"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify order was created
        assert data['order']['symbol'] == 'AAPL'
        assert data['order']['side'] == 'BUY'
        assert data['order']['quantity'] == 10
        assert data['order']['price'] == 150.00
        assert data['order']['status'] == 'FILLED'
        assert data['order']['status_text'] == 'OPEN'
        
        # Verify account cash was deducted
        assert data['account']['cash_balance'] == 100000.00 - (150.00 * 10)
    
    def test_buy_stock_insufficient_funds(self, client, authenticated_user, mock_quote):
        """Test buying stock with insufficient cash"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10000
        }, headers=headers)
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'Insufficient cash' in data['error']
    
    def test_buy_stock_multiple_times_avg_price(self, app, client, authenticated_user, mock_quote, mock_company_name):
        """Test that buying same stock multiple times updates average price"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # First purchase at $150
        client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        
        # Second purchase at different price
        mock_quote.return_value = {'price': 160.00, 'exchange': 'NMS', 'currency': 'USD'}
        client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        
        # Check position
        with app.app_context():
            position = db.session.execute(db.select(Position).filter_by(symbol='AAPL')).scalar_one()
            assert position.quantity == 20
            assert float(position.avg_price) == 155.00


class TestSellStock:
    """Test cases for selling stocks"""
    
    def test_sell_stock_success(self, app, client, authenticated_user, mock_quote, mock_current_price, mock_company_name):
        """Test successful stock sale"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # Buy stock
        buy_response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        buy_order_id = buy_response.get_json()['order']['id']
        
        # Sell it
        mock_current_price.return_value = 160.00
        response = client.post('/api/sell', json={
            'id': buy_order_id,
            'symbol': 'AAPL',
            'quantity': 10
        }, headers=headers)
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['order']['side'] == 'SELL'
        assert data['order']['status_text'] == 'CLOSED'
        
        # Verify buy order was marked as closed
        with app.app_context():
            buy_order = db.session.get(Order, buy_order_id)
            assert buy_order.status_text == 'CLOSED'
    
    def test_sell_stock_insufficient_shares(self, client, authenticated_user, mock_current_price):
        """Test selling more shares than owned"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        response = client.post('/api/sell', json={
            'id': 1,
            'symbol': 'AAPL',
            'quantity': 10
        }, headers=headers)
        
        assert response.status_code == 400
        assert 'Insufficient shares' in response.get_json()['error']


class TestPortfolioBreakdown:
    """Test cases for portfolio breakdown"""
    
    def test_breakdown_shows_only_open_orders(self, client, authenticated_user, mock_quote, mock_current_price, mock_company_name):
        """Test that breakdown only shows open orders"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # Buy twice
        buy1 = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        buy1_id = buy1.get_json()['order']['id']
        
        client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 5
        }, headers=headers)
        
        # Sell first order
        client.post('/api/sell', json={
            'id': buy1_id,
            'symbol': 'AAPL',
            'quantity': 10
        }, headers=headers)
        
        # Get breakdown
        response = client.get('/api/portfolio/breakdown/AAPL', headers=headers)
        data = response.get_json()
        
        # Should only show second order
        assert len(data['order_history']) == 1
        assert data['order_history'][0]['quantity'] == 5