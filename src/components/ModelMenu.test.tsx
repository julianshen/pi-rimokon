import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../hooks/useTheme'
import { MODELS } from '../data/models'
import { ModelMenu } from './ModelMenu'

function setup(model = 'sonnet') {
  const onPick = vi.fn()
  const utils = render(
    <ThemeProvider>
      <ModelMenu model={model} onPick={onPick} />
    </ThemeProvider>,
  )
  return { onPick, ...utils }
}

describe('ModelMenu', () => {
  it('renders every available model with its provider', () => {
    setup()
    for (const m of MODELS) {
      expect(screen.getByText(m.label)).toBeInTheDocument()
      // providers can repeat in theory, so just assert presence
      expect(screen.getAllByText(m.provider).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/switch model/i)).toBeInTheDocument()
  })

  it('calls onPick with the model id when an option is clicked', async () => {
    const user = userEvent.setup()
    const { onPick } = setup('sonnet')
    await user.click(screen.getByText('GPT-5'))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith('gpt5')
  })

  it('renders an option button per model', () => {
    setup()
    // each model is a clickable button
    expect(screen.getAllByRole('button')).toHaveLength(MODELS.length)
  })
})
