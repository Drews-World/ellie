# ElLIE Business

> The "Ultron" crew. AI agents running side businesses (Etsy, Printify, Supliful, etc.). Managed by **ELLIE Hub**.

## Status

**Stub.** Returns fake data on every contract endpoint so ELLIE Hub has something to talk to while real agents are still being built.

## Conforms to

`../ellie/SUBSYSTEM_CONTRACT.md` — every endpoint required by ELLIE Hub is implemented (with mocked responses).

## Run locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Then in ELLIE Hub's `.env`:
```
ELLIEBUSINESS_URL=http://localhost:8001
ELLIEBUSINESS_AUTH_TOKEN=dev-token
```

## Run via Docker

```bash
docker compose up
```

## Architecture (target — not built yet)

```
elliebusiness/
├── main.py                  # FastAPI app — contract endpoints
├── agents/
│   ├── ultron/              # Head agent — schedules, supervises
│   ├── forge/               # Etsy designs → Printify/Printful templates
│   ├── nova/                # Research — scrapes top Etsy stores
│   ├── vibes/               # AI DJ — Suno integration
│   ├── comms/               # Inbox aggregation (TBD)
│   └── treasury/            # Cost tracker
├── shared/
│   ├── llm.py               # OpenRouter client
│   ├── storage.py           # Postgres/SQLite
│   ├── memory.py            # Writes back to ELLIE core
│   └── integrations/        # Etsy, Printify, Printful, Supliful clients
├── tests/
└── requirements.txt
```

Only `main.py` and the contract response shapes exist today. Everything else is placeholder.

## Endpoints (all stubbed)

See `../ellie/SUBSYSTEM_CONTRACT.md` for the full spec. Implemented here:

- `GET /health`
- `GET /status`
- `GET /summary?period=daily|weekly`
- `GET /activity?limit=20`
- `GET /alerts`
- `POST /pause` / `POST /resume`
- `GET /capabilities`

## Next steps (when ready to build real agents)

1. Replace stubbed data with real state (probably Postgres + a simple "agent registry" table).
2. Build the first real agent: **Nova** (research). It's the lowest-risk, highest-leverage starter — read-only access to Etsy/Reddit, produces reports for you to validate manually.
3. Then **Forge** (Etsy designs). Needs OpenAI key (GPT Image 2) and Printify/Printful accounts.
4. Ultron (supervisor) comes last — it only matters once you have agents to supervise.
