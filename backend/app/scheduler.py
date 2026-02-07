from flask_apscheduler import APScheduler
from app.order_processor import process_pending_orders

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