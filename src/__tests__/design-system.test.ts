import { readFileSync } from 'fs'
import { join } from 'path'

describe('Design system CSS tokens', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')

  it('contains --amber token', () => {
    expect(css).toContain('--amber: #f5a623')
  })

  it('contains --bg token', () => {
    expect(css).toContain('--bg: #0c0c0b')
  })

  it('contains --text token', () => {
    expect(css).toContain('--text: #eae8e1')
  })

  it('contains font-head reference', () => {
    expect(css).toContain('--font-head')
  })

  it('contains --radius-pill token', () => {
    expect(css).toContain('--radius-pill: 22px')
  })
})
