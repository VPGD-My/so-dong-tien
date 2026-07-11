import React, { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Sai email hoặc mật khẩu')
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1B211A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleLogin} style={{ background: '#222A1E', padding: 32, borderRadius: 12, width: 320, border: '1px solid #3A4632' }}>
        <h1 style={{ color: '#EBD5AB', fontSize: 20, marginBottom: 20 }}>Sổ Dòng Tiền</h1>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 6, border: '1px solid #3A4632', background: '#2B3524', color: '#EDEAD9' }} />
        <input type="password" placeholder="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 6, border: '1px solid #3A4632', background: '#2B3524', color: '#EDEAD9' }} />
        {error && <p style={{ color: '#C1544A', fontSize: 13, marginBottom: 10 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10, borderRadius: 6, background: '#EBD5AB', border: 'none', fontWeight: 600 }}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}