import os
from pathlib import Path

import httpx
from dotenv import dotenv_values, load_dotenv
from fastapi import HTTPException


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(dotenv_path=ENV_FILE)


def _get_setting(name: str, default: str | None = None) -> str | None:
    # Prefer process env first.
    value = os.getenv(name)
    if value and str(value).strip():
        return str(value).strip()

    # Fallback to reading .env directly for robustness across terminal sessions.
    if ENV_FILE.exists():
        values = dotenv_values(ENV_FILE)
        raw = values.get(name)
        if raw and str(raw).strip():
            return str(raw).strip()

    return default


def _serialize_aggregation(agg_data: dict) -> str:
    """
    Convert aggregated financial data into a readable summary for LLM.
    Includes totals, category breakdown, percentages, and trends.
    """
    lines = [
        f"Income (Overall): ${agg_data.get('income_total', 0):.2f}",
        f"Expenses (Overall): ${agg_data.get('expense_total', 0):.2f}",
        f"Net Balance: ${agg_data.get('net_balance', 0):.2f}",
        "",
        f"Current Month Spending: ${agg_data.get('current_month_spending', 0):.2f}",
        f"Previous Month Spending: ${agg_data.get('previous_month_spending', 0):.2f}",
        f"Month-over-Month Change: {agg_data.get('month_over_month_change_pct', 0):.1f}%",
        "",
    ]
    
    # Category breakdown
    category_breakdown = agg_data.get("category_breakdown", {})
    if category_breakdown:
        lines.append("Expense Breakdown by Category:")
        for category, data in list(category_breakdown.items())[:5]:
            lines.append(f"  - {category}: ${data.get('total', 0):.2f} ({data.get('percentage', 0):.1f}%)")
        lines.append("")
    
    # Transaction metrics
    lines.extend([
        f"Total Transactions: {agg_data.get('total_transactions', 0)}",
        f"Average Expense: ${agg_data.get('average_expense', 0):.2f}",
        f"Average Income: ${agg_data.get('average_income', 0):.2f}",
    ])
    
    return "\n".join(lines)


def _llm_settings() -> tuple[str, str, str, str]:
    # Refresh env values at request-time so updated .env keys are picked up immediately.
    load_dotenv(dotenv_path=ENV_FILE, override=False)
    api_key = _get_setting("GROQ_API_KEY") or _get_setting("LLM_API_KEY")
    base_url = _get_setting("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    model = _get_setting("LLM_MODEL", "llama-3.1-8b-instant")
    provider = _get_setting("LLM_PROVIDER_NAME", "groq-llama")
    return api_key, base_url, model, provider


def _call_chat_completion(
    api_key: str,
    base_url: str,
    model: str,
    messages: list[dict],
    temperature: float,
) -> str:
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}") from exc

    data = response.json()
    return (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "No AI response was generated.")
        .strip()
    )


def generate_ai_insight(aggregated_data: dict, focus: str | None = None) -> dict:
    api_key, base_url, model, provider = _llm_settings()

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="LLM API key not configured. Set GROQ_API_KEY for Groq LLaMA (or LLM_API_KEY).",
        )

    system_prompt = (
        "You are a strict and intelligent financial advisor. "
        "Analyze the user's financial behavior and provide structured advice. "
        "Be concise and practical, use bullet points, use numbers and percentages, "
        "highlight risks clearly, and give actionable recommendations. "
        "Output format: 1) Key Insights 2) Risks 3) Recommendations 4) Financial Score (0-100)."
    )


    user_prompt = (
        "Here is the user's Financial Data:\n"
        f"{_serialize_aggregation(aggregated_data)}\n\n"
        f"Focus area: {focus if focus else 'overall spending and savings'}\n\n"
        "Return a concise spending insight and next best actions based on the data above."
    )

    insight = _call_chat_completion(
        api_key=api_key,
        base_url=base_url,
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
    )

    return {
        "provider": provider,
        "model": model,
        "insight": insight,
    }