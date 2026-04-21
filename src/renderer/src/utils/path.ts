/**
 * Cross-platform dirname: returns the directory portion of a file path.
 * Works for both Windows (backslash) and POSIX (forward slash) paths.
 */
export function dirname(filePath: string): string {
  const normalised = filePath.replace(/\\/g, '/')
  const lastSlash = normalised.lastIndexOf('/')
  if (lastSlash === -1) return '.'
  return normalised.substring(0, lastSlash) || '/'
}

/**
 * Returns just the filename (without directory) from a path.
 */
export function basename(filePath: string): string {
  const normalised = filePath.replace(/\\/g, '/')
  return normalised.substring(normalised.lastIndexOf('/') + 1)
}
