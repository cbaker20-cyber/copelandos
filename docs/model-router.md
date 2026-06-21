# Model Router

`config/models.json` maps task categories to ordered provider fallbacks. Supported categories are `fast`, `reasoning`, `coding`, `summarization`, `research`, `planning`, `music`, `security_review`, and `local_fallback`.

Supported providers are OpenAI, Anthropic, Groq, Cerebras, Gemini, OpenRouter, and Ollama. Credentials and model overrides come only from environment variables. Provider status responses contain provider/model names and connection state, never keys.

The first configured provider in a category wins. If none is configured, the router returns a clear error and the candidates it checked. It does not silently claim that a model answered.

Ollama requires `OLLAMA_BASE_URL` and is intended for an explicitly configured local/private deployment. A Cloudflare Worker cannot reach a user's ordinary localhost; use local fallback through a reviewed local-agent architecture rather than exposing Ollama publicly.
