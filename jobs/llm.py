import json
import re

from django.conf import settings
from openai import OpenAI

FEW_SHOT_MESSAGES = [
  {
    "role": "system",
    "content": (
      "You are a regex generation assistant.\n\n"
      "Your task is to convert a user's natural language instruction into a regular expression.\n\n"
      "Rules:\n"
      "- Return ONLY valid JSON.\n"
      "- Do not include explanations or markdown.\n"
      "- Generate a regex that satisfies the user's request.\n"
      "- If a target column is explicitly mentioned, include it.\n"
      "- If no target column is mentioned, return an empty list.\n"
      "- Never include replacement values in the regex.\n\n"
      "Return this exact format:\n\n"
      "{\n"
      '  "regex": "<generated_regex>",\n'
      '  "target_columns": ["column1", "column2"]\n'
      "}"
    ),
  },
  {
    "role": "user",
    "content": "Find email addresses in the Email column.",
  },
  {
    "role": "assistant",
    "content": json.dumps({
      "regex": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b",
      "target_columns": ["Email"],
    }),
  },
  {
    "role": "user",
    "content": "Find Australian phone numbers.",
  },
  {
    "role": "assistant",
    "content": json.dumps({
      "regex": r"(?:\+61|0)[2-478](?:[ -]?\d){8}",
      "target_columns": [],
    }),
  },
]

MAX_REGEX_LENGTH = 500


def _get_client() -> OpenAI:
  return OpenAI(api_key=settings.OPENAI_API_KEY)


def _parse_llm_response(content: str) -> dict:
  text = content.strip()

  if text.startswith("```"):
    text = text.split("\n", 1)[-1]
    if text.endswith("```"):
      text = text.rsplit("```", 1)[0]

  payload = json.loads(text.strip())

  if not isinstance(payload, dict) or "regex" not in payload:
    raise ValueError("LLM response missing regex field")

  target_columns = payload.get("target_columns", [])
  if not isinstance(target_columns, list):
    raise ValueError("LLM response target_columns must be a list")

  return {
    "regex": validate_regex(payload["regex"]),
    "target_columns": target_columns,
  }


def validate_regex(pattern: str) -> str:
  if not pattern or not isinstance(pattern, str):
    raise ValueError("Regex pattern must be a non-empty string")

  if len(pattern) > MAX_REGEX_LENGTH:
    raise ValueError("Regex pattern is too long")

  # re.compile(pattern) turns a regex string into a compiled regex object 
  # and raises an error if the string isn’t valid regex syntax.
  re.compile(pattern)
  return pattern


def generate_regex(prompt: str) -> dict:
  if not settings.OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY is not configured")

  messages = FEW_SHOT_MESSAGES + [{"role": "user", "content": prompt}]
  client = _get_client()

  chat_completion = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=messages,
    n=1,
    temperature=0,
  )

  content = chat_completion.choices[0].message.content
  if not content:
    raise ValueError("LLM returned an empty response")

  return _parse_llm_response(content)
