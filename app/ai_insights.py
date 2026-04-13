import os
import re
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
        f"Income (Overall): GH₵{agg_data.get('income_total', 0):.2f}",
        f"Expenses (Overall): GH₵{agg_data.get('expense_total', 0):.2f}",
        f"Net Balance: GH₵{agg_data.get('net_balance', 0):.2f}",
        "",
        f"Current Month Spending: GH₵{agg_data.get('current_month_spending', 0):.2f}",
        f"Previous Month Spending: GH₵{agg_data.get('previous_month_spending', 0):.2f}",
        f"Month-over-Month Change: {agg_data.get('month_over_month_change_pct', 0):.1f}%",
        "",
    ]
    
    # Category breakdown
    category_breakdown = agg_data.get("category_breakdown", {})
    if category_breakdown:
        lines.append("Current Month Expense Breakdown by Category:")
        for category, data in list(category_breakdown.items())[:5]:
            lines.append(f"  - {category}: GH₵{data.get('total', 0):.2f} ({data.get('percentage', 0):.1f}%)")
        lines.append("")
    
    # Transaction metrics
    lines.extend([
        f"Total Transactions: {agg_data.get('total_transactions', 0)}",
        f"Average Expense: GH₵{agg_data.get('average_expense', 0):.2f}",
        f"Average Income: GH₵{agg_data.get('average_income', 0):.2f}",
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


def _normalize_insight_text(insight: str, user_name: str) -> str:
    title = f"Financial Analysis for {user_name}"
    body = str(insight or '').strip()

    if body.startswith(title):
        body = body[len(title):].lstrip("\r\n :\t-")
    else:
        # Remove any model-generated title line so the app controls the displayed title.
        first_line, _, remainder = body.partition("\n")
        if "financial analysis" in first_line.lower() or user_name.lower() in first_line.lower():
            body = remainder.lstrip()

    name_parts = [part for part in re.split(r"\s+", user_name.strip()) if part]
    if user_name.strip():
        body = re.sub(rf"\b{re.escape(user_name.strip())}\b", "you", body, flags=re.IGNORECASE)
    for part in name_parts:
        body = re.sub(rf"\b{re.escape(part)}\b", "you", body, flags=re.IGNORECASE)

    pronoun_map = {
        r"\bhis\b": "your",
        r"\bhim\b": "you",
        r"\bhe\b": "you",
        r"\bhis\b": "your",
        r"\bhers\b": "your",
        r"\bhimself\b": "yourself",
    }
    for pattern, replacement in pronoun_map.items():
        body = re.sub(pattern, replacement, body, flags=re.IGNORECASE)

    return f"{title}\n\n{body}".strip()


def generate_ai_insight(aggregated_data: dict, user_name: str, focus: str | None = None) -> dict:
    api_key, base_url, model, provider = _llm_settings()

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="LLM API key not configured. Set GROQ_API_KEY for Groq LLaMA (or LLM_API_KEY).",
        )

    system_prompt = (
        "You are a strict and intelligent financial advisor. "
        "Analyze the provided financial behavior and provide structured advice. "
        f"The first line must be exactly: 'Financial Analysis for {user_name}'. "
        "After the title line, address the person only as 'you' and 'your'. "
        "Do not use the person's name anywhere in the body. "
        "Keep markdown simple and readable. "
        "Use short bullet points under Key Insights and Risks, and short numbered points under Recommendations. "
        "Make the body easy to scan and explain ideas in simple, direct language. "
        "Output sections in this order: 1) Key Insights 2) Risks 3) Recommendations 4) Financial Score (0-100)."
    )


    user_prompt = (
        f"User name: {user_name}\n"
        "Here is the user's Financial Data:\n"
        f"{_serialize_aggregation(aggregated_data)}\n\n"
        f"Focus area: {focus if focus else 'overall spending and savings'}\n\n"
        "Return a concise markdown insight and next best actions based on the data above. "
        "Use the title line and then refer to the person as you."
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

    insight = _normalize_insight_text(insight, user_name)

    return {
        "provider": provider,
        "model": model,
        "insight": insight,
    }