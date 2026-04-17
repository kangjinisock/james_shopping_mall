import { useCallback, useEffect, useState } from 'react'
import Navbar from './Navbar'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')
).replace(/\/+$/, '')

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

function normalizeUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'object') {
    return null
  }

  const { name, user_type } = rawUser
  if (typeof name !== 'string' || !name.trim()) {
    return null
  }

  return {
    ...rawUser,
    name: name.trim(),
    user_type: typeof user_type === 'string' ? user_type : '',
  }
}

function getStoredUser() {
  try {
    const storedUser = localStorage.getItem('currentUser')
    if (!storedUser) {
      return null
    }

    return normalizeUser(JSON.parse(storedUser))
  } catch {
    return null
  }
}

function AllProductsPage({ onGoHome, onGoProduct, onGoLogin, onGoRegister, onGoAdmin, onGoCart, onGoMyOrders }) {
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const [products, setProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)

  const userName = typeof currentUser?.name === 'string' ? currentUser.name : ''
  const isAdmin = typeof currentUser?.user_type === 'string' && currentUser.user_type.toLowerCase() === 'admin'

  const handleLogout = useCallback(() => {
    clearAuthStorage()
    setCurrentUser(null)
  }, [])

  useEffect(() => {
    const session = getValidStoredSession()
    if (!session) {
      return
    }

    const { accessToken, tokenType } = session
    const controller = new AbortController()

    async function fetchMe() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          signal: controller.signal,
          headers: {
            Authorization: `${tokenType} ${accessToken}`,
          },
        })

        if (!response.ok) {
          if (response.status === 401) {
            clearAuthStorage()
            setCurrentUser(null)
          }
          return
        }

        const data = await response.json()
        const normalizedUser = normalizeUser(data?.user)

        if (normalizedUser) {
          setCurrentUser((prevUser) => {
            if (
              prevUser?.name === normalizedUser.name
              && prevUser?.user_type === normalizedUser.user_type
              && String(prevUser?._id || '') === String(normalizedUser?._id || '')
            ) {
              return prevUser
            }
            return normalizedUser
          })
          localStorage.setItem('currentUser', JSON.stringify(normalizedUser))
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          return
        }
      }
    }

    fetchMe()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function fetchAllProducts() {
      try {
        setIsLoadingProducts(true)

        let currentPage = 1
        let hasNextPageFromApi = true
        const collectedProducts = []

        while (hasNextPageFromApi) {
          const response = await fetch(`${API_BASE_URL}/products?page=${currentPage}`)
          const contentType = response.headers.get('content-type') || ''
          const rawText = await response.text()
          const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

          if (!response.ok) {
            throw new Error(data?.message || '상품 목록을 불러오지 못했습니다.')
          }

          const items = Array.isArray(data?.items) ? data.items : []
          collectedProducts.push(...items)

          hasNextPageFromApi = Boolean(data?.pagination?.hasNextPage)
          currentPage += 1
        }

        if (isMounted) {
          setProducts(collectedProducts)
        }
      } catch {
        if (isMounted) {
          setProducts([])
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false)
        }
      }
    }

    fetchAllProducts()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="mall-home all-products-page">
      <Navbar
        userName={userName}
        isAdmin={isAdmin}
        onGoHome={onGoHome}
        onGoLogin={onGoLogin}
        onGoRegister={onGoRegister}
        onLogout={handleLogout}
        onGoAdmin={onGoAdmin}
        onGoCart={onGoCart}
        onGoMyOrders={onGoMyOrders}
      />

      <section className="all-products-section" aria-label="전체 상품 목록">
        <div className="all-products-head">
          <h1>전체 상품</h1>
          <button type="button" className="mall-more-btn" onClick={onGoHome}>
            메인으로
          </button>
        </div>

        {isLoadingProducts ? <p className="mall-products-message">상품을 불러오는 중입니다...</p> : null}
        {!isLoadingProducts && products.length === 0 ? <p className="mall-products-message">등록된 상품이 없습니다.</p> : null}

        {!isLoadingProducts && products.length > 0 ? (
          <div className="mall-product-grid all-products-grid">
            {products.map((item) => (
              <article
                key={item._id || item.sku || item.name}
                className="mall-product-card mall-product-card--clickable"
                onClick={() => onGoProduct(item._id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onGoProduct(item._id)}
              >
                <img src={item.image} alt={item.name} loading="lazy" />
                <h3>{item.name}</h3>
                <p>{typeof item.price === 'number' ? `${item.price.toLocaleString('ko-KR')}원` : '-'}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

    </div>
  )
}

export default AllProductsPage
