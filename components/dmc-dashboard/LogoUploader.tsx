'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2, Building2 } from 'lucide-react'

interface Props {
  value: string
  onChange: (url: string) => void
}

export default function LogoUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5 MB')
      return
    }
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', '/agents/logos')
      fd.append('fileName', `logo_${Date.now()}`)
      const res = await fetch('/api/imagekit/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) {
        onChange(data.url)
      } else {
        setError('Upload failed. Please try again.')
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
        <Upload className="w-3.5 h-3.5" />
        Agency Logo
      </label>

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="relative w-20 h-20 rounded-2xl border-2 border-gray-200 bg-gray-50 flex-shrink-0 overflow-hidden group">
          {value ? (
            <>
              <img src={value} alt="Logo" className="w-full h-full object-contain p-1" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  title="Change"
                  className="bg-white text-gray-800 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange('')}
                  title="Remove"
                  className="bg-red-500 text-white p-1.5 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="w-7 h-7 text-gray-300" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}
        </div>

        {/* Upload button + info */}
        <div className="flex-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-4 h-4" /> {value ? 'Replace Logo' : 'Upload Logo'}</>
            )}
          </button>
          <p className="text-xs text-gray-400 mt-1.5 text-center">PNG, JPG, WEBP · Max 5 MB</p>
          {error && <p className="text-xs text-red-500 mt-1 text-center">{error}</p>}
        </div>
      </div>
    </div>
  )
}
