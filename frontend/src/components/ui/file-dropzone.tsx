import { Loader2, Upload, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface FileDropzoneProps {
  accept?: string
  onFileSelect: (file: File | null) => void
  selectedFile: File | null
  description?: string
  className?: string
  disabled?: boolean
  loading?: boolean
}

export function FileDropzone({
  accept,
  onFileSelect,
  selectedFile,
  description = "Drag & drop a file here, or click to select",
  className,
  disabled = false,
  loading = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDisabled = disabled || loading

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!isDisabled) {
        setIsDragging(true)
      }
    },
    [isDisabled],
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (isDisabled) return

      const file = e.dataTransfer.files[0]
      if (file) {
        onFileSelect(file)
      }
    },
    [onFileSelect, isDisabled],
  )

  const handleClick = () => {
    if (!isDisabled) {
      inputRef.current?.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDisabled) return
    onFileSelect(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
        isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25",
        !isDisabled &&
          !isDragging &&
          "hover:border-primary/50 hover:bg-muted/50",
        selectedFile && !isDragging && "border-primary/50 bg-primary/5",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={isDisabled}
      />

      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing...</p>
        </div>
      ) : selectedFile ? (
        <div className="flex items-center gap-3 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isDisabled}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Remove file</span>
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </>
      )}
    </div>
  )
}
