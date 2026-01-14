import { createFileRoute } from "@tanstack/react-router"
import { Download, Gauge } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { Slider } from "@/components/ui/slider"
import useCustomToast from "@/hooks/useCustomToast"

export const Route = createFileRoute("/_layout/bpm-changer")({
  component: BpmChanger,
  head: () => ({
    meta: [{ title: "BPM Changer - MyKaraoke Video" }],
  }),
})

interface AnalysisResult {
  key: string
  bpm: number
  duration: number
}

function BpmChanger() {
  const [file, setFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  )
  const [bpmFactor, setBpmFactor] = useState([100])
  const { showErrorToast, showSuccessToast } = useCustomToast()

  const analyzeFile = useCallback(
    async (fileToAnalyze: File) => {
      setIsAnalyzing(true)
      setAnalysisResult(null)

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
        setAnalysisResult(data)
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
    setAnalysisResult(null)
    setBpmFactor([100])
    if (selectedFile) {
      analyzeFile(selectedFile)
    }
  }

  const handleChangeBpm = async () => {
    if (!file) return

    setIsProcessing(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("bpm_factor", (bpmFactor[0] / 100).toString())

      const response = await fetch(`${OpenAPI.BASE}/api/v1/audio/change-bpm`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Processing failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${file.name.replace(/\.[^/.]+$/, "")}_${bpmFactor[0]}pct${file.name.match(/\.[^/.]+$/)?.[0] || ".mp3"}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showSuccessToast("Audio processed and downloaded!")
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Failed to process audio",
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const newBpm = analysisResult
    ? Math.round(analysisResult.bpm * (bpmFactor[0] / 100))
    : null

  const newDuration = analysisResult
    ? analysisResult.duration / (bpmFactor[0] / 100)
    : null

  const isBusy = isAnalyzing || isProcessing

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Gauge className="h-6 w-6" />
          BPM Changer
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload an audio file, detect its BPM, and adjust the tempo
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
            disabled={isBusy}
            loading={isAnalyzing}
          />
        </CardContent>
      </Card>

      {analysisResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Original Audio Properties</CardTitle>
              <CardDescription>
                Detected properties for {file?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Key</p>
                  <p className="text-2xl font-bold">{analysisResult.key}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">BPM</p>
                  <p className="text-2xl font-bold">{analysisResult.bpm}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(analysisResult.duration)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Adjust BPM</CardTitle>
              <CardDescription>
                Change the tempo while preserving pitch
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bpm-slider">Speed</Label>
                  <span className="text-sm font-medium">{bpmFactor[0]}%</span>
                </div>
                <Slider
                  id="bpm-slider"
                  min={50}
                  max={150}
                  step={1}
                  value={bpmFactor}
                  onValueChange={setBpmFactor}
                  disabled={isProcessing}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50% (Half speed)</span>
                  <span>100% (Original)</span>
                  <span>150% (1.5x speed)</span>
                </div>
              </div>

              {newBpm && newDuration && (
                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">New BPM</p>
                    <p className="text-2xl font-bold">{newBpm}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">New Duration</p>
                    <p className="text-2xl font-bold">
                      {formatDuration(newDuration)}
                    </p>
                  </div>
                </div>
              )}

              <LoadingButton
                onClick={handleChangeBpm}
                loading={isProcessing}
                className="w-full"
              >
                <Download className="h-4 w-4" />
                {isProcessing ? "Processing..." : "Download Modified Audio"}
              </LoadingButton>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
