# Fortune

Paper trading app for stocks and portfolios. Flask API + React frontend.

## Local Development

### 1. Database

**Option A – SQLite (simplest):** No setup. Omit `DATABASE_URL` in `backend/.env` and the app uses SQLite.

**Option B – PostgreSQL via Docker:**
```bash
docker compose up -d
```

Then set `DATABASE_URL` in `backend/.env`:
```
DATABASE_URL=postgresql://fortune_user:fortune_password@localhost:5432/fortune
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
python3 run.py
```

API runs at `http://localhost:5000/api`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`. The Vite proxy forwards `/api` to the backend.

## Environment

Create `backend/.env` only if using PostgreSQL; set `DATABASE_URL` as shown in Database above. No `frontend/.env` needed.
