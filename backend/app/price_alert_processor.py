"""Process price alerts and send emails via Resend when thresholds are reached."""
import os

from .extensions import db
from .market_data import fetch_quote
from .models import PriceAlert, User


def get_current_price(symbol: str) -> float:
    """Fetch current price for a symbol."""
    try:
        quote = fetch_quote(symbol)
        return float(quote.get("price", 0) or 0)
    except Exception:
        return 0.0


def send_price_alert_email(to_email: str, symbol: str, base_price: float, current_price: float, threshold_percent: float) -> bool:
    """Send price alert email via Resend. Returns True on success."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return False
    try:
        import resend
        resend.api_key = api_key

        change_pct = ((current_price - base_price) / base_price) * 100
        direction = "increased" if change_pct >= 0 else "decreased"
        params = {
            "from": "Fortune <onboarding@resend.dev>",
            "to": [to_email],
            "subject": f"Price alert: {symbol} {direction} {abs(change_pct):.2f}%",
            "html": f"""
            <p>Your price alert for <strong>{symbol}</strong> has been triggered.</p>
            <p>Base price: ${base_price:.2f}</p>
            <p>Current price: ${current_price:.2f}</p>
            <p>Change: {change_pct:+.2f}% (threshold: {threshold_percent:+.2f}%)</p>
            """,
        }
        resend.Emails.send(params)
        print(f"[Price Alert] Email sent successfully to {to_email} for {symbol}")
        return True
    except Exception as e:
        print(f"[Price Alert] Failed to send email: {e}")
        return False


def process_price_alerts() -> int:
    """Check all active price alerts and send emails when thresholds are reached. Returns count of alerts triggered."""
    count = 0
    alerts = PriceAlert.query.filter_by(triggered=False).all()
    for alert in alerts:
        current_price = get_current_price(alert.symbol)
        if current_price <= 0:
            continue
        base = float(alert.base_price)
        threshold = float(alert.threshold_percent)
        change_pct = ((current_price - base) / base) * 100

        triggered = False
        if threshold < 0:
            triggered = change_pct <= threshold
        else:
            triggered = change_pct >= threshold

        if triggered:
            user = db.session.get(User, alert.user_id)
            if user and user.email:
                if send_price_alert_email(user.email, alert.symbol, base, current_price, threshold):
                    alert.triggered = True
                    count += 1
    if count > 0:
        db.session.commit()
    return count
