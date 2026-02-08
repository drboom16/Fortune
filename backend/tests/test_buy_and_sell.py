"""
Test file for buy and sell stock operations with pending order support
Tests cover: market hours, pending orders, instant fulfillment, order processing
"""
import pytest
from decimal import Decimal
from unittest.mock import patch

from app.extensions import db
from app.models import Order, Position


class TestBuyStockMarketOpen:
    """Test cases for buying stocks when market is OPEN"""
    
    def test_buy_stock_market_open_instant_fill(self, client, authenticated_user, mock_quote, mock_market_open, mock_company_name):
        """Test that buy orders are filled instantly when market is open"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # Market is open
        mock_market_open.return_value = True
        
        response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify order was FILLED immediately
        assert data['order']['symbol'] == 'AAPL'
        assert data['order']['side'] == 'BUY'
        assert data['order']['quantity'] == 10
        assert data['order']['price'] == 150.00
        assert data['order']['status'] == 'FILLED'
        assert data['order']['status_text'] == 'OPEN'
        
        # Verify account cash was deducted immediately
        assert data['account']['cash_balance'] == 100000.00 - (150.00 * 10)
    
    def test_buy_stock_insufficient_funds(self, client, authenticated_user, mock_quote, mock_market_open):
        """Test buying stock with insufficient cash"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        mock_market_open.return_value = True
        
        response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10000
        }, headers=headers)
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'Insufficient cash' in data['error']


class TestBuyStockMarketClosed:
    """Test cases for buying stocks when market is CLOSED"""
    
    def test_buy_stock_market_closed_creates_pending(self, app, client, authenticated_user, mock_quote, mock_market_open, mock_company_name):
        """Test that buy orders are PENDING when market is closed"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # Market is closed
        mock_market_open.return_value = False
        
        response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify order is PENDING
        assert data['order']['status'] == 'PENDING'
        
        # Verify account cash was NOT deducted yet
        assert data['account']['cash_balance'] == 100000.00
        
        # Verify no position was created yet
        with app.app_context():
            position = db.session.execute(
                db.select(Position).filter_by(symbol='AAPL')
            ).scalar_one_or_none()
            assert position is None
    
    def test_pending_order_still_validates_funds(self, client, authenticated_user, mock_quote, mock_market_open):
        """Test that pending orders still validate available funds"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        mock_market_open.return_value = False
        
        # Try to buy more than we can afford
        response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10000
        }, headers=headers)
        
        assert response.status_code == 400
        assert 'Insufficient cash' in response.get_json()['error']


class TestSellStockMarketOpen:
    """Test cases for selling stocks when market is OPEN"""
    
    def test_sell_stock_market_open_instant_fill(self, app, client, authenticated_user, mock_quote, mock_current_price, mock_market_open, mock_company_name):
        """Test that sell orders are filled instantly when market is open"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        mock_market_open.return_value = True
        
        # Buy stock first
        buy_response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        buy_order_id = buy_response.get_json()['order']['id']
        
        # Sell it at higher price
        mock_current_price.return_value = 160.00
        response = client.post('/api/sell', json={
            'id': buy_order_id,
            'symbol': 'AAPL',
            'quantity': 10
        }, headers=headers)
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify sell order was FILLED
        assert data['order']['side'] == 'SELL'
        assert data['order']['status'] == 'FILLED'
        assert data['order']['status_text'] == 'CLOSED'
        
        # Verify cash was added back immediately (with profit)
        expected_cash = 100000.00 - (150.00 * 10) + (160.00 * 10)
        assert data['account']['cash_balance'] == expected_cash
        
        # Verify buy order was marked as closed
        with app.app_context():
            buy_order = db.session.get(Order, buy_order_id)
            assert buy_order.status_text == 'CLOSED'
    
    def test_sell_stock_insufficient_shares(self, client, authenticated_user, mock_current_price, mock_market_open):
        """Test selling more shares than owned"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        mock_market_open.return_value = True
        
        response = client.post('/api/sell', json={
            'id': 1,
            'symbol': 'AAPL',
            'quantity': 10
        }, headers=headers)
        
        assert response.status_code == 400
        assert 'Insufficient shares' in response.get_json()['error']


class TestSellStockMarketClosed:
    """Test cases for selling stocks when market is CLOSED"""
    
    def test_sell_stock_market_closed_creates_pending(self, app, client, authenticated_user, mock_quote, mock_current_price, mock_market_open, mock_company_name):
        """Test that sell orders are PENDING when market is closed"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # Buy stock when market is open
        mock_market_open.return_value = True
        buy_response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        buy_order_id = buy_response.get_json()['order']['id']
        initial_cash = buy_response.get_json()['account']['cash_balance']
        
        # Market closes
        mock_market_open.return_value = False
        
        # Try to sell
        mock_current_price.return_value = 160.00
        response = client.post('/api/sell', json={
            'id': buy_order_id,
            'symbol': 'AAPL',
            'quantity': 10
        }, headers=headers)
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify sell order is PENDING
        assert data['order']['status'] == 'PENDING'
        assert data['order']['status_text'] == 'PENDING_CLOSE'
        
        # Verify cash was NOT added back yet
        assert data['account']['cash_balance'] == initial_cash
        
        # Verify position still exists
        with app.app_context():
            position = db.session.execute(
                db.select(Position).filter_by(symbol='AAPL')
            ).scalar_one()
            assert position.quantity == 10
            
            # Verify buy order is still OPEN (not closed yet)
            buy_order = db.session.get(Order, buy_order_id)
            assert buy_order.status_text == 'OPEN'


class TestOrderProcessor:
    """Test cases for background order processor"""
    
    def test_process_pending_buy_orders(self, app, client, authenticated_user, mock_quote, mock_market_open, mock_company_name):
        """Test that pending BUY orders are processed when market opens"""
        from app.order_processor import process_pending_orders
        
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # Create order when market is closed
        mock_market_open.return_value = False
        response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        
        order_id = response.get_json()['order']['id']
        
        # Verify order is PENDING
        with app.app_context():
            order = db.session.get(Order, order_id)
            assert order.status == 'PENDING'
        
        # Market opens
        mock_market_open.return_value = True
        
        # Run background processor
        with app.app_context():
            processed = process_pending_orders()
            assert processed == 1
            
            # Verify order is now FILLED
            order = db.session.get(Order, order_id)
            assert order.status == 'FILLED'
            assert order.status_text == 'OPEN'
            
            # Verify position was created
            position = db.session.execute(
                db.select(Position).filter_by(symbol='AAPL')
            ).scalar_one()
            assert position.quantity == 10
    
    def test_process_pending_sell_orders(self, app, client, authenticated_user, mock_quote, mock_current_price, mock_market_open, mock_company_name):
        """Test that pending SELL orders are processed when market opens"""
        from app.order_processor import process_pending_orders
        
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # Buy stock when market is open
        mock_market_open.return_value = True
        buy_response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        buy_order_id = buy_response.get_json()['order']['id']
        
        # Create sell order when market is closed
        mock_market_open.return_value = False
        mock_current_price.return_value = 160.00
        sell_response = client.post('/api/sell', json={
            'id': buy_order_id,
            'symbol': 'AAPL',
            'quantity': 10
        }, headers=headers)
        sell_order_id = sell_response.get_json()['order']['id']
        
        # Verify sell order is PENDING
        with app.app_context():
            sell_order = db.session.get(Order, sell_order_id)
            assert sell_order.status == 'PENDING'
        
        # Market opens
        mock_market_open.return_value = True
        
        # Run background processor
        with app.app_context():
            processed = process_pending_orders()
            assert processed == 1
            
            # Verify sell order is now FILLED
            sell_order = db.session.get(Order, sell_order_id)
            assert sell_order.status == 'FILLED'
            assert sell_order.status_text == 'CLOSED'
            
            # Verify position was removed
            position = db.session.execute(
                db.select(Position).filter_by(symbol='AAPL')
            ).scalar_one_or_none()
            assert position is None
            
            # Verify buy order was marked as closed
            buy_order = db.session.get(Order, buy_order_id)
            assert buy_order.status_text == 'CLOSED'
    
    def test_processor_rejects_orders_without_funds(self, app, client, authenticated_user, mock_quote, mock_market_open, mock_company_name):
        """Test that processor rejects pending orders if funds are no longer available"""
        from app.order_processor import process_pending_orders
        from app.models import Account
        
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # Create order when market is closed
        mock_market_open.return_value = False
        response = client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        order_id = response.get_json()['order']['id']
        
        # Simulate user spending all their cash elsewhere
        with app.app_context():
            account = db.session.execute(
                db.select(Account).filter_by(user_id=authenticated_user['user_id'])
            ).scalar_one()
            account.cash_balance = Decimal('0')
            db.session.commit()
        
        # Market opens
        mock_market_open.return_value = True
        
        # Run processor
        with app.app_context():
            processed = process_pending_orders()
            assert processed == 0  # No orders processed
            
            # Verify order was REJECTED
            order = db.session.get(Order, order_id)
            assert order.status == 'REJECTED'
            assert 'Insufficient cash' in order.status_text


class TestPortfolioBreakdown:
    """Test cases for portfolio breakdown"""
    
    def test_breakdown_shows_only_open_orders(self, client, authenticated_user, mock_quote, mock_current_price, mock_market_open, mock_company_name):
        """Test that breakdown only shows OPEN orders (not CLOSED or PENDING)"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        mock_market_open.return_value = True
        
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
        
        # Should only show second order (first is CLOSED)
        assert len(data['order_history']) == 1
        assert data['order_history'][0]['quantity'] == 5
    
    def test_breakdown_excludes_pending_orders(self, client, authenticated_user, mock_quote, mock_market_open, mock_company_name):
        """Test that breakdown doesn't show PENDING orders"""
        headers = {'Authorization': f'Bearer {authenticated_user["access_token"]}'}
        
        # Create filled order
        mock_market_open.return_value = True
        client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 10
        }, headers=headers)
        
        # Create pending order
        mock_market_open.return_value = False
        client.post('/api/orders', json={
            'symbol': 'AAPL',
            'side': 'BUY',
            'quantity': 5
        }, headers=headers)
        
        # Get breakdown
        response = client.get('/api/portfolio/breakdown/AAPL', headers=headers)
        data = response.get_json()
        
        # Should only show the filled order
        assert len(data['order_history']) == 1
        assert data['order_history'][0]['quantity'] == 10