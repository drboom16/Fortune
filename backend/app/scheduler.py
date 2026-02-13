from flask_apscheduler import APScheduler
from app.order_processor import process_pending_orders
from app.price_alert_processor import process_price_alerts

scheduler = APScheduler()


def init_scheduler(app):
    """Initialize scheduler with Flask app"""
    scheduler.init_app(app)
    scheduler.start()
    
    @scheduler.task('interval', id='process_pending_orders', minutes=1)
    def scheduled_job():
        """This automatically runs with app context"""
        with scheduler.app.app_context():
            count = process_pending_orders()
            print(f"Processed {count} pending orders")
    
    @scheduler.task('interval', id='process_price_alerts', minutes=2)
    def price_alert_job():
        """Check price alerts every 2 minutes and send emails when thresholds are reached"""
        with scheduler.app.app_context():
            count = process_price_alerts()
            if count > 0:
                print(f"Triggered {count} price alert(s)")