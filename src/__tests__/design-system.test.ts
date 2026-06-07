import { readFileSync } from 'fs'
import { join } from 'path'

describe('Design system CSS tokens', () => {
  const globals = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')
  const apexUi = readFileSync(join(process.cwd(), 'src/styles/apex-ui.css'), 'utf8')

  it('imports apex-ui from globals', () => {
    expect(globals).toContain('./apex-ui.css')
  })

  it('contains --amber token in apex-ui', () => {
    expect(apexUi).toContain('--amber: #f5a623')
  })

  it('contains mockup --bg token in apex-ui', () => {
    expect(apexUi).toContain('--bg: #0a0a09')
  })

  it('contains --text token in apex-ui', () => {
    expect(apexUi).toContain('--text: #ece9e1')
  })

  it('uses Satoshi for font-head', () => {
    expect(apexUi).toContain("'Satoshi'")
    expect(globals).toContain('Satoshi')
  })

  it('contains --radius-pill in theme', () => {
    expect(globals).toContain('--radius-pill: 22px')
  })
})
