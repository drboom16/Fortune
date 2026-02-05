import asyncio
import threading
import yfinance as yf
from datetime import datetime
from typing import Set, Dict, Optional

# Singleton pattern for the app instances' websocket connection

class WebSocketPriceManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.price_cache: Dict[str, float] = {}
        self.last_update: Dict[str, datetime] = {}
        self.subscribed_symbols: Set[str] = set()
        self.ws = None
        self.running = False
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._initialized = True

    def handle_message(self, message: dict): 
        symbol = message.get("id")
        price = message.get("price")

        if symbol and price:
            self.price_cache[symbol] = float(price)
            self.last_update[symbol] = datetime.utcnow()
            print(f"Updated price for {symbol}: ${price:.2f}")

    async def _run_websocket(self):
        """Internal async function to run WebSocket connection"""
        self.ws = yf.AsyncWebSocket()

        if self.subscribed_symbols:
            await self.ws.subscribe(list(self.subscribed_symbols))

        await self.ws.listen(self.handle_message)

    async def start(self, symbols: list[str]):
        """Start WebSocket streaming in background thread"""
        if self.running:
            print("WebSocket is already running")
            return

        self.subscribed_symbols.update(symbols)
        self.running = True

        def run_in_thread():
            # Create and store the event loop for this thread
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

            try:
                self.loop.run_until_complete(self._run_websocket())
            except Exception as e:
                print(f"WebSocket error: {e}")
                self.running = False
            finally:
                self.loop.close()
                self.loop = None

        thread = threading.Thread(target=run_in_thread, daemon=True)
        thread.start()
        print(f"WebSocket started for {len(symbols)} symbols")

    def subscribe(self, symbol: str):
        """Add a symbol to the stream"""
        if symbol not in self.subscribed_symbols:
            self.subscribed_symbols.add(symbol)

            if self.ws and self.running and self.loop and not self.loop.is_closed():
                try:
                    # Use the stored loop from the WebSocket thread
                    asyncio.run_coroutine_threadsafe(
                        self.ws.subscribe([symbol]),
                        self.loop # Use the WebSocket thread's loop
                    )
                    print(f"Subscribed to {symbol} via WebSocket")
                except Exception as e:
                    print(f"Failed to subscribe to {symbol}: {e}")
            else:
                # WebSocket not ready yet - symbol will be subscribed when WebSocket starts
                print(f"Queued {symbol} for WebSocket subscription")
                
    def get_price(self, symbol: str) -> float:
        """Get the price for a symbol from the cache"""
        return self.price_cache.get(symbol, 0.0)

    def get_last_update(self, symbol: str) -> datetime:
        """Get timestamp of last update"""
        return self.last_update.get(symbol)

    async def stop(self):
        """Stop WebSocket streaming"""
        if self.ws:
            await self.ws.close()
            self.ws = None
        self.running = False
        print("WebSocket stopped")

ws_manager = WebSocketPriceManager()