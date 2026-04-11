# SmartSpend AI

SmartSpend AI is a lightweight personal finance web app for quickly recording income and expense transactions in one place.

It combines:
- A clean transaction entry page (HTML + vanilla JavaScript)
- A FastAPI backend for request handling and validation
- SQLite storage through SQLAlchemy ORM

## What The App Does

Current implemented features:
- Add a transaction from the browser (`amount`, `type`, `category`, `date`)
- Validate transaction data on the backend
- Store transactions in a local SQLite database
- Normalize category names (trim + title case)
- Browse saved transactions in a paginated table with category/type filters
- List transactions as paginated JSON through an API endpoint
- Open a dedicated real-time dashboard session with live metric refresh and charts
- Generate AI-powered spending suggestions from transaction history (LLM-backed)

## Tech Stack

- Frontend: HTML5, vanilla JavaScript
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
│     ├─ dashboard.html
│     ├─ add-transaction.html
│     ├─ ai-insights.html
│     ├─ css/
│     │  └─ styles.css
│     └─ js/
│        ├─ dashboard.js
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

- `GET /dashboard`
  Serves the real-time dashboard page.

- `GET /ai-insights`
  Serves the dedicated AI insights page.

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
  Returns paginated transactions (newest first) with optional `page`, `page_size`, `type`, and `category` query parameters.

  Example:
  ```text
  /transactions?page=1&page_size=10&type=expense&category=Food%20%26%20Drink
  ```

- `GET /dashboard-summary`
  Returns dashboard metrics and chart-ready data:
  - `income_total`
  - `expense_total`
  - `total_balance`
  - `monthly_spending`
  - `category_breakdown`
  - `spending_over_time`

- `GET /ai-suggestions`
  Generates AI-based spending insight from current transaction history.

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

4. Configure AI provider (LLaMA on Groq)

  Create a `.env` file in project root:
  ```env
  GROQ_API_KEY=your_groq_api_key
  LLM_MODEL=llama-3.1-8b-instant
  ```

  The app auto-loads `.env` on startup.

  Windows (PowerShell):
  ```powershell
  $env:GROQ_API_KEY="your_groq_api_key"
  $env:LLM_MODEL="llama-3.1-8b-instant"
  ```

  Optional OpenAI-compatible overrides:
  - `LLM_API_KEY` (used only if `GROQ_API_KEY` is not set)
  - `LLM_BASE_URL` (default: `https://api.groq.com/openai/v1`)
  - `LLM_MODEL` (default: `llama-3.1-8b-instant`)
  - `LLM_PROVIDER_NAME` (default: `groq-llama`)

  Example for xAI Grok compatibility:
  ```powershell
  $env:LLM_API_KEY="your_xai_api_key"
  $env:LLM_BASE_URL="https://api.x.ai/v1"
  $env:LLM_MODEL="grok-2-latest"
  $env:LLM_PROVIDER_NAME="xai-grok"
  ```

5. Run the app
  ```powershell
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

6. Open in your browser
   - App UI: http://127.0.0.1:8000
   - API docs (Swagger): http://127.0.0.1:8000/docs

## Smoke Test

Run the end-to-end auth and user-data isolation smoke test:

```powershell
.\scripts\smoke-test.ps1
```

Optional parameters:

```powershell
.\scripts\smoke-test.ps1 -Port 8011 -BindHost 127.0.0.1
```

The script validates:
- account signup
- authenticated transaction creation
- user-scoped transactions and dashboard summary
- legacy transaction claim endpoint
- logout protection (401 expected)
- login and `/auth/me`

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

## Troubleshooting

If the browser page appears blank:

1. Ensure only one server is running on port 8000.
  ```powershell
  Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 8000 }
  ```

2. Stop duplicate uvicorn/python processes and restart once.
  ```powershell
  Get-Process -Name uvicorn -ErrorAction SilentlyContinue | Stop-Process -Force
  Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 8000 } | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
  ```

3. Open the page route directly and hard refresh.
  - `http://127.0.0.1:8000/add-transaction`
  - Press `Ctrl+F5`

## Roadmap (From PRD)

Planned next features include:
- Conversational finance Q&A endpoint (`POST /ai-chat`)
- Dark mode persistence and dedicated theme module
- Expanded budgeting and savings recommendation workflows
