import { useEffect, type RefObject } from 'react'
import type { Terminal } from '@xterm/xterm'

interface UseKeywordHighlightOptions {
  termRef: RefObject<Terminal | null>
  profileId?: string | null
}

// Decoration-based keyword scanning is intentionally disabled.
// Terminal keyword highlighting now runs through the ANSI stream pipeline,
// while this hook remains as a reserved extension point for sparse semantic decorations.
export function useKeywordHighlight({ termRef }: UseKeywordHighlightOptions) {
  useEffect(() => {
    void termRef
  }, [termRef])
}
