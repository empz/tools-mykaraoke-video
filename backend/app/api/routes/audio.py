import io
import tempfile
from pathlib import Path
from typing import Callable

import librosa
import numpy as np
import soundfile as sf  # type: ignore[import-untyped]
from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

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


# Mapping of file extensions to soundfile format strings
EXTENSION_TO_FORMAT = {
    ".wav": "WAV",
    ".flac": "FLAC",
    ".mp3": "MP3",
}

# Mapping of file extensions to MIME types
EXTENSION_TO_MIME = {
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".mp3": "audio/mpeg",
}


def process_audio_stereo(
    y: np.ndarray, process_fn: Callable[..., np.ndarray], **kwargs
) -> np.ndarray:
    """
    Apply a processing function to audio, handling both mono and stereo.

    For stereo audio (2D array), processes each channel separately.
    """
    if y.ndim == 1:
        # Mono audio
        return process_fn(y, **kwargs)
    else:
        # Stereo audio - process each channel separately
        channels = [process_fn(y[ch], **kwargs) for ch in range(y.shape[0])]
        return np.array(channels)


@router.post("/change-bpm")
async def change_bpm(
    file: UploadFile,
    bpm_factor: float = Form(..., ge=0.5, le=1.5),
) -> StreamingResponse:
    """
    Change the BPM of an audio file using time stretching.

    - bpm_factor: 0.5 = 50% speed (half tempo), 1.5 = 150% speed (1.5x tempo)
    - Preserves pitch while changing tempo.
    - Preserves stereo and original sample rate for maximum quality.
    - Returns the processed audio file in the same format as input.
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

    tmp_path: Path | None = None
    try:
        # Save input file
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
            tmp_path = Path(tmp.name)
            tmp.write(content)

        # Load audio preserving stereo and original sample rate
        y, sr = librosa.load(str(tmp_path), sr=None, mono=False)
        duration = float(librosa.get_duration(y=y, sr=sr))

        # Validate duration
        if duration > MAX_DURATION_SECONDS:
            raise HTTPException(
                status_code=400,
                detail=f"Audio too long. Maximum duration: {MAX_DURATION_SECONDS // 60} minutes",
            )

        # Apply time stretch (rate > 1 = faster, < 1 = slower)
        y_stretched = process_audio_stereo(
            y, librosa.effects.time_stretch, rate=bpm_factor
        )

        # Write to buffer (transpose for stereo: librosa uses (channels, samples), soundfile uses (samples, channels))
        buffer = io.BytesIO()
        audio_out = y_stretched.T if y_stretched.ndim == 2 else y_stretched
        sf.write(buffer, audio_out, sr, format=EXTENSION_TO_FORMAT[file_ext])
        buffer.seek(0)

        # Generate output filename
        stem = Path(file.filename).stem
        output_filename = f"{stem}_{int(bpm_factor * 100)}pct{file_ext}"

        return StreamingResponse(
            buffer,
            media_type=EXTENSION_TO_MIME[file_ext],
            headers={
                "Content-Disposition": f'attachment; filename="{output_filename}"'
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to process audio: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if tmp_path and tmp_path.exists():
            tmp_path.unlink()


@router.post("/pitch-shift")
async def pitch_shift(
    file: UploadFile,
    semitones: int = Form(..., ge=-12, le=12),
) -> StreamingResponse:
    """
    Shift the pitch of an audio file by a specified number of semitones.

    - semitones: -12 to +12 (negative = lower pitch, positive = higher pitch)
    - Preserves tempo while changing pitch.
    - Preserves stereo and original sample rate for maximum quality.
    - Returns the processed audio file in the same format as input.
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

    tmp_path: Path | None = None
    try:
        # Save input file
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
            tmp_path = Path(tmp.name)
            tmp.write(content)

        # Load audio preserving stereo and original sample rate
        y, sr = librosa.load(str(tmp_path), sr=None, mono=False)
        duration = float(librosa.get_duration(y=y, sr=sr))

        # Validate duration
        if duration > MAX_DURATION_SECONDS:
            raise HTTPException(
                status_code=400,
                detail=f"Audio too long. Maximum duration: {MAX_DURATION_SECONDS // 60} minutes",
            )

        # Validate semitones is not zero
        if semitones == 0:
            raise HTTPException(
                status_code=400,
                detail="No pitch shift requested. Please select a non-zero semitone value.",
            )

        # Apply pitch shift
        y_shifted = process_audio_stereo(
            y, librosa.effects.pitch_shift, sr=sr, n_steps=semitones
        )

        # Write to buffer (transpose for stereo: librosa uses (channels, samples), soundfile uses (samples, channels))
        buffer = io.BytesIO()
        audio_out = y_shifted.T if y_shifted.ndim == 2 else y_shifted
        sf.write(buffer, audio_out, sr, format=EXTENSION_TO_FORMAT[file_ext])
        buffer.seek(0)

        # Generate output filename
        stem = Path(file.filename).stem
        sign = "+" if semitones >= 0 else ""
        output_filename = f"{stem}_{sign}{semitones}st{file_ext}"

        return StreamingResponse(
            buffer,
            media_type=EXTENSION_TO_MIME[file_ext],
            headers={
                "Content-Disposition": f'attachment; filename="{output_filename}"'
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to process audio: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if tmp_path and tmp_path.exists():
            tmp_path.unlink()
