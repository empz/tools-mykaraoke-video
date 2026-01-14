# Backend API Documentation

Complete reference for the MyKaraoke Video Tools backend API. This document provides all the context needed to implement frontend clients that interact with these endpoints.

## Base Configuration

| Setting | Value |
|---------|-------|
| Base URL | `/api/v1` |
| API Docs | `http://localhost:8000/docs` (Swagger UI) |
| OpenAPI Spec | `http://localhost:8000/api/v1/openapi.json` |
| CORS | Enabled for configured origins |

## Common Constraints

All audio processing endpoints share these constraints:

| Constraint | Value |
|------------|-------|
| Max file size | 100 MB |
| Max duration | 15 minutes |
| Allowed formats | `.mp3`, `.wav`, `.flac` |

## Error Response Format

All endpoints return errors in this format:

```json
{
  "detail": "Human-readable error message"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid input, unsupported format, audio too long)
- `413` - Payload Too Large (file exceeds 100MB)
- `500` - Internal Server Error (processing failure)

---

## Endpoints

### 1. Health Check

Check if the backend service is running.

**Endpoint:** `GET /api/v1/utils/health-check/`

**Request:** None

**Response:**
```json
true
```

**Response Type:** `boolean`

**Example Usage (Frontend):**
```typescript
const response = await fetch(`${API_BASE}/api/v1/utils/health-check/`)
const isHealthy: boolean = await response.json()
```

---

### 2. Analyze Audio (Key & BPM Detection)

Analyze an audio file to detect its musical key and tempo (BPM).

**Endpoint:** `POST /api/v1/audio/analyze`

**Content-Type:** `multipart/form-data`

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Audio file (MP3, WAV, or FLAC) |

**Response Schema:** `AudioAnalysisResult`

```json
{
  "key": "string",      // Musical key, e.g., "C major", "F# minor"
  "bpm": 120.5,         // Tempo in beats per minute (float, 1 decimal)
  "duration": 180.3     // Duration in seconds (float, 1 decimal)
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Detected musical key. Format: `"{note} {mode}"` where note is one of `C, C#, D, D#, E, F, F#, G, G#, A, A#, B` and mode is `major` or `minor` |
| `bpm` | float | Detected tempo in beats per minute, rounded to 1 decimal place |
| `duration` | float | Audio duration in seconds, rounded to 1 decimal place |

**Possible Key Values:**
- Major keys: `C major`, `C# major`, `D major`, `D# major`, `E major`, `F major`, `F# major`, `G major`, `G# major`, `A major`, `A# major`, `B major`
- Minor keys: `C minor`, `C# minor`, `D minor`, `D# minor`, `E minor`, `F minor`, `F# minor`, `G minor`, `G# minor`, `A minor`, `A# minor`, `B minor`

**Example Usage (Frontend):**
```typescript
interface AudioAnalysisResult {
  key: string
  bpm: number
  duration: number
}

async function analyzeAudio(file: File): Promise<AudioAnalysisResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/api/v1/audio/analyze`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail)
  }

  return response.json()
}
```

**Error Scenarios:**
- `400` - Missing filename, invalid file extension, audio exceeds 15 minutes
- `413` - File exceeds 100MB
- `500` - Audio processing/decoding failure

---

### 3. Change BPM (Time Stretch)

Change the tempo of an audio file while preserving pitch.

**Endpoint:** `POST /api/v1/audio/change-bpm`

**Content-Type:** `multipart/form-data`

**Request Parameters:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `file` | File | Yes | Max 100MB, ≤15min | Audio file (MP3, WAV, or FLAC) |
| `bpm_factor` | float | Yes | `0.5` to `1.5` | Speed multiplier (1.0 = original speed) |

**BPM Factor Examples:**

| Factor | Effect | Use Case |
|--------|--------|----------|
| `0.5` | 50% speed (half tempo) | Slow down for practice |
| `0.75` | 75% speed | Moderate slowdown |
| `1.0` | Original speed | No change |
| `1.25` | 125% speed | Speed up slightly |
| `1.5` | 150% speed (1.5x tempo) | Maximum speedup |

**Response:** Binary audio file (streaming download)

**Response Headers:**
```
Content-Type: audio/wav | audio/flac | audio/mpeg
Content-Disposition: attachment; filename="{original_stem}_{factor_percent}pct.{ext}"
```

**Output Filename Pattern:** `{original_name}_{factor×100}pct.{ext}`
- Example: `song.mp3` with factor `0.75` → `song_75pct.mp3`
- Example: `track.wav` with factor `1.25` → `track_125pct.wav`

**Example Usage (Frontend):**
```typescript
async function changeBpm(file: File, bpmFactor: number): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('bpm_factor', bpmFactor.toString())

  const response = await fetch(`${API_BASE}/api/v1/audio/change-bpm`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail)
  }

  return response.blob()
}

// Download the processed file
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

**Error Scenarios:**
- `400` - Missing filename, invalid file extension, audio exceeds 15 minutes
- `413` - File exceeds 100MB
- `422` - `bpm_factor` outside valid range (0.5-1.5)
- `500` - Audio processing failure

---

### 4. Pitch Shift

Shift the pitch of an audio file by a specified number of semitones while preserving tempo.

**Endpoint:** `POST /api/v1/audio/pitch-shift`

**Content-Type:** `multipart/form-data`

**Request Parameters:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `file` | File | Yes | Max 100MB, ≤15min | Audio file (MP3, WAV, or FLAC) |
| `semitones` | integer | Yes | `-12` to `12`, non-zero | Number of semitones to shift |

**Semitone Reference:**

| Semitones | Musical Interval | Effect |
|-----------|------------------|--------|
| `-12` | Down 1 octave | Much lower |
| `-7` | Down perfect 5th | Lower |
| `-5` | Down perfect 4th | Somewhat lower |
| `-2` | Down whole step | Slightly lower |
| `-1` | Down half step | Minimally lower |
| `+1` | Up half step | Minimally higher |
| `+2` | Up whole step | Slightly higher |
| `+5` | Up perfect 4th | Somewhat higher |
| `+7` | Up perfect 5th | Higher |
| `+12` | Up 1 octave | Much higher |

**Response:** Binary audio file (streaming download)

**Response Headers:**
```
Content-Type: audio/wav | audio/flac | audio/mpeg
Content-Disposition: attachment; filename="{original_stem}_{sign}{semitones}st.{ext}"
```

**Output Filename Pattern:** `{original_name}_{±semitones}st.{ext}`
- Example: `song.mp3` with `+3` semitones → `song_+3st.mp3`
- Example: `track.wav` with `-5` semitones → `track_-5st.wav`

**Example Usage (Frontend):**
```typescript
async function pitchShift(file: File, semitones: number): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('semitones', semitones.toString())

  const response = await fetch(`${API_BASE}/api/v1/audio/pitch-shift`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail)
  }

  return response.blob()
}
```

**Error Scenarios:**
- `400` - Missing filename, invalid file extension, audio exceeds 15 minutes, semitones is 0
- `413` - File exceeds 100MB
- `422` - `semitones` outside valid range (-12 to 12)
- `500` - Audio processing failure

---

## Frontend Implementation Patterns

### API Base URL Configuration

```typescript
// Use OpenAPI generated client's base URL
import { OpenAPI } from '@/client'
const API_BASE = OpenAPI.BASE  // Typically "http://localhost:8000"
```

### Standard File Upload Pattern

All audio endpoints follow this pattern:

```typescript
async function processAudio(
  endpoint: string,
  file: File,
  params?: Record<string, string | number>
): Promise<Response> {
  const formData = new FormData()
  formData.append('file', file)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      formData.append(key, value.toString())
    })
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Processing failed')
  }

  return response
}
```

### Handling Binary Responses

For endpoints that return audio files (`change-bpm`, `pitch-shift`):

```typescript
// Get filename from Content-Disposition header
function getFilenameFromResponse(response: Response): string {
  const disposition = response.headers.get('Content-Disposition')
  if (disposition) {
    const match = disposition.match(/filename="(.+)"/)
    if (match) return match[1]
  }
  return 'processed_audio.mp3'
}

// Download processed audio
async function downloadProcessedAudio(response: Response) {
  const blob = await response.blob()
  const filename = getFilenameFromResponse(response)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

### Error Handling

```typescript
interface ApiError {
  detail: string
}

async function handleApiError(response: Response): Promise<never> {
  const contentType = response.headers.get('Content-Type')

  if (contentType?.includes('application/json')) {
    const error: ApiError = await response.json()
    throw new Error(error.detail)
  }

  throw new Error(`Request failed with status ${response.status}`)
}
```

---

## Technical Notes

### Audio Processing Library

The backend uses **librosa** for audio analysis and processing:
- Sample rate: 22050 Hz (standard for analysis)
- Key detection: Chroma CQT features with Krumhansl-Schmuckler profiles
- BPM detection: Beat tracking algorithm
- Time stretching: Phase vocoder (preserves pitch)
- Pitch shifting: Phase vocoder (preserves tempo)

### File Format Support

| Format | MIME Type | Notes |
|--------|-----------|-------|
| MP3 | `audio/mpeg` | Most common, lossy compression |
| WAV | `audio/wav` | Uncompressed, larger files |
| FLAC | `audio/flac` | Lossless compression |

Output format always matches input format.

### Processing Time Expectations

Processing time depends on:
- File duration (longer = more time)
- File format (MP3 requires decoding)
- Server load

Typical processing times for a 3-minute song:
- Analysis: 2-5 seconds
- BPM change: 5-15 seconds
- Pitch shift: 5-15 seconds

Frontend should show loading states during processing.
