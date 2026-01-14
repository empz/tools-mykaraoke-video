from sqlmodel import SQLModel


# Generic message
class Message(SQLModel):
    message: str


# Audio analysis response
class AudioAnalysisResult(SQLModel):
    key: str  # e.g., "C major", "F# minor"
    bpm: float  # beats per minute
    duration: float  # audio duration in seconds
