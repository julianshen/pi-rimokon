/**
 * Extract an `owner/repo` slug from a git config's `[remote "origin"]` url, to
 * match the repo identifier the SPA/server use for idle-agent selection (§5.4).
 * Handles both SSH (`git@host:owner/repo.git`) and HTTPS
 * (`https://host/owner/repo.git`) remotes. Returns undefined if not found.
 */
export function parseRepoSlug(gitConfig: string): string | undefined {
  const remote = /\[remote "origin"\][^[]*?\burl\s*=\s*(\S+)/.exec(gitConfig)
  if (!remote) return undefined
  const url = remote[1].trim()
  const slug = /[:/]([^/:]+\/[^/]+?)(?:\.git)?\/?$/.exec(url)
  return slug?.[1]
}
