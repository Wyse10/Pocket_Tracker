# SmartSpend AI

SmartSpend AI is a lightweight personal finance web app for quickly recording income and expense transactions in one place.

It combines:
- A clean transaction entry page (HTML + Tailwind CSS + vanilla JavaScript)
- A FastAPI backend for request handling and validation
- SQLite storage through SQLAlchemy ORM

## What The App Does

Current implemented features:
- Add a transaction from the browser (`amount`, `type`, `category`, `date`)
- Validate transaction data on the backend
- Store transactions in a local SQLite database
- Normalize category names (trim + title case)
- List all saved transactions as JSON through an API endpoint

## Tech Stack

- Frontend: HTML5, Tailwind CSS (CDN), vanilla JavaScript
- Backend: Python, FastAPI
- Database: SQLite + SQLAlchemy
- Data validation: Pydantic

## Project Structure

```text
.
├─ app/
│  ├─ main.py                # FastAPI app + routes
│  ├─ database.py            # DB engine, session, dependency
│  ├─ models.py              # SQLAlchemy models
│  ├─ schemas.py             # Pydantic schemas
│  ├─ crud.py                # Create/list transaction logic
│  └─ static/
│     ├─ add-transaction.html
│     ├─ css/
│     │  └─ styles.css
│     └─ js/
│        └─ add-transaction.js
├─ requirements.txt
├─ PRD.md
└─ README.md
```

## API Endpoints

- `GET /`  
  Serves the add transaction page.

- `GET /add-transaction`  
  Serves the add transaction page directly.

- `POST /add-transaction`  
  Creates a new transaction.

  Example request body:
  ```json
  {
    "amount": 120.5,
    "type": "expense",
    "category": "Food",
    "date": "2026-03-31"
  }
  ```

- `GET /transactions`  
  Returns all transactions (newest first).

## Local Setup

1. Clone the repository
   ```bash
   git clone https://github.com/Wyse10/Pocket_Tracker.git
   cd Pocket_Tracker
   ```

2. Create and activate a virtual environment

   Windows (PowerShell):
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. Install dependencies
   ```bash
   pip install -r requirements.txt
   ```

4. Run the app
   ```bash
   uvicorn app.main:app --reload
   ```

5. Open in your browser
   - App UI: http://127.0.0.1:8000
   - API docs (Swagger): http://127.0.0.1:8000/docs

## Data Model

`transactions` table fields:
- `id` (integer, primary key)
- `amount` (float, must be > 0)
- `type` (`income` or `expense`)
- `category` (string)
- `date` (SQL DATE)

## Notes

- SQLite database file is created locally as `smartspend.db` when the app starts.
- This is a single-user local MVP focused on quick transaction tracking.

## Roadmap (From PRD)

Planned next features include:
- Dashboard summary metrics
- Category and spending-over-time charts
- Rule-based smart insights
- Theme preference handling
