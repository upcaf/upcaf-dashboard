import { useAuth } from './hooks/useAuth'
import Dashboard from './components/Dashboard'
import Login from './components/Login'

export default function App() {
  const { isAuthenticated, login, logout } = useAuth()

  if (!isAuthenticated) {
    return <Login onLogin={login} />
  }

  return <Dashboard onLogout={logout} />
}
