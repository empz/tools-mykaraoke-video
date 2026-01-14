# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyKaraoke Video - Free Tools: A web application providing free tools for karaoke, audio processing, and music.
- **Backend**: FastAPI (Python 3.10+) with SQLModel ORM and PostgreSQL
- **Frontend**: React 19 with TypeScript, Vite, TanStack Query/Router, Tailwind CSS, shadcn/ui
- **Infrastructure**: Docker Compose with Traefik reverse proxy
- **No Authentication**: This is a public tools app with no login/registration

## Common Commands

### Development
```bash
npm install                       # First time setup (installs concurrently)
npm run dev                       # Start everything (backend + frontend with HMR)
npm run stop                      # Stop all services
npm run clean                     # Stop and remove database volume
```

### Full Stack (Production-like)
```bash
docker compose up -d                      # Start all services via Traefik
docker compose --profile frontend up -d   # Include frontend container
docker compose down -v                    # Stop and remove volumes
```

### Backend
```bash
cd backend
uv sync                           # Install dependencies
fastapi dev app/main.py           # Run dev server locally (outside Docker)

# Testing
bash scripts/test.sh                              # Full test suite with Docker
docker compose exec backend bash scripts/tests-start.sh  # Tests on running stack

# Code quality
uv run ruff check --fix           # Lint and fix
uv run ruff format                # Format
uv run mypy app                   # Type check
```

### Frontend
```bash
cd frontend
npm install                       # Install dependencies
npm run dev                       # Dev server at http://localhost:5173
npm run build                     # Production build
npm run lint                      # Biome linter/formatter
npx playwright test               # E2E tests (requires running stack)
```

### Database Migrations
```bash
docker compose exec backend bash
alembic revision --autogenerate -m "description"  # Create migration
alembic upgrade head                               # Apply migrations
```

### API Client Generation
```bash
./scripts/generate-client.sh      # Regenerate frontend client from backend OpenAPI
```

## Architecture

### Backend Structure (`backend/app/`)
- `main.py` - FastAPI app entry point
- `models.py` - SQLModel database models and Pydantic schemas
- `api/routes/` - API endpoints (utils for health check, add tool routes here)
- `api/deps.py` - Dependency injection (database session)
- `core/config.py` - Pydantic settings from `.env`
- `core/db.py` - Database engine configuration
- `alembic/` - Database migrations

### Frontend Structure (`frontend/src/`)
- `routes/` - TanStack Router file-based pages
- `components/` - React components (shadcn/ui based)
- `client/` - Auto-generated OpenAPI TypeScript client
- `hooks/` - Custom React hooks

### Data Flow
1. Frontend uses auto-generated client from `src/client/`
2. TanStack Query manages API state and caching
3. Backend validates with Pydantic, uses SQLModel for DB operations

## Key Patterns

- **API-first**: Backend generates OpenAPI spec, frontend client auto-generated
- **Type safety**: Pydantic (backend) + TypeScript (frontend)
- **Form handling**: React Hook Form + Zod validation
- **State**: TanStack Query for server state, React state for UI
- **No auth**: All endpoints are public

## Development URLs (when running locally)

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Adminer (DB admin): http://localhost:8080
- Traefik Dashboard: http://localhost:8090

## Adding New Tools

To add a new karaoke/audio tool:

1. **Backend**: Create a new route file in `backend/app/api/routes/`
2. **Register route**: Add to `backend/app/api/main.py`
3. **Frontend**: Create page in `frontend/src/routes/_layout/`
4. **Update route tree**: Add route to `frontend/src/routeTree.gen.ts`
5. **Add to sidebar**: Update `frontend/src/components/Sidebar/AppSidebar.tsx`

### Tool Development Guidelines

**File Upload UX**:
- Use `FileDropzone` component (`@/components/ui/file-dropzone`) for all file inputs
- Supports both click-to-select and drag & drop
- Auto-start processing when file is selected (no separate "Analyze" button)
- Show loading state in dropzone during processing (`loading` prop)
- Disable dropzone during processing (`disabled` prop)
- Always keep dropzone visible so users can select another file after completion

**Frontend Patterns**:
- Use `useCallback` for async functions that need to be called from handlers
- Use direct `fetch()` with `OpenAPI.BASE` for API calls (not the generated client)
- Use `useCustomToast` hook for success/error notifications
- Use shadcn/ui `Card` components for layout sections
- Use `LoadingButton` for action buttons with loading states

**Backend Audio Processing**:
- Audio routes go in `backend/app/api/routes/audio.py`
- Use `librosa` for audio analysis and processing
- Use `soundfile` for audio file I/O
- Use temporary files with cleanup in `finally` blocks
- Validate: file extension, file size (100MB max), duration (15 min max)
- Return processed audio as `StreamingResponse` with proper Content-Disposition header

**Example Tool Structure** (see `key-bpm-analyzer.tsx` and `bpm-changer.tsx`):
```typescript
function MyTool() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const { showErrorToast, showSuccessToast } = useCustomToast()

  const processFile = useCallback(async (fileToProcess: File) => {
    setIsProcessing(true)
    try {
      // API call with FormData
    } catch (error) {
      showErrorToast(error.message)
    } finally {
      setIsProcessing(false)
    }
  }, [showErrorToast])

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile)
    setResult(null)
    if (selectedFile) processFile(selectedFile)
  }

  return (
    <Card>
      <FileDropzone
        onFileSelect={handleFileSelect}
        selectedFile={file}
        loading={isProcessing}
        disabled={isProcessing}
      />
    </Card>
  )
}
```

### Docker Compose Notes

- **Development**: Use `npm run dev` from repo root - starts minimal services (db + backend) with native Vite frontend
- **Production-like**: Use `docker compose up` for full stack with Traefik, Adminer, etc.
- `docker-compose.dev.yml` - minimal services for local dev (db, backend only)
- `docker-compose.yml` + `docker-compose.override.yml` - full stack with all services

**Hot Reload Setup**:
- Frontend: Vite dev server with HMR (instant updates)
- Backend: Uses `docker compose watch` to sync file changes into the container, combined with FastAPI's `--reload` flag for automatic server restart
- Edit any Python file in `backend/` and changes apply automatically
- Edit `pyproject.toml` and the container rebuilds automatically
