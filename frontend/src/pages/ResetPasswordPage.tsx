import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import client from '../api/client'

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!token) {
      setError('Invalid or missing reset token.')
      return
    }
    if (!password) {
      setError('Please enter a new password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await client.post('/api/auth/reset-password', { token, newPassword: password })
      setSuccess(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">API Playground</h1>
          <p className="text-gray-400 mt-2 text-sm">
            {success ? 'Password Reset Successful' : 'Set your new password'}
          </p>
        </div>

        {success ? (
          <div className="text-center transition-all duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl animate-bounce">
              ✓
            </div>
            <p className="text-gray-300 text-sm mb-6 leading-relaxed">
              Your password has been successfully updated. You can now use your new password to log in.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Alerts */}
            {error && (
              <div className="bg-red-900/20 border border-red-800/80 text-red-400 px-4 py-3 rounded-xl text-sm transition-all">
                {error}
              </div>
            )}

            {!token ? (
              <div className="bg-amber-950/20 border border-amber-800/80 text-amber-400 px-4 py-4 rounded-xl text-sm leading-relaxed mb-4">
                <strong>Reset link is invalid or expired.</strong> Please request a new link from the login page.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-gray-950/80 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-gray-950/80 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm mt-3 transition-all duration-200 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                >
                  {loading ? 'Updating password...' : 'Reset Password →'}
                </button>
              </>
            )}

            <button
              onClick={() => navigate('/login')}
              className="text-sm text-gray-400 hover:text-white text-center font-medium mt-4 transition-all duration-200"
            >
              ← Back to Login
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default ResetPasswordPage
