import { createFileRoute } from "@tanstack/react-router"
import { Music } from "lucide-react"
import { useCallback, useState } from "react"

import { OpenAPI } from "@/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FileDropzone } from "@/components/ui/file-dropzone"
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
  const { showErrorToast } = useCustomToast()

  const analyzeFile = useCallback(
    async (fileToAnalyze: File) => {
      setIsAnalyzing(true)
      setResult(null)

      try {
        const formData = new FormData()
        formData.append("file", fileToAnalyze)

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
    },
    [showErrorToast],
  )

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile)
    setResult(null)
    if (selectedFile) {
      analyzeFile(selectedFile)
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
        <CardContent>
          <FileDropzone
            accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
            onFileSelect={handleFileSelect}
            selectedFile={file}
            description="Drag & drop an audio file here, or click to select"
            disabled={isAnalyzing}
            loading={isAnalyzing}
          />
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
