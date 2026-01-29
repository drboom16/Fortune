# Fortune

Web-based paper trading app with a Flask API and Next.js frontend.

Web-based paper trading app with a Flask API and Next.js frontend.

## Backend setup (Flask)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

The API runs at `http://localhost:5000/api`.

## Frontend setup (Next.js)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

The app runs at `http://localhost:3000`.

## Notes

- Auth is JWT-based. After login, the token is stored in local storage.
- Market data uses a mock by default (`MARKET_DATA_MOCK=true`).
- SQLite is the default for local dev. Update `DATABASE_URL` and market data values for real integrations.
