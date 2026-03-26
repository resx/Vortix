function shouldAllowTabHandling(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false

  // Preserve Tab behavior in terminal and code editor contexts.
  if (el.closest('.terminal-container, .xterm')) return true
  if (el.closest('.cm-editor')) return true

  // Optional escape hatch for specific regions.
  if (el.closest('[data-allow-tab-navigation="true"]')) return true

  return false
}

export function shouldBlockTabFocusNavigation(event: KeyboardEvent): boolean {
  if (event.key !== 'Tab') return false
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  return !shouldAllowTabHandling(event.target)
}

