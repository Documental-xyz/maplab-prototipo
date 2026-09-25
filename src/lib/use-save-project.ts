'use client'

// MapLab Studio — shared save hook.
// Lifts the "save project + style" flow out of the TopBar so any component
// (TopBar, command palette, etc.) can trigger it without fragile DOM
// coupling (e.g. document.querySelector('button[aria-label="Save"]')).
//
// Flow:
//   1. POST /api/projects (creates a new project) when project.id === 'default'.
//      Otherwise PATCH /api/projects/{id} with the current name/description.
//   2. POST /api/projects/{id}/styles with the current mapStyle.
//   3. On success, updates the store with the new project id (so subsequent
//      saves PATCH instead of POST).
//
// Returns { save, saving, error } so callers can show a spinner / toast.

import * as React from 'react'
import { useMapLabStore } from '@/lib/map-store'
import type { MapStyle } from '@/lib/types'

interface SaveResult {
  ok: true
  projectId: string
  styleId: string
}
interface SaveError {
  ok: false
  error: string
}

function pickId(
  json: { project?: { id: string } } | { id: string } | unknown,
): string {
  if (typeof json !== 'object' || json === null) return ''
  const j = json as { project?: { id: string }; id?: string; style?: { id: string } }
  return j.project?.id ?? j.id ?? j.style?.id ?? ''
}

export function useSaveProject() {
  const setProject = useMapLabStore((s) => s.setProject)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const [saving, setSaving] = React.useState(false)

  const save = React.useCallback(async (): Promise<SaveResult | SaveError> => {
    const mapStyle: MapStyle = useMapLabStore.getState().mapStyle
    const proj = useMapLabStore.getState().project
    setSaving(true)
    try {
      let projectId = proj.id
      if (projectId === 'default') {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: proj.name,
            description: proj.description,
          }),
        })
        if (!res.ok) {
          const msg = `POST /api/projects failed: ${res.status}`
          pushToast(`Save failed: ${msg}`, 'error')
          return { ok: false, error: msg }
        }
        const created = await res.json()
        projectId = pickId(created)
        if (!projectId) {
          const msg = 'Server returned no project id'
          pushToast(`Save failed: ${msg}`, 'error')
          return { ok: false, error: msg }
        }
        setProject({ id: projectId })
      } else {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: proj.name,
            description: proj.description,
          }),
        })
        if (!res.ok) {
          const msg = `PATCH /api/projects failed: ${res.status}`
          pushToast(`Save failed: ${msg}`, 'error')
          return { ok: false, error: msg }
        }
      }

      const styleRes = await fetch(`/api/projects/${projectId}/styles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mapStyle.name, spec: mapStyle }),
      })
      if (!styleRes.ok) {
        const msg = `POST styles failed: ${styleRes.status}`
        pushToast(`Save failed: ${msg}`, 'error')
        return { ok: false, error: msg }
      }
      const styleJson = await styleRes.json()
      const styleId = pickId(styleJson)
      if (!styleId) {
        const msg = 'Server returned no style id'
        pushToast(`Save failed: ${msg}`, 'error')
        return { ok: false, error: msg }
      }

      // Persist datasets (geojson + pmtiles sources) under the project.
      // We POST each source with ?dedup=true so the backend deletes existing
      // rows with the same name+type before inserting — this keeps the
      // dataset list from growing unbounded on repeated saves (datasets
      // don't need version history, unlike styles).
      for (const src of mapStyle.sources) {
        try {
          if (src.type === 'geojson' && src.data) {
            const data =
              typeof src.data === 'string'
                ? src.data
                : JSON.stringify(src.data)
            await fetch(`/api/projects/${projectId}/datasets?dedup=true`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: src.name,
                type: 'geojson',
                data,
              }),
            })
          } else if (
            (src.type === 'vector' || src.type === 'raster') &&
            src.url
          ) {
            // For pmtiles sources, the url is `pmtiles://<remote-url>`. Strip
            // the protocol prefix before persisting.
            const url = src.url.startsWith('pmtiles://')
              ? src.url.slice('pmtiles://'.length)
              : src.url
            await fetch(`/api/projects/${projectId}/datasets?dedup=true`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: src.name,
                type: 'pmtiles',
                data: url,
              }),
            })
          }
        } catch {
          // Dataset persistence is best-effort — don't fail the save if one
          // dataset POST errors.
        }
      }

      pushToast('Project saved', 'success')
      return { ok: true, projectId, styleId }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      pushToast(`Save failed: ${msg}`, 'error')
      return { ok: false, error: msg }
    } finally {
      setSaving(false)
    }
  }, [setProject, pushToast])

  return { save, saving }
}
