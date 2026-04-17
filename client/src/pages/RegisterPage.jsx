import { useState } from 'react'
import Navbar from './Navbar'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')

const INITIAL_FORM_DATA = {
  email: '',
  name: '',
  gender: '',
  phone: '',
  password: '',
  confirmPassword: '',
  user_type: 'customer',
  address: '',
}

const INITIAL_AGREEMENTS = {
  terms: false,
  privacy: false,
  marketing: false,
}

function RegisterPage({ onGoHome, onGoLogin, onGoCart }) {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [agreements, setAgreements] = useState(INITIAL_AGREEMENTS)

  const isAllAgreed = agreements.terms && agreements.privacy && agreements.marketing

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  function handleAgreementChange(event) {
    const { name, checked } = event.target
    setAgreements((prev) => ({ ...prev, [name]: checked }))
  }

  function handleAllAgreementChange(event) {
    const { checked } = event.target
    setAgreements({
      terms: checked,
      privacy: checked,
      marketing: checked,
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage({ type: '', text: '' })

    if (!formData.email || !formData.name || !formData.password || !formData.confirmPassword || !formData.user_type) {
      setMessage({ type: 'error', text: '필수 항목을 모두 입력해 주세요.' })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' })
      return
    }

    if (!agreements.terms || !agreements.privacy) {
      setMessage({ type: 'error', text: '이용약관과 개인정보처리방침은 필수 동의입니다.' })
      return
    }

    try {
      setIsSubmitting(true)

      const payload = {
        email: formData.email,
        name: formData.name,
        gender: formData.gender,
        phone: formData.phone.trim(),
        password: formData.password,
        user_type: formData.user_type,
        address: formData.address.trim(),
        agreements: {
          terms: agreements.terms,
          privacy: agreements.privacy,
          marketing: agreements.marketing,
        },
      }

      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const contentType = response.headers.get('content-type') || ''
      const rawText = await response.text()
      const data = contentType.includes('application/json') && rawText
        ? JSON.parse(rawText)
        : null

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `회원가입에 실패했습니다. (${response.status})`)
      }

      setMessage({ type: 'success', text: '회원가입이 완료되었습니다.' })
      setFormData(INITIAL_FORM_DATA)
      setAgreements(INITIAL_AGREEMENTS)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="signup-page-shell">
      <Navbar
        userName=""
        isAdmin={false}
        onGoHome={onGoHome}
        onGoLogin={onGoLogin}
        onGoRegister={() => {}}
        onGoCart={onGoCart}
        onLogout={() => {}}
      />

      <section className="signup-page-content">
        <section className="signup-card">
          <p className="eyebrow">SHOPPING MALL DEMO</p>
          <h1>회원가입</h1>
          <p className="subtitle">usersController 기준 필수값(email, name, password, user_type)을 입력해 주세요.</p>

          <form className="signup-form" onSubmit={handleSubmit}>
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <label htmlFor="name">이름</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="홍길동"
              value={formData.name}
              onChange={handleChange}
              required
            />

            <label htmlFor="gender">성별 (선택)</label>
            <select id="gender" name="gender" value={formData.gender} onChange={handleChange}>
              <option value="">선택 안 함</option>
              <option value="female">여성</option>
              <option value="male">남성</option>
              <option value="other">기타</option>
            </select>

            <label htmlFor="phone">연락처 (선택)</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="010-1234-5678"
              value={formData.phone}
              onChange={handleChange}
            />

            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="비밀번호 입력"
              value={formData.password}
              onChange={handleChange}
              required
            />

            <label htmlFor="confirmPassword">비밀번호 확인</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="비밀번호 다시 입력"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />

            <label htmlFor="user_type">유저 타입</label>
            <select id="user_type" name="user_type" value={formData.user_type} onChange={handleChange} required>
              <option value="customer">customer</option>
              <option value="seller">seller</option>
              <option value="admin">admin</option>
            </select>

            <label htmlFor="address">주소 (선택)</label>
            <input
              id="address"
              name="address"
              type="text"
              placeholder="서울특별시 강남구"
              value={formData.address}
              onChange={handleChange}
            />

            <section className="agreement-box" aria-label="약관 동의">
              <label className="agreement-row agreement-all" htmlFor="agreeAll">
                <input id="agreeAll" type="checkbox" checked={isAllAgreed} onChange={handleAllAgreementChange} />
                <span>전체 동의</span>
              </label>

              <div className="agreement-divider" />

              <label className="agreement-row" htmlFor="agreeTerms">
                <span className="agreement-left">
                  <input
                    id="agreeTerms"
                    type="checkbox"
                    name="terms"
                    checked={agreements.terms}
                    onChange={handleAgreementChange}
                  />
                  <span>이용약관 동의 (필수)</span>
                </span>
                <button type="button" className="agreement-view">보기</button>
              </label>

              <label className="agreement-row" htmlFor="agreePrivacy">
                <span className="agreement-left">
                  <input
                    id="agreePrivacy"
                    type="checkbox"
                    name="privacy"
                    checked={agreements.privacy}
                    onChange={handleAgreementChange}
                  />
                  <span>개인정보처리방침 동의 (필수)</span>
                </span>
                <button type="button" className="agreement-view">보기</button>
              </label>

              <label className="agreement-row" htmlFor="agreeMarketing">
                <span className="agreement-left">
                  <input
                    id="agreeMarketing"
                    type="checkbox"
                    name="marketing"
                    checked={agreements.marketing}
                    onChange={handleAgreementChange}
                  />
                  <span>마케팅 정보 수신 동의 (선택)</span>
                </span>
                <button type="button" className="agreement-view">보기</button>
              </label>
            </section>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '가입 중...' : '회원가입하기'}
            </button>
          </form>

          <button type="button" className="back-button" onClick={onGoHome}>
            메인으로 돌아가기
          </button>

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

export default RegisterPage
