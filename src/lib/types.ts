import type { StatusKey, ToolKind, DiffSign } from './theme'

// Domain model for a Pi session. These shapes mirror what a real Pi RPC/SDK
// would return, so the mock service can later be swapped for a live transport
// without touching the UI.

export interface DiffLine {
  /** sign: '+' added, '-' removed, ' ' context, '@' hunk header */
  t: DiffSign
  /** code/content of the line */
  c: string
}

export interface ToolCall {
  kind: ToolKind
  path: string
  meta?: string
  diff?: DiffLine[]
}

export type GenUIType = 'preview' | 'chart'

export interface ChartPoint {
  t: string
  v: number
  spike?: boolean
}

export interface GenUI {
  type: GenUIType
  title: string
  // chart-only
  unit?: string
  note?: string
  series?: ChartPoint[]
}

export interface ThreadMessage {
  role: 'user' | 'agent'
  text?: string
  /** user message that steered an in-flight run */
  steer?: boolean
  /** agent: whether this message streams in token-by-token */
  streaming?: boolean
  intro?: string
  tools?: ToolCall[]
  genui?: GenUI
  /** agent is asking the user to pick a steer */
  question?: boolean
  options?: string[]
}

export interface FileChange {
  path: string
  status: 'A' | 'M' | 'D'
  add: number
  del: number
  diff?: DiffLine[]
}

export interface TreeNode {
  label: string
  meta: string
  node?: string
  branch?: boolean
  bookmark?: boolean
  current?: boolean
  canRewind?: boolean
}

export interface Session {
  id: string
  title: string
  repo: string
  branch: string
  status: StatusKey
  model: string
  latest: string
  time: string
  add: number
  del: number
  /** session is a live Pi instance actively streaming */
  live?: boolean
  thread: ThreadMessage[]
  changes: FileChange[]
  terminal: string[]
  tree: TreeNode[]
}

export interface ModelDef {
  id: string
  label: string
  provider: string
}

export interface RepoConnection {
  name: string
  meta: string
}
