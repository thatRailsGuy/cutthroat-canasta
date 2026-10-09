import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import styles from '../rules/Rules.module.css'
import { RulesContent } from '../rules/RulesContent'
import { PAGE_SECTIONS } from '../rules/sections'
import { SoundCredits } from '../rules/SoundCredits'
import { useTitle } from '../title'

// The credits are on this page only, so they aren't a section the Rules drawer can open.
const CONTENTS = [...PAGE_SECTIONS, { id: 'sound-credits', title: 'Sound credits' }]

export function RulesPage() {
  const { hash } = useLocation()
  useTitle('Rules')

  useEffect(() => {
    // The browser can't jump to the anchor on load: the page renders after it looks.
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.()
  }, [hash])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/">Cutthroat Canasta</Link>
        <h1>Rules</h1>
        <Link to="/learn">Learn to play</Link>
        <button type="button" className={styles.print} onClick={() => window.print()}>
          Print
        </button>
      </header>
      <nav className={styles.toc} aria-label="Contents">
        <details open>
          <summary>Contents</summary>
          <ol>
            {CONTENTS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </details>
      </nav>
      <main className={styles.content}>
        <RulesContent />
        <SoundCredits />
      </main>
    </div>
  )
}
