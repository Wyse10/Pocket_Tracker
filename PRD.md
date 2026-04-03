# SmartSpend AI PRD

## 1. Product Overview
SmartSpend AI is a personal finance web app that helps users record income and expenses, monitor spending health, and get AI-generated suggestions to improve money habits. The MVP prioritizes clarity, quick data entry, and immediate visual feedback through a dashboard.

## 2. Problem Statement
People often track finances in fragmented notes or spreadsheets, which makes it hard to understand spending patterns in real time. Users need a simple system that combines transaction tracking, summaries, and actionable insights in one place.

## 3. Goals
1. Enable fast transaction tracking for income and expenses.
2. Provide a dashboard with accurate balance and monthly spending metrics.
3. Visualize spending patterns by category and time.
4. Deliver practical AI-powered smart insights from transaction history.
5. Keep implementation beginner-friendly while preserving modular architecture.

## 4. Non-Goals (MVP)
1. Authentication and authorization.
2. Multi-user collaboration.
3. Budget planning/goals.
4. Recurring transactions.
5. Forecasting or automated future prediction.
6. Data import/export.

## 5. Target User
Single-user local operator who wants quick and clear financial visibility without spreadsheet overhead.

## 6. Success Metrics
1. User can add a transaction in under 20 seconds.
2. Dashboard load and render completes reliably with empty and non-empty data.
3. Metric values match manual calculations for controlled test datasets.
4. AI suggestions endpoint returns at least one useful message for every non-error request.
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
6. As a user, I want to ask finance questions in natural language so I can get quick answers from my data.
7. As a user, I want personalized budget and savings advice so I can make better decisions.

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
2. Smart suggestions (LLM-powered):
1. Suggestions are generated from recent transaction history.
2. Backend calls an OpenAI-compatible chat completion API.
3. Default provider path uses LLaMA via Groq and allows provider/model override via environment variables.
4. Response must remain concise and action-oriented for end users.

### FR-5 Theme
1. System must support light/dark mode toggle.
2. Theme preference must persist locally.

### FR-6 LLM Assistant Capabilities
1. Smart financial insights:
1. Backend aggregates transaction data into meaningful summaries (totals, percentages, trends).
2. LLM analyzes pre-computed aggregations (not raw transaction rows).
3. LLM returns concrete, measurable suggestions based on aggregated data.
4. Example output style: "You spend 45% on food. Consider reducing this by 15% next month."
5. Example output style: "Your expenses increased 20% this month compared to last month."
2. Conversational chatbot:
1. User can ask natural-language questions about spending patterns.
2. Example questions: "How much did I spend on transport last week?" and "Am I saving enough?"
3. Responses should be grounded in available transaction history and clearly indicate when data is insufficient.
3. Personalized advice:
1. LLM provides budget recommendations based on current income/expense behavior.
2. LLM provides savings strategies based on observed trends.
3. LLM provides spending behavior analysis with concise next steps.

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

### GET /ai-suggestions
1. Builds context from aggregated data (not raw transactions).
2. Aggregates meaningful metrics using SQLAlchemy queries:
1. Total income, total expense, net balance
2. Expense breakdown by category with percentages
3. Monthly spending trend (current vs prior month if available)
4. Top 3 spending categories
5. Average transaction size and frequency metrics
3. Calls configured LLM provider with aggregated payload.
4. Returns JSON containing:
1. provider
2. model
3. insight
5. Returns clear error when API key/provider configuration is missing.

### POST /ai-chat (Planned)
1. Accepts natural-language user finance question.
2. Builds context from transaction history and user question.
3. Returns conversational answer grounded in available data.
4. Returns clear message when data is insufficient for precise answer.

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
5. crud.py: DB operations and aggregations using optimized SQLAlchemy queries.
6. ai_insights.py: LLM request builder that receives pre-aggregated data and generates suggestions.

### Aggregation Optimization
1. Use SQLAlchemy func.sum(), func.count(), and group_by() for all aggregations.
2. Compute category totals and percentages in single query (avoid N+1 queries).
3. Cache monthly trend calculations using SQL window functions or explicit multi-month query.
4. Minimize data passed to LLM: send aggregated numbers only, not raw transaction rows.

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
5. AI aggregation queries must execute in single or minimal round trips (no N+1 queries).
6. LLM receives only aggregated summary data, never raw transaction lists.

## 15. Acceptance Criteria
1. User can add both income and expense transactions from UI.
2. Transactions persist and are returned by API.
3. Dashboard metrics match manual calculations.
4. Pie and line charts render correctly for empty and non-empty states.
5. Health score and suggestions update with new data.
6. Dashboard summary API returns numeric values (income_total, expense_total, balance).
7. AI suggestions endpoint returns aggregated metrics (category breakdown, percentages, trends) and concise insight.
8. AI endpoint payload contains no raw transaction rows, only aggregated summary data.
9. All aggregation queries use SQLAlchemy and execute efficiently (single query per aggregation type).
9. Dark mode persists after reload.
10. App runs end-to-end with documented setup commands.
11. LLM responses include at least one concrete action when giving advice.
12. Chatbot answers include direct response plus short rationale from transaction context.

## 16. Risks and Mitigations
1. Risk: inconsistent category casing splits chart slices.
1. Mitigation: normalize category formatting on write.
2. Risk: unclear score behavior with low data.
1. Mitigation: define deterministic floor/ceiling handling.
3. Risk: frontend/backend contract drift.
1. Mitigation: keep stable response schema and validate with sample payloads.

## 17. Implementation Decisions (Locked)
1. Frontend served via FastAPI same-origin routes.
2. AI suggestions use an OpenAI-compatible API contract.
3. Default provider path is Groq with a LLaMA model.
4. Provider/model are configurable via environment variables.
5. Date persistence type is SQL DATE.
6. Runtime mode is local single-user MVP.

## 18. Validation Plan
1. API-level validation for all endpoints and empty states.
2. UI validation for add transaction flow and dashboard updates.
3. AI suggestion validation with seeded datasets and provider fallback/error checks.
4. Responsive and dark-mode persistence validation.

## 19. Deliverables
1. Backend source files: main.py, database.py, models.py, schemas.py, crud.py, ai_insights.py.
2. Frontend files: dashboard.html, add-transaction.html, dashboard.js, add-transaction.js, theme.js, styles.css.
3. Project docs: requirements.txt and README.md with setup and run instructions.
