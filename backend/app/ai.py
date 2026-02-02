import json
import logging
import os
from typing import Optional

import requests
from google import genai

logger = logging.getLogger(__name__)

def _grounding_config(use_grounding: bool) -> Optional[genai.types.GenerateContentConfig]:
    if not use_grounding:
        return None
    grounding_tool = genai.types.Tool(google_search=genai.types.GoogleSearch())
    return genai.types.GenerateContentConfig(tools=[grounding_tool])

def query_gemini(prompt: str, model: Optional[str] = None, grounding: bool = False) -> dict:
    model_name = model or os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
    client = genai.Client()
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=_grounding_config(grounding),
    )
    text = getattr(response, "text", "") or ""
    return {
        "text": text,
        "raw": response,
    }


def query_openrouter_json(
    prompt: str,
    system_prompt: str,
    model: str = "openrouter/free",
    max_tokens: int = 1400,
    reasoning_enabled: bool = True,
) -> dict:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("OpenRouter API key missing: OPENROUTER_API_KEY not set")
        raise ValueError("OPENROUTER_API_KEY is required.")
    base_url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    site_url = os.environ.get("OPENROUTER_SITE_URL")
    site_title = os.environ.get("OPENROUTER_SITE_TITLE")
    if site_url:
        headers["HTTP-Referer"] = site_url
    if site_title:
        headers["X-Title"] = site_title
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": max_tokens,
        "reasoning": {"enabled": reasoning_enabled},
    }
    try:
        response = requests.post(base_url, headers=headers, json=payload, timeout=30)
        if not response.ok:
            error_payload = {}
            try:
                error_payload = response.json()
            except ValueError:
                error_payload = {"message": response.text}
            logger.error(
                "OpenRouter request failed",
                extra={
                    "status_code": response.status_code,
                    "model": model,
                    "base_url": base_url,
                    "error": error_payload,
                },
            )
            raise ValueError(f"OpenRouter error {response.status_code}: {error_payload}")
        payload = response.json()
        content = (
            payload.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
        )
        if not content.strip():
            logger.warning(
                "OpenRouter returned empty content",
                extra={"model": model, "base_url": base_url},
            )
            raise ValueError("OpenRouter returned empty content")
        return {"text": content, "raw": payload}
    except Exception as exc:
        logger.exception(
            "OpenRouter request failed",
            extra={"model": model, "base_url": base_url, "error": str(exc)},
        )
        raise

def extract_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        first_brace = cleaned.find("{")
        first_bracket = cleaned.find("[")
        starts = [pos for pos in (first_brace, first_bracket) if pos != -1]
        if not starts:
            raise
        start = min(starts)
        end_brace = cleaned.rfind("}")
        end_bracket = cleaned.rfind("]")
        end = max(end_brace, end_bracket)
        if end == -1 or end <= start:
            raise
        snippet = cleaned[start : end + 1].strip()
        return json.loads(snippet)
