import tempfile
from pathlib import Path

import librosa
import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile

from app.models import AudioAnalysisResult

router = APIRouter(prefix="/audio", tags=["audio"])

# Configuration
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_DURATION_SECONDS = 15 * 60  # 15 minutes
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac"}

# Key detection constants
KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Schmuckler key profiles for major and minor keys
MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)


def detect_key(chroma: np.ndarray[tuple[int, int], np.dtype[np.floating]]) -> str:
    """Detect musical key from chroma features using correlation with key profiles."""
    chroma_mean = np.mean(chroma, axis=1)

    # Normalize
    major_norm = MAJOR_PROFILE / np.linalg.norm(MAJOR_PROFILE)
    minor_norm = MINOR_PROFILE / np.linalg.norm(MINOR_PROFILE)
    chroma_norm = chroma_mean / (np.linalg.norm(chroma_mean) + 1e-10)

    # Compute correlations for all 12 keys (major and minor)
    major_correlations = []
    minor_correlations = []

    for i in range(12):
        major_rotated = np.roll(major_norm, i)
        minor_rotated = np.roll(minor_norm, i)
        major_correlations.append(np.corrcoef(chroma_norm, major_rotated)[0, 1])
        minor_correlations.append(np.corrcoef(chroma_norm, minor_rotated)[0, 1])

    # Find best match
    max_major_idx = int(np.argmax(major_correlations))
    max_minor_idx = int(np.argmax(minor_correlations))

    if major_correlations[max_major_idx] > minor_correlations[max_minor_idx]:
        return f"{KEY_NAMES[max_major_idx]} major"
    else:
        return f"{KEY_NAMES[max_minor_idx]} minor"


@router.post("/analyze", response_model=AudioAnalysisResult)
async def analyze_audio(file: UploadFile) -> AudioAnalysisResult:
    """
    Analyze an audio file to detect its musical key and BPM.

    Accepts MP3, WAV, or FLAC files up to 15 minutes in duration.
    Returns the detected key (e.g., "C major") and tempo in BPM.
    """
    # Validate filename
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read and validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    # Create temporary file for librosa processing
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
            tmp_path = Path(tmp.name)
            tmp.write(content)

        # Load audio file
        y, sr = librosa.load(str(tmp_path), sr=22050)
        duration = float(librosa.get_duration(y=y, sr=sr))

        # Validate duration
        if duration > MAX_DURATION_SECONDS:
            raise HTTPException(
                status_code=400,
                detail=f"Audio too long. Maximum duration: {MAX_DURATION_SECONDS // 60} minutes",
            )

        # Detect BPM using beat tracking
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(np.asarray(tempo).item())

        # Detect key using chroma features
        chromagram = librosa.feature.chroma_cqt(y=y, sr=sr)
        key = detect_key(chromagram)

        return AudioAnalysisResult(key=key, bpm=round(bpm, 1), duration=round(duration, 1))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to analyze audio: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if tmp_path and tmp_path.exists():
            tmp_path.unlink()
