# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run setup` - Install dependencies for both frontend and backend
- `npm run dev` - Start both frontend and backend in development mode (equivalent to running both dev:frontend and dev:backend)
- `npm run dev:frontend` - Start frontend only (cd frontend && npm run dev)
- `npm run dev:backend` - Start backend only (cd backend && npm run dev)
- `./start.sh` - Full Docker setup with environment checking

### Building and Production
- `npm run build` - Build the frontend application (cd frontend && npm run build)
- `npm start` - Start backend in production mode (cd backend && npm start)

### Frontend specific (in frontend/ directory)
- `npm run dev` - Start Vite development server
- `npm run build` - Build with TypeScript compilation followed by Vite build
- `npm run lint` - Run ESLint with TypeScript support
- `npm run preview` - Preview production build

### Backend specific (in backend/ directory)
- `python -m app.main` or `uvicorn app.main:app --reload` - Start FastAPI development server
- Backend uses pyproject.toml for dependency management

### Docker
- `docker-compose -f docker-compose.dev.yml up --build` - Build and start services
- `docker-compose -f docker-compose.dev.yml down` - Stop services
- `docker-compose -f docker-compose.dev.yml logs -f` - View logs

## Architecture

### Project Structure
This is a full-stack AI-powered language learning platform with:
- **Frontend**: React + TypeScript + Tailwind CSS (Vite-based)
- **Backend**: Python FastAPI with DeepSeek AI integration
- **Deployment**: Docker Compose for development

### Core Components

#### Backend Architecture (FastAPI)
- **Main Application**: `backend/app/main.py` - FastAPI app with CORS, routing, and exception handling
- **Routers**: `backend/app/routers/texts.py` - Main API endpoints for text processing, practice, and history
- **Services**: 
  - `backend/app/services/deepseek_service.py` - AI service for text analysis and answer evaluation
  - `backend/app/services/template_service.py` - Jinja2 templates for AI prompts
- **Schemas**: `backend/app/schemas/text.py` - Pydantic models for API request/response
- **Settings**: `backend/app/core/settings.py` - Configuration management

#### Frontend Architecture (React)
- **State Management**: Zustand store in `frontend/src/store/index.ts`
- **Pages**: 
  - `Home.tsx` - Landing page
  - `Upload.tsx` - Text upload interface
  - `Practice.tsx` - Main practice interface
  - `History.tsx` - Practice history
- **Components**:
  - `Layout.tsx` - Main layout wrapper
  - `TextHighlighter.tsx` - Text highlighting functionality
  - `TypingComponent.tsx` - Practice typing interface
- **API Layer**: `frontend/src/utils/api.ts` - HTTP client utilities

### Data Flow
1. **Text Upload**: User uploads English text → Backend analyzes with DeepSeek AI → Stores analysis
2. **Practice Session**: User practices translation → Streams real-time AI evaluation → Saves to history
3. **Memory Storage**: Uses in-memory dictionaries for development (texts_storage, analyses_storage, practice_history)

### Key Features
- **AI Text Analysis**: Grammar analysis, difficulty assessment, Chinese translation
- **Real-time Practice**: Stream-based AI evaluation with progress indicators
- **History Management**: Export/import practice history and materials
- **Text Highlighting**: Interactive text highlighting for practice

### Environment Configuration
- **Backend**: Requires `.env` file with `DEEPSEEK_API_KEY`
- **Frontend**: Uses `VITE_API_URL` environment variable
- **Development**: Backend runs on port 8000, frontend on port 3000

### Important Notes
- Backend uses in-memory storage for development (consider database for production)
- DeepSeek API integration requires valid API key
- Frontend uses React Router for navigation without authentication system
- Docker setup handles both development and service orchestration