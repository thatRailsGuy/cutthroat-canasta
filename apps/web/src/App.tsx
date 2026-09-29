import { Link, Route, Routes } from 'react-router'
import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/g/:code" element={<GamePage />} />
      <Route path="*" element={<Link to="/">Page not found. Back to the start.</Link>} />
    </Routes>
  )
}
