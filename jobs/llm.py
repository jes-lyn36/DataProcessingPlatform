import json
# import logging
import re
import regex

from django.conf import settings
from openai import OpenAI

# logger = logging.getLogger(__name__)

FEW_SHOT_MESSAGES = [
  {
    "role": "system",
    "content": (
      "You are a regex generation assistant.\n\n"
      "Your task is to convert a user's natural language instruction into a regular expression "
      "and an optional replacement string.\n\n"
      "Rules:\n"
      "- Return ONLY valid JSON.\n"
      "- Do not include explanations or markdown.\n"
      "- Generate a regex that matches the text the user wants to find or replace.\n"
      "- Set replacement to the value the user wants to substitute matched text with.\n"
      "- If the user only wants to find matches with no replacement, set replacement to \"\".\n"
      "- If a target column is explicitly mentioned, include it.\n"
      "- If no target column is mentioned, return an empty list.\n"
      "- Never include replacement values inside the regex pattern.\n\n"
      "Return this exact format:\n\n"
      "{\n"
      '  "regex": "<generated_regex>",\n'
      '  "replacement": "<replacement_string>",\n'
      '  "target_columns": ["column1", "column2"]\n'
      "}"
    ),
  },
  {
    "role": "user",
    "content": "Find email addresses in the Email column and replace them with 'REDACTED'.",
  },
  {
    "role": "assistant",
    "content": json.dumps({
      "regex": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b",
      "replacement": "REDACTED",
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
      "replacement": "",
      "target_columns": [],
    }),
  },
]

MAX_REGEX_LENGTH = 300
TIMEOUT_SECONDS = 0.1

# Adversarial inputs used to detect catastrophic backtracking at match time.
_BACKTRACK_PROBE_STRINGS = (
  "a" * 10000,
  "1" * 10000,
  "x" * 10000,
  "a" * 5000 + "!",
)


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

  replacement = payload.get("replacement", "")
  if replacement is None:
    replacement = ""
  if not isinstance(replacement, str):
    raise ValueError("LLM response replacement must be a string")

  return {
    "regex": validate_regex(payload["regex"]),
    "replacement": replacement,
    "target_columns": target_columns,
  }


def validate_regex(pattern: str) -> str:
  if not pattern.strip():
    raise ValueError("Regex cannot be empty")

  if len(pattern) > MAX_REGEX_LENGTH:
    raise ValueError("Regex is too long")

  try:
    re.compile(pattern)
  except re.error as exc:
    raise ValueError(f"Invalid regex syntax: {exc}")

  # Run the pattern against adversarial inputs with a hard timeout. If any
  # match exceeds the budget, the pattern is prone to backtracking.
  try:
    for test_input in _BACKTRACK_PROBE_STRINGS:
      regex.search(pattern, test_input, timeout=TIMEOUT_SECONDS)
  except TimeoutError:
    raise ValueError("Regex may cause catastrophic backtracking")

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

  # logger.info("LLM raw response: %s", content)

  return _parse_llm_response(content)
