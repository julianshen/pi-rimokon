import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeviceApprovalScreen } from './DeviceApprovalScreen'

function okFetch() {
  return vi.fn(async () => ({ ok: true, status: 200 }) as Response)
}

describe('DeviceApprovalScreen', () => {
  it('shows a configuration notice when no server is set', () => {
    render(<DeviceApprovalScreen httpBase={undefined} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/isn’t configured/i)
  })

  it('approves a code and reports success', async () => {
    const user = userEvent.setup()
    const fetchFn = okFetch()
    render(
      <DeviceApprovalScreen httpBase="https://srv.test" getToken={async () => 'tok'} fetchFn={fetchFn} />,
    )
    await user.type(screen.getByLabelText(/device code/i), 'wdjb-mjht')
    await user.click(screen.getByRole('button', { name: /authorize/i }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/authorized/i))
    expect(fetchFn).toHaveBeenCalledWith(
      'https://srv.test/oauth/device/approve',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ user_code: 'WDJB-MJHT', decision: 'approve' }) // uppercased
  })

  it('denies a code', async () => {
    const user = userEvent.setup()
    render(
      <DeviceApprovalScreen httpBase="https://srv.test" getToken={async () => 'tok'} fetchFn={okFetch()} />,
    )
    await user.type(screen.getByLabelText(/device code/i), 'AAAA-BBBB')
    await user.click(screen.getByRole('button', { name: /deny/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/denied/i))
  })

  it('surfaces an error when not signed in', async () => {
    const user = userEvent.setup()
    render(
      <DeviceApprovalScreen httpBase="https://srv.test" getToken={async () => null} fetchFn={okFetch()} />,
    )
    await user.type(screen.getByLabelText(/device code/i), 'AAAA-BBBB')
    await user.click(screen.getByRole('button', { name: /authorize/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sign in/i))
  })

  it('surfaces a server error', async () => {
    const user = userEvent.setup()
    const fetchFn = vi.fn(async () => ({ ok: false, status: 400 }) as Response)
    render(
      <DeviceApprovalScreen httpBase="https://srv.test" getToken={async () => 'tok'} fetchFn={fetchFn} />,
    )
    await user.type(screen.getByLabelText(/device code/i), 'AAAA-BBBB')
    await user.click(screen.getByRole('button', { name: /authorize/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not approve/i))
  })
})
