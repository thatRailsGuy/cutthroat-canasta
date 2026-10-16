import { describe, expect, it } from 'vitest'
import main from '../src/main.tsx?raw'

// The built stylesheet follows the import order in main.tsx. jsdom can't show which rule wins,
// so this checks the order itself: a component's own rule only wins a tie with a page-wide one
// (such as a:hover) when global.css comes first.
describe('style order', () => {
  it('loads the page-wide styles before the components and the overrides after', () => {
    const at = (line: string) => main.indexOf(line)
    expect(at("import './global.css'")).toBeGreaterThan(-1)
    expect(at("import './global.css'")).toBeLessThan(at("import { App } from './App'"))
    expect(at("import { App } from './App'")).toBeLessThan(at("import './overrides.css'"))
  })
})
