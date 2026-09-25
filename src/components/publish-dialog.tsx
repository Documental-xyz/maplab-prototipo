'use client'

// MapLab Studio — Publish dialog.
// Lets the user publish the project to a (fake) public URL. For MVP the
// "publish" action just toasts success and shows a fake URL. Real
// persistence to /api/styles/{id}/publish is left as a TODO.

import * as React from 'react'
import { Globe, Lock, Check, Copy, Rocket, Layers, Database } from 'lucide-react'

import { useMapLabStore } from '@/lib/map-store'
import { Badge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function PublishDialog() {
  const open = useMapLabStore((s) => s.publishOpen)
  const setOpen = useMapLabStore((s) => s.setPublishOpen)
  const project = useMapLabStore((s) => s.project)
  const layers = useMapLabStore((s) => s.mapStyle.layers)
  const sources = useMapLabStore((s) => s.mapStyle.sources)
  const pushToast = useMapLabStore((s) => s.pushToast)

  const [isPublic, setIsPublic] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [publishedUrl, setPublishedUrl] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const close = () => {
    setOpen(false)
    // small delay to let the close animation finish before resetting UI state
    setTimeout(() => {
      setPublishedUrl(null)
      setPublishing(false)
      setCopied(false)
      setIsPublic(false)
    }, 200)
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      // 1. Persist the project + style first (same flow as TopBar.handleSave).
      const mapStyle = useMapLabStore.getState().mapStyle
      const proj = useMapLabStore.getState().project
      let projectId = proj.id
      if (projectId === 'default') {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: proj.name, description: proj.description }),
        })
        if (!res.ok) throw new Error(`POST /api/projects failed: ${res.status}`)
        const created = (await res.json()) as
          | { project?: { id: string } }
          | { id: string }
        projectId =
          ('project' in created && created.project?.id) ||
          ('id' in created && created.id) ||
          ''
        if (!projectId) throw new Error('Server returned no project id')
        useMapLabStore.getState().setProject({ id: projectId })
      }
      const styleRes = await fetch(`/api/projects/${projectId}/styles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mapStyle.name, spec: mapStyle }),
      })
      if (!styleRes.ok) throw new Error(`POST styles failed: ${styleRes.status}`)
      const styleJson = (await styleRes.json()) as
        | { style?: { id: string } }
        | { id: string }
      const styleId =
        ('style' in styleJson && styleJson.style?.id) ||
        ('id' in styleJson && styleJson.id) ||
        ''
      if (!styleId) throw new Error('Server returned no style id')
      // 2. Mark the style as published.
      const pubRes = await fetch(`/api/styles/${styleId}/publish`, {
        method: 'POST',
      })
      if (!pubRes.ok) throw new Error(`POST publish failed: ${pubRes.status}`)
      const pub = (await pubRes.json()) as { url: string; publishedAt: string }
      // Use the absolute origin so the displayed URL is shareable.
      const origin =
        typeof window !== 'undefined' ? window.location.origin : ''
      setPublishedUrl(`${origin}${pub.url}`)
      pushToast('Project published', 'success')
    } catch (e) {
      pushToast(
        `Publish failed: ${e instanceof Error ? e.message : String(e)}`,
        'error',
      )
    } finally {
      setPublishing(false)
    }
  }

  const copyUrl = async () => {
    if (!publishedUrl) return
    try {
      await navigator.clipboard.writeText(publishedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      pushToast('URL copied', 'success')
    } catch {
      pushToast('Clipboard unavailable', 'error')
    }
  }

  const sourceCount = sources.length
  const layerCount = layers.length
  // Datasets map to unique source names — for MVP we just count sources.
  const datasetCount = sourceCount

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-4" />
            Publish project
          </DialogTitle>
          <DialogDescription>
            Generate a shareable URL for <strong>{project.name}</strong>.
            Anyone with the link will be able to view the map.
          </DialogDescription>
        </DialogHeader>

        {publishedUrl ? (
          // ---- Success state ----
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-2 text-sm">
              <Check className="size-4" />
              <span className="font-medium">Published successfully</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Public URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={publishedUrl}
                  className="h-9 font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyUrl}
                      className="size-9"
                    >
                      {copied ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy URL</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        ) : (
          // ---- Pre-publish state ----
          <div className="flex flex-col gap-3 py-1">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border p-2 text-center">
                <Layers className="size-3.5 mx-auto text-muted-foreground mb-1" />
                <div className="text-base font-semibold">{layerCount}</div>
                <div className="text-[10px] text-muted-foreground">Layers</div>
              </div>
              <div className="rounded-md border p-2 text-center">
                <Database className="size-3.5 mx-auto text-muted-foreground mb-1" />
                <div className="text-base font-semibold">{sourceCount}</div>
                <div className="text-[10px] text-muted-foreground">Sources</div>
              </div>
              <div className="rounded-md border p-2 text-center">
                <Database className="size-3.5 mx-auto text-muted-foreground mb-1" />
                <div className="text-base font-semibold">{datasetCount}</div>
                <div className="text-[10px] text-muted-foreground">Datasets</div>
              </div>
            </div>

            <Separator />

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 opacity-60">
                  <div className="flex items-center gap-2">
                    {isPublic ? (
                      <Globe className="size-4" />
                    ) : (
                      <Lock className="size-4" />
                    )}
                    <div>
                      <div className="text-sm font-medium">Make public</div>
                      <div className="text-[11px] text-muted-foreground">
                        Coming soon — currently disabled for MVP.
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    disabled
                    aria-label="Make public (coming soon)"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Public/private toggle is disabled in MVP
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px] h-5">
                MVP
              </Badge>
              <span>
                Publishing is simulated locally. Real tilehosting is on the
                roadmap.
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          {!publishedUrl && (
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? (
                <>
                  <span className="size-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Rocket className="size-4" />
                  Publish
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PublishDialog
