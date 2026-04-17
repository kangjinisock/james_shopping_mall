import { useEffect, useState } from 'react'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')
).replace(/\/+$/, '')

function Navbar({
  userName,
  isAdmin,
  onGoHome,
  onGoLogin,
  onGoRegister,
  onLogout,
  onGoAdmin,
  onGoCart,
  onGoMyOrders,
  greeting,
}) {
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function fetchCartCount() {
      try {
        const rawUser = localStorage.getItem('currentUser')
        if (!rawUser) {
          if (isMounted) {
            setCartCount(0)
          }
          return
        }

        const parsedUser = JSON.parse(rawUser)
        const userId = typeof parsedUser?._id === 'string' ? parsedUser._id : ''
        if (!userId) {
          if (isMounted) {
            setCartCount(0)
          }
          return
        }

        const response = await fetch(`${API_BASE_URL}/carts/count?userId=${encodeURIComponent(userId)}&status=active`)
        const contentType = response.headers.get('content-type') || ''
        const rawText = await response.text()
        const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

        if (!response.ok) {
          if (isMounted) {
            setCartCount(0)
          }
          return
        }

        if (isMounted) {
          setCartCount(Number(data?.totalQuantity) || 0)
        }
      } catch {
        if (isMounted) {
          setCartCount(0)
        }
      }
    }

    fetchCartCount()
    window.addEventListener('cart-updated', fetchCartCount)
    window.addEventListener('storage', fetchCartCount)

    return () => {
      isMounted = false
      window.removeEventListener('cart-updated', fetchCartCount)
      window.removeEventListener('storage', fetchCartCount)
    }
  }, [userName])

  return (
    <header className="mall-nav">
      <button type="button" className="mall-logo" onClick={onGoHome}>
        MINIBEE
      </button>
      <nav className="mall-categories" aria-label="메인 메뉴">
        <button type="button">카테고리</button>
        <button type="button">오늘의 특가</button>
        <button type="button">베스트</button>
        <button type="button">신상품</button>
        <button type="button">브랜드스토리</button>
      </nav>

      <div className="mall-actions">
        {greeting ? (
          <p className="mall-welcome">{greeting}</p>
        ) : (
          <>
            {userName ? (
              <div className="mall-user-menu">
                <button
                  type="button"
                  className="mall-user-menu-btn"
                  aria-haspopup="menu"
                  aria-label="사용자 메뉴"
                >
                  {userName}님 환영합니다
                </button>
                <div className="mall-user-dropdown" role="menu" aria-label="사용자 메뉴 항목">
                  {typeof onGoMyOrders === 'function' ? (
                    <button type="button" className="mall-user-dropdown-btn" onClick={onGoMyOrders}>
                      내 주문목록
                    </button>
                  ) : null}
                  <button type="button" className="mall-user-dropdown-btn" onClick={onLogout}>
                    로그아웃
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="mall-btn ghost" onClick={onGoLogin}>
                로그인
              </button>
            )}

            {isAdmin ? (
              <button type="button" className="mall-btn dark" onClick={onGoAdmin}>
                어드민
              </button>
            ) : null}

            {!userName ? (
              <button type="button" className="mall-btn" onClick={onGoRegister}>
                회원가입
              </button>
            ) : null}
          </>
        )}

        <button type="button" className="mall-cart-btn" onClick={onGoCart} aria-label="장바구니">
          <span className="mall-cart-label">장바구니</span>
          <span className="mall-cart-count">{cartCount}</span>
        </button>
      </div>
    </header>
  )
}

export default Navbar