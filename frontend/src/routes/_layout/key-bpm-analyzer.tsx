import { createFileRoute } from "@tanstack/react-router"
import { Music, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { OpenAPI } from "@/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"

export const Route = createFileRoute("/_layout/key-bpm-analyzer")({
  component: KeyBpmAnalyzer,
  head: () => ({
    meta: [{ title: "Key & BPM Analyzer - MyKaraoke Video" }],
  }),
})

interface AnalysisResult {
  key: string
  bpm: number
  duration: number
}

function KeyBpmAnalyzer() {
  const [file, setFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showErrorToast } = useCustomToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleAnalyze = async () => {
    if (!file) return

    setIsAnalyzing(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`${OpenAPI.BASE}/api/v1/audio/analyze`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Analysis failed")
      }

      const data: AnalysisResult = await response.json()
      setResult(data)
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Failed to analyze audio",
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Music className="h-6 w-6" />
          Key & BPM Analyzer
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload an audio file to detect its musical key and tempo
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Audio File</CardTitle>
          <CardDescription>
            Supported formats: MP3, WAV, FLAC (max 15 minutes)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="audio-file">Audio File</Label>
            <Input
              id="audio-file"
              type="file"
              accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
              onChange={handleFileChange}
              ref={fileInputRef}
            />
          </div>

          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)}{" "}
              MB)
            </p>
          )}

          <LoadingButton
            onClick={handleAnalyze}
            disabled={!file}
            loading={isAnalyzing}
            className="w-full sm:w-auto"
          >
            <Upload className="h-4 w-4" />
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </LoadingButton>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Detected musical properties for {file?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Key</p>
                <p className="text-2xl font-bold">{result.key}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">BPM</p>
                <p className="text-2xl font-bold">{result.bpm}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-2xl font-bold">
                  {formatDuration(result.duration)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
