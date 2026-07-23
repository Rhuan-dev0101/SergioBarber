'use client'

import React, { useState, useCallback } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import { X, Check, ZoomIn, ZoomOut, RotateCcw, Crop } from 'lucide-react'
import { PixelCrop } from '@/lib/cropUtils'

interface ImageCropModalProps {
  isOpen: boolean
  imageSrc: string
  initialCrop?: { x: number; y: number }
  initialZoom?: number
  onClose: () => void
  onConfirm: (
    pixelCrop: PixelCrop, 
    crop: { x: number; y: number }, 
    zoom: number
  ) => void
}

export function ImageCropModal({
  isOpen,
  imageSrc,
  initialCrop = { x: 0, y: 0 },
  initialZoom = 1,
  onClose,
  onConfirm
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>(initialCrop)
  const [zoom, setZoom] = useState<number>(initialZoom)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null)

  const onCropCompleteCallback = useCallback((_croppedAreaPercent: Area, croppedAreaPixelsParam: Area) => {
    setCroppedAreaPixels(croppedAreaPixelsParam)
  }, [])

  if (!isOpen || !imageSrc) return null

  const handleConfirm = () => {
    if (croppedAreaPixels) {
      onConfirm(croppedAreaPixels, crop, zoom)
    }
    onClose()
  }

  const handleReset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-secondary/30">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-serif font-bold text-sm text-foreground">Ajustar Corte & Enquadramento</h3>
              <p className="text-[11px] text-muted-foreground">Arraste a imagem para centralizar o corte de cabelo no enquadramento quadrado.</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper Container - Fixed 1:1 Aspect Ratio Box */}
        <div className="relative w-full h-80 sm:h-96 bg-black/90 select-none">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteCallback}
            onZoomChange={setZoom}
            showGrid={true}
            cropShape="rect"
          />
        </div>

        {/* Zoom & Reset Controls */}
        <div className="px-6 py-3 bg-secondary/20 border-t border-border/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5 py-1 rounded bg-secondary/40 hover:bg-secondary transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Redefinir
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40 bg-secondary/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg border border-border/60 hover:bg-secondary/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary-hover rounded-lg flex items-center gap-1.5 shadow transition-all"
          >
            <Check className="w-4 h-4" /> Aplicar Corte
          </button>
        </div>

      </div>
    </div>
  )
}
