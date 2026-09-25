'use client'

// MapLab Studio — QR code renderer (client-only).
// Wraps the `qrcode` library to render a data URL into an <img>.
// Falls back to the lucide QrCode icon while loading or on error.

import * as React from 'react'
import QRCode from 'qrcode'
import { QrCode as QrPlaceholder } from 'lucide-react'
import { cn } from '@/lib/utils'

export function QrCodeImage({
  value,
  size = 128,
  className,
}: {
  value: string
  size?: number
  className?: string
}) {
  const [src, setSrc] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setSrc(null)
    setFailed(false)
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (failed) {
    return (
      <div
        className={cn(
          'grid place-items-center text-muted-foreground bg-muted/30 rounded-md border-2 border-dashed',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <QrPlaceholder className="size-10" />
      </div>
    )
  }

  if (!src) {
    return (
      <div
        className={cn(
          'grid place-items-center text-muted-foreground bg-muted/30 rounded-md border-2 border-dashed animate-pulse',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <QrPlaceholder className="size-10" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className={cn('rounded-md border bg-white', className)}
    />
  )
}
