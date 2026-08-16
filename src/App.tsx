import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './lib/session'
import { StoreProvider } from './lib/store'
import { Login } from './screens/Login'
import { Exercises } from './screens/Exercises'
import { Exercise } from './screens/Exercise'
import { History } from './screens/History'
import { Profile } from './screens/Profile'

function Screens() {
  const session = useSession()

  if (session === undefined) {
    return (
      <div className="centered">
        <p className="label">Loading</p>
      </div>
    )
  }

  if (session === null) return <Login />

  return (
    <StoreProvider>
      <Routes>
        <Route path="/" element={<Exercises />} />
        <Route path="/exercise/:id" element={<Exercise />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </StoreProvider>
  )
}

export function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <Screens />
      </HashRouter>
    </SessionProvider>
  )
}
