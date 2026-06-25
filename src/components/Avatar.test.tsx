import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders an <img> when given a url', () => {
    render(<Avatar url="https://example.com/me.png" initials="JS" />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toBe('https://example.com/me.png')
    expect(img.alt).toBe('JS')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('renders initials when no url is provided', () => {
    render(<Avatar url={null} initials="AB" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('falls back to initials when the image fails to load', () => {
    render(<Avatar url="https://example.com/broken.png" initials="ZZ" />)
    const img = screen.getByRole('img')
    fireEvent.error(img)
    // after the error the img is gone and the initials show
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('ZZ')).toBeInTheDocument()
  })

  it('applies the size prop to the rendered image', () => {
    render(<Avatar url="https://example.com/me.png" initials="JS" size={48} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.style.width).toBe('48px')
    expect(img.style.height).toBe('48px')
  })

  it('uses the default size of 32 for the initials fallback', () => {
    render(<Avatar url={null} initials="JS" />)
    const tile = screen.getByText('JS')
    expect(tile.style.width).toBe('32px')
    expect(tile.style.height).toBe('32px')
  })

  it('scales the initials font with a custom size', () => {
    render(<Avatar url={null} initials="JS" size={50} />)
    const tile = screen.getByText('JS')
    // Math.round(50 * 0.38) = 19
    expect(tile.style.fontSize).toBe('19px')
  })

  it('clears the broken flag when the url changes', () => {
    const { rerender } = render(<Avatar url="https://example.com/broken.png" initials="JS" />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    // a fresh url deserves a new load attempt
    rerender(<Avatar url="https://example.com/new.png" initials="JS" />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toBe('https://example.com/new.png')
  })
})
