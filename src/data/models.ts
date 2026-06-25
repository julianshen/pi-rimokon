import type { ModelDef } from '../lib/types'

// Available models for the in-session model switcher (⌃L). Ports the prototype's
// MODELS list across providers.
export const MODELS: ModelDef[] = [
  { id: 'sonnet', label: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'gpt5', label: 'GPT-5', provider: 'OpenAI' },
  { id: 'gemini', label: 'Gemini 2.5 Pro', provider: 'Google' },
  { id: 'kimi', label: 'Kimi K2', provider: 'Moonshot · OAuth' },
  { id: 'qwen', label: 'Qwen3 Coder', provider: 'Local · Ollama' },
]

export function modelLabel(id: string): string {
  const m = MODELS.find((m) => m.id === id)
  return m ? m.label.replace('Claude ', '') : id
}
