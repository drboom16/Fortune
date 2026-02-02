# Fortune

Web-based paper trading app with a Flask API and a Vite + React (shadcn/ui) frontend.

## Backend setup (Flask)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
python3 run.py
```

The API runs at `http://localhost:5000/api`.

## Database setup (PostgreSQL via Docker)

```bash
cd ..
docker compose up -d
```

This starts Postgres on `localhost:5432` with credentials from `docker-compose.yml`.
Update `backend/.env` if you want to change the DB name/user/password.

## Frontend setup (Vite + React)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend runs at `http://localhost:3000` and reads `VITE_API_BASE_URL` from `frontend/.env`.

## Notes

- Auth is JWT-based. After login, the token is stored in local storage.
- Gemini queries are available at `POST /api/ai/query` with `{ "prompt": "..." }`. Set `GEMINI_API_KEY` in `backend/.env`.
- Market data uses a mock by default (`MARKET_DATA_MOCK=true`). To enable Finnhub, set `MARKET_DATA_PROVIDER=finnhub`, `MARKET_DATA_BASE_URL=https://finnhub.io/api/v1`, `MARKET_DATA_API_KEY=...`, and `MARKET_DATA_MOCK=false` in `backend/.env`.
- SQLite is the default for local dev. Update `DATABASE_URL` and market data values for real integrations.
