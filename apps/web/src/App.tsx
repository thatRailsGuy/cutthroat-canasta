import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router'
import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'
import { RulesPage } from './pages/RulesPage'
import { TutorialPage } from './tutorial/TutorialPage'

// Dev only: the table with a made-up game, for working on its look. Left out of builds.
const PreviewPage = import.meta.env.DEV ? lazy(() => import('./dev/PreviewPage')) : null

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/g/:code" element={<GamePage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/learn" element={<TutorialPage />} />
      {PreviewPage && (
        <Route
          path="/dev/table"
          element={
            <Suspense>
              <PreviewPage />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<Link to="/">Page not found. Back to the start.</Link>} />
    </Routes>
  )
}
