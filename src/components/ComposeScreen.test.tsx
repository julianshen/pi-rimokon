import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComposeScreen } from './ComposeScreen'

type Props = React.ComponentProps<typeof ComposeScreen>

function renderCompose(overrides: Partial<Props> = {}) {
  const props: Props = {
    composeText: '',
    composeRepo: 'acme/web-app',
    repoMenu: false,
    skills: { tests: false, lint: false, docs: false },
    onComposeText: vi.fn(),
    onToggleRepoMenu: vi.fn(),
    onPickRepo: vi.fn(),
    onToggleSkill: vi.fn(),
    onUseExample: vi.fn(),
    onStart: vi.fn(),
    ...overrides,
  }
  render(<ComposeScreen {...props} />)
  return props
}

describe('ComposeScreen', () => {
  it('renders the title, selected repo and skill + example options', () => {
    renderCompose({ composeRepo: 'acme/payments-api' })
    expect(screen.getByRole('heading', { name: 'Start a new session' })).toBeInTheDocument()
    expect(screen.getByText('acme/payments-api')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run tests' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lint & format' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update docs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument()
    // Example prompts are listed.
    expect(
      screen.getByText('Add optimistic updates to the cart with rollback on failure'),
    ).toBeInTheDocument()
  })

  it('hides the repo dropdown when repoMenu is closed', () => {
    renderCompose({ repoMenu: false })
    // The repo options only render inside the open menu.
    expect(screen.queryByRole('button', { name: 'earendil-works/pi' })).not.toBeInTheDocument()
  })

  it('shows the repo dropdown options when repoMenu is open', () => {
    renderCompose({ repoMenu: true })
    expect(screen.getByRole('button', { name: 'acme/web-app' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'acme/payments-api' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'acme/mobile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'earendil-works/pi' })).toBeInTheDocument()
  })

  it('fires onToggleRepoMenu when the repo selector is clicked', async () => {
    const user = userEvent.setup()
    const props = renderCompose()
    // The trigger button shows the current repo label.
    await user.click(screen.getByText('acme/web-app'))
    expect(props.onToggleRepoMenu).toHaveBeenCalledTimes(1)
  })

  it('fires onPickRepo with the chosen repo from the open menu', async () => {
    const user = userEvent.setup()
    const props = renderCompose({ repoMenu: true })
    await user.click(screen.getByRole('button', { name: 'acme/mobile' }))
    expect(props.onPickRepo).toHaveBeenCalledWith('acme/mobile')
  })

  it('fires onToggleSkill with the skill key when a skill is clicked', async () => {
    const user = userEvent.setup()
    const props = renderCompose()
    await user.click(screen.getByRole('button', { name: 'Run tests' }))
    expect(props.onToggleSkill).toHaveBeenCalledWith('tests')
  })

  it('renders enabled and disabled skills (both branches of the toggle)', () => {
    // tests on, lint off — both branches of the on/off styling render fine.
    renderCompose({ skills: { tests: true, lint: false, docs: true } })
    expect(screen.getByRole('button', { name: 'Run tests' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lint & format' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update docs' })).toBeInTheDocument()
  })

  it('fires onComposeText as the user types into the textarea', async () => {
    const user = userEvent.setup()
    const props = renderCompose()
    const textarea = screen.getByPlaceholderText(/Describe the task/)
    await user.type(textarea, 'Hi')
    expect(props.onComposeText).toHaveBeenCalled()
  })

  it('reflects the controlled composeText value in the textarea', () => {
    renderCompose({ composeText: 'Refactor the auth module' })
    expect(screen.getByDisplayValue('Refactor the auth module')).toBeInTheDocument()
  })

  it('fires onUseExample with the example text when an example is clicked', async () => {
    const user = userEvent.setup()
    const props = renderCompose()
    await user.click(
      screen.getByText('Write integration tests for the webhook handler'),
    )
    expect(props.onUseExample).toHaveBeenCalledWith(
      'Write integration tests for the webhook handler',
    )
  })

  it('fires onStart when "Start session" is clicked', async () => {
    const user = userEvent.setup()
    const props = renderCompose()
    await user.click(screen.getByRole('button', { name: 'Start session' }))
    expect(props.onStart).toHaveBeenCalledTimes(1)
  })
})
