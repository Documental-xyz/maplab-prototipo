// MapLab Studio — floating map navigation controls.
// Zoom, compass, pitch toggle, locate, and fullscreen. Lives in the
// bottom-right corner of the map.

'use client'

import * as React from 'react'
import {
  ZoomIn,
  ZoomOut,
  Compass,
  LocateFixed,
  Maximize,
  Minimize,
  Mountain,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMap } from './map-view'
import { useMapLabStore } from '@/lib/map-store'

// Slightly bigger than the default `size-9` (36px) to meet the 44px
// touch-target guideline for accessible mobile use.
const BTN_CLASS = 'h-11 w-11 bg-background/85 backdrop-blur-sm shadow-sm'

export function MapControls() {
  const map = useMap()
  const pushToast = useMapLabStore((s) => s.pushToast)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [isPitched, setIsPitched] = React.useState(false)

  // Keep the fullscreen state in sync if the user exits via ESC.
  React.useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const handleZoomIn = () => map?.zoomIn()
  const handleZoomOut = () => map?.zoomOut()
  const handleResetNorth = () => map?.resetNorth()

  const handlePitchToggle = () => {
    if (!map) return
    const next = map.getPitch() > 0 ? 0 : 60
    map.easeTo({ pitch: next })
    setIsPitched(next > 0)
  }

  const handleLocate = () => {
    if (!map) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      pushToast('Geolocation unavailable on this device', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: Math.max(map.getZoom(), 13),
        })
        pushToast('Located', 'success')
      },
      () => {
        pushToast('Location permission denied', 'error')
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const handleFullscreen = () => {
    const container = map?.getContainer()
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {
        pushToast('Fullscreen not available', 'error')
      })
    } else {
      document.exitFullscreen?.().catch(() => {
        // ignore
      })
    }
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
      <Button
        variant="outline"
        size="icon"
        className={BTN_CLASS}
        onClick={handleZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
        disabled={!map}
      >
        <ZoomIn className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={BTN_CLASS}
        onClick={handleZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
        disabled={!map}
      >
        <ZoomOut className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={BTN_CLASS}
        onClick={handleResetNorth}
        aria-label="Reset bearing to north"
        title="Reset bearing"
        disabled={!map}
      >
        <Compass className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={BTN_CLASS}
        onClick={handlePitchToggle}
        aria-label="Toggle 3D pitch"
        title="Toggle 3D pitch"
        disabled={!map}
        data-active={isPitched}
      >
        {isPitched ? <Eye className="h-5 w-5" /> : <Mountain className="h-5 w-5" />}
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={BTN_CLASS}
        onClick={handleLocate}
        aria-label="Locate me"
        title="Locate me"
        disabled={!map}
      >
        <LocateFixed className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={BTN_CLASS}
        onClick={handleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </Button>
    </div>
  )
}
