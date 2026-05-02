# Repository Guidelines

## Project Structure & Module Organization

- `backend/app/main.py` starts the API and registers routers.
- `backend/app/routers/` contains API routes for texts, folders, review, config, and backup.
- `backend/app/services/` holds AI, persistence, template, and backup logic.
- `backend/app/schemas/` defines Pydantic request and response models.
- `backend/app/templates/` stores Jinja2 prompt templates.
- `backend/data/` contains seed JSON data; keep personal runtime data out of git.
- `frontend/src/` contains pages, components, hooks, state, API utilities, styles, and types.
- Local-only project (no Docker / cloud deployment).

## Build, Test, and Development Commands

- `./start.sh` / `./stop.sh`: launch and stop both backend (uvicorn) and frontend (vite) in the background; logs in `.logs/`.
- `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`: create the backend environment.
- `cd backend && uvicorn app.main:app --reload`: run the API at `http://localhost:8000`.
- `cd frontend && npm run dev`: run Vite at `http://localhost:3000`.
- `cd frontend && npm run build`: type-check and build assets.
- `cd frontend && npm run lint`: run ESLint with zero warnings allowed.

## Coding Style & Naming Conventions

Use 4-space indentation for Python and standard TypeScript/React formatting for the frontend. Keep FastAPI routes thin; put reusable logic in `backend/app/services/`. Name React components in `PascalCase`, hooks as `useSomething`, and shared TypeScript types in `frontend/src/types/`. Prefer typed API boundaries with Pydantic models and TypeScript interfaces.

## Testing Guidelines

No committed test suite is currently present. Add backend tests under `backend/tests/` using `pytest`, with names like `test_texts.py` and `test_backup.py`; run them with `cd backend && python -m pytest`. For frontend changes, rely on `npm run lint` and `npm run build` until a test runner is added. Cover API behavior, import/export flows, and AI-provider fallbacks.

## Commit & Pull Request Guidelines

Recent history uses short, direct messages such as `fix api management` and `improve UI`, plus Chinese equivalents. Keep commits focused and imperative. Pull requests should include a summary, test/build results, linked issue when available, screenshots for UI changes, and notes for API or data-format changes.

## Security & Configuration Tips

Do not commit `.env`, API keys, browser-local credentials, or personal runtime data. Configure AI keys through the frontend API configuration UI or the backend config endpoints. Treat `backend/local_data/` and generated snapshots as local-only unless intentionally anonymized.
