# Ultimate CopelandOS AI assistant team

This stack is designed to maximize free/open-source/local usage while keeping dangerous actions approval-gated.

## Core local stack

1. Ollama: easiest local model runtime on Windows.
2. Open WebUI: local browser dashboard for chatting with local/routed models.
3. LiteLLM: OpenAI-compatible proxy that can route between Ollama, free cloud keys, and paid keys if added later.
4. Qdrant or ChromaDB: private vector memory over notes, code, and project files.

## Agent team

- Hermes: CopelandOS router and Chief of Staff.
- Scout: research planner and source collector.
- Engineer: code/test/PR planner.
- Secretary: email/calendar/drive/slack draft manager.
- Mimo: tutor/lesson/quiz surface.
- Ornith 1.0: experimental frontier harness/eval builder, sandbox-required.
- OpenHands: sandboxed coding agent.
- Aider: local git-aware pair programmer.
- browser-use: sandboxed browser automation.
- LangGraph: durable workflow graphs.
- AutoGen/CrewAI: multi-agent team experiments.

## First local models

Pull these first because they fit normal student hardware better than giant 70B models:

```powershell
ollama pull qwen2.5-coder:14b
ollama pull qwen3:8b
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

Use `qwen2.5-coder:14b` for coding, `qwen3:8b` for planning/reasoning, `llama3.2:3b` for fast cheap routing, and `nomic-embed-text` for memory.

## Run it

From the repo root on Windows:

```powershell
.\local-agent\start-ai-team.ps1
```

Then open:

```text
http://127.0.0.1:3000
```

## Cloudflare secrets after local stack works

Only add local URLs through Tailscale or another private network. Do not expose Ollama, LiteLLM, Qdrant, or Open WebUI to the public internet.

```text
OLLAMA_BASE_URL=http://YOUR_TAILSCALE_PC_IP:11434
OPEN_WEBUI_URL=http://YOUR_TAILSCALE_PC_IP:3000
LITELLM_BASE_URL=http://YOUR_TAILSCALE_PC_IP:4000
QDRANT_URL=http://YOUR_TAILSCALE_PC_IP:6333
```

## Hard rules

- Local models can plan, summarize, draft, classify, and suggest.
- Local agents can run sandboxed tests.
- No tool fires webhooks, sends email, posts Slack, edits Calendar/Drive, deletes files, deploys, merges, or controls the real desktop without explicit approval.
- Browser automation uses a separate browser profile/container, not your normal Google account session.
- Secrets stay in Cloudflare or local `.env`, never GitHub.
