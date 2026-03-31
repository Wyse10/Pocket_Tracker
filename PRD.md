# SmartSpend AI PRD

## 1. Product Overview
SmartSpend AI is a personal finance web app that helps users record income and expenses, monitor spending health, and get rule-based suggestions to improve money habits. The MVP prioritizes clarity, quick data entry, and immediate visual feedback through a dashboard.

## 2. Problem Statement
People often track finances in fragmented notes or spreadsheets, which makes it hard to understand spending patterns in real time. Users need a simple system that combines transaction tracking, summaries, and actionable insights in one place.

## 3. Goals
1. Enable fast transaction tracking for income and expenses.
2. Provide a dashboard with accurate balance and monthly spending metrics.
3. Visualize spending patterns by category and time.
4. Deliver simple, deterministic smart insights without complex ML.
5. Keep implementation beginner-friendly while preserving modular architecture.

## 4. Non-Goals (MVP)
1. Authentication and authorization.
2. Multi-user collaboration.
3. Budget planning/goals.
4. Recurring transactions.
5. Forecasting or ML-based prediction.
6. Data import/export.

## 5. Target User
Single-user local operator who wants quick and clear financial visibility without spreadsheet overhead.

## 6. Success Metrics
1. User can add a transaction in under 20 seconds.
2. Dashboard load and render completes reliably with empty and non-empty data.
3. Metric values match manual calculations for controlled test datasets.
4. Smart insights display at least one useful message on every dashboard load.
5. Dark mode preference persists across page refreshes.

## 7. Mandatory Tech Stack
### Frontend
1. HTML5
2. Tailwind CSS via CDN
3. Vanilla JavaScript

### Backend
1. Python + FastAPI

### Database
1. SQLite via SQLAlchemy ORM

### Visualization
1. Plotly.js

## 8. User Stories
1. As a user, I want to add income and expenses so I can keep records up to date.
2. As a user, I want to see total balance and monthly spending so I can understand my current position.
3. As a user, I want charts by category and date so I can identify spending trends.
4. As a user, I want a health score and suggestions so I can improve my spending behavior.
5. As a user, I want dark mode so I can use the app comfortably in different lighting conditions.

## 9. Functional Requirements
### FR-1 Transaction Management
1. System must allow creation of transactions with fields:
1. amount (float)
2. type (income or expense)
3. category (string)
4. date (YYYY-MM-DD input)
2. System must store date as SQL DATE.
3. System must reject invalid type or malformed payload with clear errors.

### FR-2 Dashboard Metrics
1. Total balance = total income - total expenses.
2. Monthly spending = sum of expense transactions in current calendar month.

### FR-3 Dashboard Visualizations
1. Pie chart: labels are categories, values are total expenses per category.
2. Line chart: X-axis dates, Y-axis total spending per day.

### FR-4 Smart Features
1. Financial health score (0-100):
1. Higher when income exceeds expenses.
2. Lower when expenses exceed income.
3. Deterministic behavior for empty/low-data states.
2. Daily spending limit = monthly spending / 30.
3. Smart suggestions (rule-based):
1. Spending warning when monthly spending exceeds 80% of total income.
2. Dominant category warning when one category exceeds 40% of total expenses.
3. Fallback constructive suggestion when no warning rule triggers.

### FR-5 Theme
1. System must support light/dark mode toggle.
2. Theme preference must persist locally.

## 10. API Requirements
### POST /add-transaction
1. Accept JSON body with amount, type, category, date.
2. Persist transaction in SQLite.
3. Return created transaction object as JSON.

### GET /transactions
1. Return all transactions as JSON array.

### GET /dashboard-summary
1. Return JSON containing:
1. total_balance
2. monthly_spending
3. category_breakdown
4. spending_over_time

## 11. Data Model
### Table: transactions
1. id (primary key)
2. amount (float)
3. type (income/expense)
4. category (string)
5. date (SQL DATE)

## 12. Architecture and File Structure
### Backend modules
1. main.py: FastAPI entry point, routing, startup hooks.
2. database.py: DB engine/session setup and dependency injection.
3. models.py: SQLAlchemy models.
4. schemas.py: Pydantic request/response schemas.
5. crud.py: DB operations and summary aggregations.

### Frontend files
1. dashboard.html: metrics, charts, insights UI.
2. add-transaction.html: transaction form.
3. dashboard.js: fetch summary/transactions, render metrics and charts.
4. add-transaction.js: form submission and feedback handling.
5. theme.js: dark mode toggle persistence.
6. styles.css: custom styles layered with Tailwind.

## 13. UX and Design Requirements
1. Clean card-based layout.
2. Responsive grid across mobile and desktop.
3. Modern dashboard appearance.
4. Clear empty states for first-time users.

## 14. Non-Functional Requirements
1. Code readability and modularity.
2. Stable behavior for empty and normal datasets.
3. Minimal setup friction for local run.
4. Consistent JSON response keys for frontend integration.

## 15. Acceptance Criteria
1. User can add both income and expense transactions from UI.
2. Transactions persist and are returned by API.
3. Dashboard metrics match manual calculations.
4. Pie and line charts render correctly for empty and non-empty states.
5. Health score, daily limit, and suggestions update with new data.
6. Dark mode persists after reload.
7. App runs end-to-end with documented setup commands.

## 16. Risks and Mitigations
1. Risk: inconsistent category casing splits chart slices.
1. Mitigation: normalize category formatting on write.
2. Risk: unclear score behavior with low data.
1. Mitigation: define deterministic floor/ceiling handling.
3. Risk: frontend/backed contract drift.
1. Mitigation: keep stable response schema and validate with sample payloads.

## 17. Implementation Decisions (Locked)
1. Frontend served via FastAPI same-origin routes.
2. Spending alert threshold is dynamic at 80% of income.
3. Dominant category threshold is 40% of expenses.
4. Date persistence type is SQL DATE.
5. Runtime mode is local single-user MVP.

## 18. Validation Plan
1. API-level validation for all endpoints and empty states.
2. UI validation for add transaction flow and dashboard updates.
3. Smart-rule validation with seeded test datasets.
4. Responsive and dark-mode persistence validation.

## 19. Deliverables
1. Backend source files: main.py, database.py, models.py, schemas.py, crud.py.
2. Frontend files: dashboard.html, add-transaction.html, dashboard.js, add-transaction.js, theme.js, styles.css.
3. Project docs: requirements.txt and README.md with setup and run instructions.
