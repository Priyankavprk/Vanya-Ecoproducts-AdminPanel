import axios from 'axios'
import React, { useState } from 'react'
import { backendUrl } from '../App'
import { toast } from 'react-toastify'

function maskEmail(email) {
  const [local, domain] = String(email).split('@')
  if (!local || !domain) return 'admin email'
  const visible =
    local.length <= 2 ? local[0] : `${local[0]}***${local[local.length - 1]}`
  return `${visible}@${domain}`
}

function Login({ setToken }) {
  const [step, setStep] = useState('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingToken, setPendingToken] = useState('')
  const [otpHint, setOtpHint] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  const resetFlow = () => {
    setStep('credentials')
    setPendingToken('')
    setOtpHint('')
    setOtp('')
  }

  const sendOtpToAdminMail = async (token) => {
    const response = await axios.post(backendUrl + '/api/user/admin/send-otp', {
      pendingToken: token,
    })
    if (response.data.success) {
      setOtpHint(response.data.message || `OTP sent to ${maskEmail(email)}`)
      return true
    }
    toast.error(response.data.message || 'Could not send OTP')
    return false
  }

  const onCredentialsSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await axios.post(backendUrl + '/api/user/admin', { email, password })
      if (response.data.success && response.data.requiresOtp) {
        setPendingToken(response.data.pendingToken)
        const sent = await sendOtpToAdminMail(response.data.pendingToken)
        if (sent) {
          setOtp('')
          setStep('otp')
          toast.success('OTP sent to admin email')
        }
      } else if (response.data.success && response.data.token) {
        setToken(response.data.token)
      } else {
        toast.error(response.data.message || 'Login failed')
      }
    } catch (error) {
      console.log(error)
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  const onResendOtp = async () => {
    if (!pendingToken) return
    setLoading(true)
    try {
      const sent = await sendOtpToAdminMail(pendingToken)
      if (sent) toast.info('OTP resent to admin email')
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  const onVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await axios.post(backendUrl + '/api/user/admin/verify-otp', {
        pendingToken,
        otp: otp.trim(),
      })
      if (response.data.success && response.data.token) {
        setToken(response.data.token)
        toast.success('Login successful')
      } else {
        toast.error(response.data.message || 'Invalid OTP')
      }
    } catch (error) {
      console.log(error)
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center w-full">
      <div className="bg-white shadow-md rounded-lg px-8 py-6 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-1 text-green-800">Admin Panel</h1>
        <p className="text-sm text-gray-600 mb-4">
          {step === 'credentials' && 'Sign in with your admin credentials'}
          {step === 'otp' &&
            (otpHint || `Enter the 6-digit OTP sent to admin email (${maskEmail(email)})`)}
        </p>

        {step === 'credentials' && (
          <form onSubmit={onCredentialsSubmit}>
            <div className="mb-3">
              <p className="text-sm font-medium text-green-800 mb-2">Email Address</p>
              <input
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                className="rounded-md w-full px-3 py-2 border border-gray-300 outline-none"
                type="email"
                placeholder="your@gmail.com"
                required
              />
            </div>
            <div className="mb-3">
              <p className="text-sm font-medium text-green-800 mb-2">Password</p>
              <input
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                className="rounded-md w-full px-3 py-2 border border-gray-300 outline-none"
                type="password"
                placeholder="Enter your password"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mb-2">
              After verification, a one-time code will be sent to your admin email.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2 px-4 rounded-md text-white bg-green-800 disabled:opacity-60"
            >
              {loading ? 'Sending OTP…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={onVerifyOtp} className="space-y-3">
            <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-900">
              Check your admin inbox for the OTP. It expires in 5 minutes.
            </div>
            <div>
              <p className="text-sm font-medium text-green-800 mb-2">6-digit OTP</p>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="rounded-md w-full px-3 py-2 border border-gray-300 outline-none tracking-widest text-lg"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-2 px-4 rounded-md text-white bg-green-800 disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Verify & login'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onResendOtp}
              className="w-full py-2 px-4 rounded-md border border-green-800 text-green-800 disabled:opacity-60"
            >
              Resend OTP to admin email
            </button>
            <button
              type="button"
              onClick={resetFlow}
              className="text-sm text-gray-600 hover:text-green-800"
            >
              ← Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default Login
