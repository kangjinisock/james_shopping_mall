import { useEffect, useState } from 'react'
import Navbar from './Navbar'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')

const AUTH_STORAGE_KEYS = ['accessToken', 'tokenType', 'currentUser', 'tokenExpiresIn', 'loginAt']

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key)
  })
}

function parseJwtPayload(token) {
  if (typeof token !== 'string') {
    return null
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function getValidStoredSession() {
  const accessToken = localStorage.getItem('accessToken')
  if (!accessToken) {
    return null
  }

  const tokenType = localStorage.getItem('tokenType') || 'Bearer'
  if (tokenType !== 'Bearer') {
    clearAuthStorage()
    return null
  }

  const payload = parseJwtPayload(accessToken)
  if (!payload?.exp || Date.now() >= payload.exp * 1000) {
    clearAuthStorage()
    return null
  }

  return { accessToken, tokenType }
}

function LoginPage({ onGoHome, onGoRegister, onGoCart }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    let isMounted = true

    async function tryAutoLogin() {
      const session = getValidStoredSession()
      if (!session) {
        return
      }

      const { accessToken, tokenType } = session

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          headers: {
            Authorization: `${tokenType} ${accessToken}`,
          },
        })

        const contentType = response.headers.get('content-type') || ''
        const rawText = await response.text()
        const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

        if (!response.ok || !data?.user) {
          throw new Error(data?.message || '자동 로그인에 실패했습니다.')
        }

        if (isMounted) {
          localStorage.setItem('currentUser', JSON.stringify(data.user))
          onGoHome()
        }
      } catch (error) {
        clearAuthStorage()
      }
    }

    tryAutoLogin()

    return () => {
      isMounted = false
    }
  }, [onGoHome])

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage({ type: '', text: '' })

    if (!email.trim() || !password) {
      setMessage({ type: 'error', text: '이메일과 비밀번호를 입력해 주세요.' })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const contentType = response.headers.get('content-type') || ''
      const rawText = await response.text()
      const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

      if (!response.ok) {
        throw new Error(data?.message || `로그인에 실패했습니다. (${response.status})`)
      }

      if (!data?.accessToken || !data?.tokenType || !data?.user) {
        throw new Error('로그인 응답 형식이 올바르지 않습니다.')
      }

      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('tokenType', data.tokenType)
      localStorage.setItem('currentUser', JSON.stringify(data.user))
      localStorage.setItem('tokenExpiresIn', data?.expiresIn || '')
      localStorage.setItem('loginAt', new Date().toISOString())

      setMessage({ type: 'success', text: '로그인에 성공했습니다.' })
      setPassword('')
      setTimeout(() => {
        onGoHome()
      }, 400)
    } catch (error) {
      setMessage({ type: 'error', text: error.message || '로그인 중 오류가 발생했습니다.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page-shell">
      <Navbar
        userName=""
        isAdmin={false}
        onGoHome={onGoHome}
        onGoLogin={() => {}}
        onGoRegister={onGoRegister}
        onGoCart={onGoCart}
        onLogout={() => {}}
      />

      <section className="login-page-content" aria-label="로그인 페이지">
        <section className="login-wrap">
          <h1 className="login-title">로그인</h1>
          <p className="login-subtitle">이메일과 비밀번호를 입력하세요.</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <div className="password-row">
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button type="button" className="password-help">비밀번호를 잊었나요?</button>
            </div>

            <button type="submit" className="login-submit" disabled={isSubmitting}>
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="login-create-account">
            계정이 있으신가요? <button type="button" onClick={onGoRegister}>계정생성</button>
          </p>

          <div className="social-login-group" aria-label="소셜 로그인">
            <button type="button" className="social-btn google">
              <span className="social-icon">G</span>
              <span>구글로 로그인</span>
            </button>
            <button type="button" className="social-btn apple">
              <span className="social-icon"></span>
              <span>애플로 로그인</span>
            </button>
            <button type="button" className="social-btn facebook">
              <span className="social-icon">f</span>
              <span>페이스북으로 로그인</span>
            </button>
            <button type="button" className="social-btn kakao">
              <span className="social-icon">●</span>
              <span>카카오로 로그인</span>
            </button>
            <button type="button" className="social-btn naver">
              <span className="social-icon">N</span>
              <span>네이버로 로그인</span>
            </button>
          </div>

          <button type="button" className="to-home-link" onClick={onGoHome}>메인으로 돌아가기</button>

          {message.text ? (
            <p className={`status-message ${message.type === 'success' ? 'success' : 'error'}`}>
              {message.text}
            </p>
          ) : null}
        </section>
      </section>
    </div>
  )
}

export default LoginPage
