import React from 'react'
import { Routes, Route } from 'react-router-dom'
import UserView from './pages/UserView'
import AdminView from './pages/AdminView'
import AgreementView from './pages/AgreementView'

function App() {
  return (
    <Routes>
      <Route path="/" element={<UserView />} />
      <Route path="/liff" element={<UserView />} />
      <Route path="/agreement/:queueId" element={<AgreementView />} />
      <Route path="/admin" element={<AdminView />} />
      <Route path="*" element={<UserView />} />
    </Routes>
  )
}

export default App
