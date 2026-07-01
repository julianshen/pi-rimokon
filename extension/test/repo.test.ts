import { describe, expect, it } from 'vitest'
import { parseRepoSlug } from '../src/repo.ts'

const cfg = (url: string) => `[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*\n`

describe('parseRepoSlug', () => {
  it('parses an SSH remote', () => {
    expect(parseRepoSlug(cfg('git@github.com:acme/web-app.git'))).toBe('acme/web-app')
  })
  it('parses an HTTPS remote (with or without .git / trailing slash)', () => {
    expect(parseRepoSlug(cfg('https://github.com/acme/web-app.git'))).toBe('acme/web-app')
    expect(parseRepoSlug(cfg('https://github.com/acme/web-app'))).toBe('acme/web-app')
  })
  it('returns undefined when there is no origin remote', () => {
    expect(parseRepoSlug('[core]\n\tbare = false\n')).toBeUndefined()
  })
})
