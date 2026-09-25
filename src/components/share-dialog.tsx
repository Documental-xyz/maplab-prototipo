'use client'

// MapLab Studio — Share dialog.
// Shows the project URL the user can copy, social share buttons, and a real
// QR code rendered client-side via the `qrcode` library.

import * as React from 'react'
import {
  Share2,
  Copy,
  Check,
  X,
  Twitter,
  Linkedin,
  Facebook,
} from 'lucide-react'

import { useMapLabStore } from '@/lib/map-store'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { QrCodeImage } from '@/components/qr-code-image'

export function ShareDialog() {
  const open = useMapLabStore((s) => s.shareOpen)
  const setOpen = useMapLabStore((s) => s.setShareOpen)
  const project = useMapLabStore((s) => s.project)
  const pushToast = useMapLabStore((s) => s.pushToast)

  const url = `https://maplab.example/p/${project.id}`
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      pushToast('Link copied', 'success')
    } catch {
      pushToast('Clipboard unavailable', 'error')
    }
  }

  const close = () => setOpen(false)

  const socialLinks: { label: string; href: string; icon: React.ReactNode }[] = [
    {
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `MapLab: ${project.name}`,
      )}&url=${encodeURIComponent(url)}`,
      icon: <Twitter className="size-4" />,
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        url,
      )}`,
      icon: <Linkedin className="size-4" />,
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        url,
      )}`,
      icon: <Facebook className="size-4" />,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4" />
            Share project
          </DialogTitle>
          <DialogDescription>
            Send a read-only link to <strong>{project.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* URL + copy */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Public link</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copy}
                className="size-9"
                aria-label="Copy link"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Social share */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Share to…
            </Label>
            <div className="flex items-center gap-2">
              {socialLinks.map((s) => (
                <Button
                  key={s.label}
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-9 flex-1"
                >
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Share to ${s.label}`}
                  >
                    {s.icon}
                    <span className="text-xs">{s.label}</span>
                  </a>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* QR code (real) */}
          <div className="flex flex-col items-center gap-2">
            <Label className="text-xs text-muted-foreground">QR code</Label>
            <QrCodeImage value={url} size={140} />
            <p className="text-[11px] text-muted-foreground">
              Scan to open on another device.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            <X className="size-4" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ShareDialog
