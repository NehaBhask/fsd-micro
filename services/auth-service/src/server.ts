import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI || '')
  .then(() => console.log('Auth Service: MongoDB connected!'))
  .catch(err => console.error('Auth Service: MongoDB failed:', err))

// User Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
})
const User = mongoose.model('User', userSchema)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' })
})

// Register
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body
    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ error: 'Email already registered' })
    const hashed = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, password: hashed })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } })
  } catch {
    res.status(500).json({ error: 'Something went wrong' })
  }
})

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ error: 'Invalid credentials' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } })
  } catch {
    res.status(500).json({ error: 'Something went wrong' })
  }
})

// Verify token — called by other services
app.post('/verify', (req, res) => {
  try {
    const { token } = req.body
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
    res.json({ valid: true, userId: decoded.id })
  } catch {
    res.status(401).json({ valid: false, error: 'Invalid token' })
  }
})

// Forgot Password
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      // For security, return same success message so users can't discover registered emails
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' })
    }

    const resetToken = jwt.sign(
      { id: user._id, type: 'reset' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '15m' }
    )

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080'
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY is not configured!')
      return res.status(500).json({ error: 'Email service is not configured' })
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'API Playground <onboarding@resend.dev>',
        to: user.email,
        subject: 'Reset your API Playground Password',
        html: `
          <div style="font-family: system-ui, sans-serif; background-color: #0f1117; color: #e2e8f0; padding: 2rem; border-radius: 8px; max-width: 600px; margin: auto; border: 1px solid #1e293b;">
            <h2 style="color: #ffffff; text-align: center; margin-bottom: 1.5rem;">Reset Your Password</h2>
            <p style="font-size: 1rem; line-height: 1.5; color: #94a3b8; margin-bottom: 2rem; text-align: center;">
              You requested a password reset for your API Playground account. Click the button below to set a new password. This link is valid for 15 minutes.
            </p>
            <div style="text-align: center; margin-bottom: 2rem;">
              <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
            </div>
            <p style="font-size: 0.85rem; color: #64748b; text-align: center; margin-top: 2rem;">
              If you did not request this, you can safely ignore this email.
            </p>
          </div>
        `
      })
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('Failed to send email via Resend:', errText)
      return res.status(500).json({ error: 'Failed to send reset email' })
    }

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' })
  } catch (err) {
    console.error('Forgot password error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

// Reset Password
app.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' })

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
    if (decoded.type !== 'reset') {
      return res.status(400).json({ error: 'Invalid reset token' })
    }

    const user = await User.findById(decoded.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const hashed = await bcrypt.hash(newPassword, 10)
    user.password = hashed
    await user.save()

    res.json({ message: 'Password has been reset successfully' })
  } catch (err) {
    console.error('Reset password error:', err)
    res.status(400).json({ error: 'Token is invalid or has expired' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`))