'use client'

// MapLab Studio — Theme provider wrapper around next-themes.
// next-themes attaches the `dark` class to <html> based on the user's
// preference (system / light / dark), which Tailwind v4 + shadcn consume.

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
