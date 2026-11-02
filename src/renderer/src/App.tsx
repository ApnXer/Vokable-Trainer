import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Library from './pages/Library'
import SearchPage from './pages/Search'
import SetPage from './pages/SetPage'
import EditSet from './pages/EditSet'
import Flashcards from './modes/Flashcards'
import Learn from './modes/Learn'
import Test from './modes/Test'
import Match from './modes/Match'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="library" element={<Library />} />
        <Route path="folder/:name" element={<Library />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="set/:id" element={<SetPage />} />
        <Route path="set/:id/edit" element={<EditSet />} />
        <Route path="create" element={<EditSet />} />
      </Route>
      <Route path="set/:id/flashcards" element={<Flashcards />} />
      <Route path="set/:id/learn" element={<Learn />} />
      <Route path="set/:id/test" element={<Test />} />
      <Route path="set/:id/match" element={<Match />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
