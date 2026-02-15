from datetime import datetime, timezone

from flask_apscheduler import APScheduler
from app.extensions import db
from app.models import RevokedToken
from app.order_processor import process_pending_orders
from app.price_alert_processor import process_price_alerts

scheduler = APScheduler()


def init_scheduler(app):
    """Initialize scheduler with Flask app"""
    scheduler.init_app(app)
    scheduler.start()

    @scheduler.task('interval', id='prune_revoked_tokens', hours=24)
    def prune_revoked_tokens():
        """Remove expired revoked tokens to keep table small"""
        with scheduler.app.app_context():
            deleted = db.session.query(RevokedToken).filter(
                RevokedToken.expires_at < datetime.now(timezone.utc)
            ).delete()
            db.session.commit()
            if deleted:
                print(f"Pruned {deleted} expired revoked token(s)")

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