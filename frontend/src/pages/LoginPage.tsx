import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

type ViewState = 'login' | 'signup' | 'forgot'

function LoginPage() {
  const [view, setView] = useState<ViewState>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (view === 'forgot') {
        const res = await client.post('/api/auth/forgot-password', { email })
        setSuccess(res.data.message || 'Recovery email sent! Please check your inbox.')
      } else {
        const url = view === 'login' ? '/api/auth/login' : '/api/auth/register'
        const body = view === 'login' ? { email, password } : { name, email, password }
        const res = await client.post(url, body)
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        navigate('/')
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">

        {/* Logo & Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">API Playground</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {view === 'login' && 'Welcome back! Log in to continue.'}
            {view === 'signup' && 'Create your free developer account.'}
            {view === 'forgot' && 'Reset your password to regain access.'}
          </p>
        </div>

        {/* View Toggle (Only for Login & Signup) */}
        {view !== 'forgot' && (
          <div className="flex bg-gray-950/60 border border-gray-800 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setView('login'); setError(''); setSuccess('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                ${view === 'login' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Login
            </button>
            <button
              onClick={() => { setView('signup'); setError(''); setSuccess('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                ${view === 'signup' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/80 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm transition-all animate-pulse">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/20 border border-emerald-800/80 text-emerald-400 px-4 py-3 rounded-xl mb-5 text-sm transition-all">
            {success}
          </div>
        )}

        {/* Input Forms */}
        <div className="flex flex-col gap-4">
          {view === 'signup' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-gray-950/80 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm transition-all"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-950/80 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm transition-all"
            />
          </div>

          {view !== 'forgot' && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center pl-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
                {view === 'login' && (
                  <button
                    onClick={() => { setView('forgot'); setError(''); setSuccess('') }}
                    className="text-xs text-blue-500 hover:text-blue-400 font-semibold transition-all"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="bg-gray-950/80 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm transition-all"
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm mt-3 transition-all duration-200 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
          >
            {loading ? 'Please wait...' : 
             view === 'login' ? 'Login →' : 
             view === 'signup' ? 'Create Account →' : 
             'Send Recovery Link →'}
          </button>

          {view === 'forgot' && (
            <button
              onClick={() => { setView('login'); setError(''); setSuccess('') }}
              className="text-sm text-gray-400 hover:text-white text-center font-medium mt-4 transition-all duration-200 flex items-center justify-center gap-1"
            >
              ← Back to Login
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

export default LoginPage