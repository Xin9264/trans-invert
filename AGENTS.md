# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: FastAPI app (`app/` with `main.py`, `routers/`, `schemas/`, `services/`, `templates/`). Config via `backend/.env`.
- `frontend/`: React + TypeScript app (`src/` with `pages/`, `components/`, `utils/`, `styles/`). Static assets in `public/`.
- Root tooling: `docker-compose.dev.yml` for dev stack, `start.sh` convenience launcher, `README.md` for quick start.

## Build, Test, and Development Commands
- Full stack (Docker): `./start.sh` — builds and runs frontend at `:3000` and backend at `:8000`.
- Frontend dev: `cd frontend && npm install && npm run dev` (Vite dev server).
- Frontend build: `cd frontend && npm run build` (outputs to `frontend/dist/`).
- Backend dev (local): `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`.
- Backend dev (Docker): `docker-compose -f docker-compose.dev.yml up -d --build`.

## Coding Style & Naming Conventions
- Python: PEP8, 4-space indent; modules/functions `snake_case`, classes `PascalCase`. Keep routers small and cohesive.
- TypeScript/React: 2-space indent; variables/functions `camelCase`, components/files `PascalCase` (e.g., `TypingComponent.tsx`).
- Linting: Frontend uses ESLint (`npm run lint`). Keep imports ordered and avoid unused exports.

## Testing Guidelines
- Backend: `pytest` with `pytest-asyncio` is available; place tests under `backend/tests/` (e.g., `test_texts.py`). Run: `cd backend && pytest -q`.
- Frontend: No test runner configured; if adding, prefer Vitest and colocate as `*.test.tsx`.
- Aim for focused unit tests around routers/services and pure utilities; keep async tests deterministic.

## Commit & Pull Request Guidelines
- Commits: Short, imperative summaries (English or Chinese), e.g., `fix essay fetch error` or `修复TypeScript编译错误`. Group related changes.
- PRs: Include purpose, key changes, screenshots for UI, and steps to verify. Link issues and note any breaking changes or config updates.

## Security & Configuration Tips
- Never commit secrets. Set `DEEPSEEK_API_KEY` in `backend/.env` (use `.env.example` as a template).
- CORS/domains: adjust `ALLOWED_ORIGINS` in `docker-compose.dev.yml` for non-local dev.
- Keep API types in sync: update `frontend/src/types/` when backend schemas change.

