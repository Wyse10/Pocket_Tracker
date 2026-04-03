import os
from datetime import date

import httpx
from fastapi import HTTPException


def _serialize_transactions(transactions: list[dict]) -> str:
    if not transactions:
        return "No transactions available yet."

    lines = []
    for tx in transactions[-50:]:
        tx_date = tx.get("date")
        if isinstance(tx_date, date):
            tx_date = tx_date.isoformat()
        lines.append(
            f"- {tx_date} | {tx.get('type')} | {tx.get('category')} | {tx.get('amount')}"
        )
    return "\n".join(lines)


def _llm_settings() -> tuple[str, str, str, str]:
    api_key = os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY")
    base_url = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    model = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")
    provider = os.getenv("LLM_PROVIDER_NAME", "groq-llama")
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


def generate_ai_insight(transactions: list[dict], focus: str | None = None) -> dict:
    api_key, base_url, model, provider = _llm_settings()

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="LLM API key not configured. Set LLM_API_KEY (or GROQ_API_KEY).",
        )

    system_prompt = (
        "You are a personal finance assistant. Analyze the user's transactions and return "
        "a short, practical insight with 2-3 concrete actions. Keep response under 120 words."
    )
    user_prompt = (
        "Here are recent transactions:\n"
        f"{_serialize_transactions(transactions)}\n\n"
        f"Focus area: {focus if focus else 'overall spending and savings'}\n\n"
        "Return a concise spending insight and next best actions."
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


def generate_ai_chat_reply(question: str, transactions: list[dict]) -> dict:
    api_key, base_url, model, provider = _llm_settings()

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="LLM API key not configured. Set LLM_API_KEY (or GROQ_API_KEY).",
        )

    system_prompt = (
        "You are a personal finance chatbot. Answer with concise, practical guidance "
        "based only on the provided transactions. If data is insufficient, say so clearly. "
        "Keep response under 140 words."
    )
    user_prompt = (
        "User question:\n"
        f"{question}\n\n"
        "Recent transactions:\n"
        f"{_serialize_transactions(transactions)}\n\n"
        "Provide a direct answer and a short rationale."
    )

    answer = _call_chat_completion(
        api_key=api_key,
        base_url=base_url,
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )

    return {
        "provider": provider,
        "model": model,
        "answer": answer,
    }