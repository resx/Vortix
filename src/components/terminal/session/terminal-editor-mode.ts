const ALT_SCREEN_CSI_PATTERN = String.raw`\u001b\[\?(1049|1047|47)(?:;[0-9;]*)?([hl])`
const ALT_SCREEN_CSI_REGEX = new RegExp(ALT_SCREEN_CSI_PATTERN, 'g')

export function resolveFullscreenEditorModeFromOutput(
  output: string,
  previousMode: boolean,
): boolean {
  let nextMode = previousMode
  let match: RegExpExecArray | null = ALT_SCREEN_CSI_REGEX.exec(output)

  while (match) {
    const action = match[2]
    if (action === 'h') nextMode = true
    if (action === 'l') nextMode = false
    match = ALT_SCREEN_CSI_REGEX.exec(output)
  }

  ALT_SCREEN_CSI_REGEX.lastIndex = 0
  return nextMode
}
