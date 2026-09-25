'use client'

// MapLab Studio — theme toggle button (light / dark / system).
// Cycles light → dark → system → light. Uses next-themes' useTheme hook.

import * as React from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // next-themes reads localStorage on mount; avoid SSR mismatch by rendering
  // a stable placeholder until mounted.
  React.useEffect(() => setMounted(true), [])

  // Use a stable aria-label + label/next on the server and the first client
  // render, then switch to the real values after mount. This avoids a
  // hydration mismatch (next-themes returns `undefined` on the server).
  const displayTheme = mounted ? theme : undefined
  const next = displayTheme === 'light' ? 'dark' : displayTheme === 'dark' ? 'system' : 'light'
  const label = !mounted
    ? 'Theme'
    : displayTheme === 'system'
      ? `System (now ${resolvedTheme === 'dark' ? 'dark' : 'light'})`
      : displayTheme === 'dark'
        ? 'Dark'
        : 'Light'

  const Icon = !mounted
    ? Sun
    : displayTheme === 'dark'
      ? Moon
      : displayTheme === 'system'
        ? Monitor
        : Sun

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Toggle theme"
          onClick={() => setTheme(next)}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {mounted ? `${label} — click for ${next}` : 'Theme'}
      </TooltipContent>
    </Tooltip>
  )
}
