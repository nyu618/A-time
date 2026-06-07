import React from 'react'
import { Routes, Route } from 'react-router-dom'
import UserView from './pages/UserView'
import AdminView from './pages/AdminView'

function App() {
  return (
    <Routes>
      <Route path="/" element={<UserView />} />
      <Route path="/liff" element={<UserView />} />
      <Route path="/admin" element={<AdminView />} />
      <Route path="*" element={<UserView />} />
    </Routes>
  )
}

export default App
