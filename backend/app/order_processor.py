from decimal import Decimal
from app.extensions import db
from app.models import Order, Position, Account
from app.market_data import is_market_open, fetch_quote

def process_pending_orders():
    """
    Process all PENDING orders for symbols where market is now open.
    Run this periodically (e.g., every minute via scheduler).
    """

    pending_orders = Order.query.filter_by(status="PENDING").all()
    
    processed_count = 0
    
    for order in pending_orders:
        if not is_market_open(order.symbol):
            continue
        
        try:
            quote = fetch_quote(order.symbol)
            current_price = Decimal(str(quote["price"]))
        except Exception as e:
            print(f"Error fetching quote for {order.symbol}: {e}")
            continue
        
        account = Account.query.get(order.account_id)
        if not account:
            continue
        
        order_cost = current_price * Decimal(order.quantity)
        position = account.positions.filter_by(symbol=order.symbol).first()
        
        try:
            if order.side == "BUY":
                if account.cash_balance < order_cost:
                    order.status = "REJECTED"
                    order.status_text = "Insufficient cash"
                    db.session.commit()
                    continue
                
                account.cash_balance -= order_cost
                
                if position:
                    total_shares = position.quantity + order.quantity
                    total_cost = (Decimal(position.avg_price) * Decimal(position.quantity)) + order_cost
                    position.avg_price = total_cost / Decimal(total_shares)
                    position.quantity = total_shares
                else:
                    position = Position(
                        account_id=account.id,
                        symbol=order.symbol,
                        quantity=order.quantity,
                        avg_price=current_price,
                    )
                    db.session.add(position)
                
                order.status = "FILLED"
                order.price = current_price
                order.status_text = "OPEN"
            
            else:  # SELL
                if not position or position.quantity < order.quantity:
                    order.status = "REJECTED"
                    order.status_text = "Insufficient shares"
                    db.session.commit()
                    continue
                
                account.cash_balance += order_cost
                position.quantity -= order.quantity
                
                if position.quantity == 0:
                    db.session.delete(position)
                
                # Find and mark the original buy order as closed
                buy_orders = Order.query.filter_by(
                    account_id=account.id,
                    symbol=order.symbol,
                    side="BUY",
                    status_text="OPEN"
                ).all()
                
                remaining_qty = order.quantity
                for buy_order in buy_orders:
                    if remaining_qty <= 0:
                        break
                    if buy_order.quantity <= remaining_qty:
                        buy_order.status_text = "CLOSED"
                        remaining_qty -= buy_order.quantity
                    else:
                        break
                
                order.status = "FILLED"
                order.price = current_price
                order.status_text = "CLOSED"
            
            db.session.commit()
            processed_count += 1
            
        except Exception as e:
            db.session.rollback()
            print(f"Error processing order {order.id}: {e}")
    
    return processed_count