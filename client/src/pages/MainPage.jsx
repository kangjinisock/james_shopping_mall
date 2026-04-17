import { useCallback, useEffect, useState } from 'react'
import Navbar from './Navbar'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')
).replace(/\/+$/, '')

const FEATURE_TILES = [
  {
    title: '미니비 베스트',
    subtitle: '최대 20% 할인',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.35), rgba(7, 12, 20, 0.1)), url(https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80)',
    },
  },
  {
    title: '패션/슬립웨어 MD PICK',
    subtitle: '최대 20% 할인',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.35), rgba(7, 12, 20, 0.1)), url(https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80)',
    },
  },
  {
    title: '고수 추천 Pick',
    subtitle: '테이블웨어 기획전',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.35), rgba(7, 12, 20, 0.1)), url(https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=1200&q=80)',
    },
  },
  {
    title: '하루종일 편안하게',
    subtitle: '린넨, 브라 탑 모음',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.35), rgba(7, 12, 20, 0.1)), url(https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80)',
    },
  },
  {
    title: '리빙의 리프레시',
    subtitle: '침실 쿠폰 10%',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.35), rgba(7, 12, 20, 0.1)), url(https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80)',
    },
  },
  {
    title: '편안한 일상을 위한',
    subtitle: '주방 소품 큐레이션',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.35), rgba(7, 12, 20, 0.1)), url(https://images.unsplash.com/photo-1583846783214-7229a91b20ed?auto=format&fit=crop&w=1200&q=80)',
    },
  },
]

const CATEGORY_TILES = [
  {
    title: '시티레저',
    subtitle: '가벼운 봄',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.45), rgba(7, 12, 20, 0.08)), url(https://picsum.photos/id/64/700/500)',
    },
  },
  {
    title: '홈 웰니스',
    subtitle: '스킨루틴',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.45), rgba(7, 12, 20, 0.08)), url(https://picsum.photos/id/838/700/500)',
    },
  },
  {
    title: '나를 위한',
    subtitle: '셀프 케어',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.45), rgba(7, 12, 20, 0.08)), url(https://picsum.photos/id/225/700/500)',
    },
  },
  {
    title: '금손 집',
    subtitle: '정리 노하우',
    style: {
      backgroundImage:
        'linear-gradient(0deg, rgba(7, 12, 20, 0.45), rgba(7, 12, 20, 0.08)), url(https://picsum.photos/id/1060/700/500)',
    },
  },
]

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

function MainPage({ onGoHome, onGoProducts, onGoProduct, onGoRegister, onGoLogin, onGoAdmin, onGoCart, onGoMyOrders }) {
  const MAIN_PREVIEW_COUNT = 4
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const [products, setProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [hasMoreProducts, setHasMoreProducts] = useState(false)
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
        return
      }
    }

    fetchMe()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function fetchMainProducts() {
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
          setHasMoreProducts(collectedProducts.length > MAIN_PREVIEW_COUNT)
        }
      } catch {
        if (isMounted) {
          setProducts([])
          setHasMoreProducts(false)
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false)
        }
      }
    }

    fetchMainProducts()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="mall-home">
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

      <section className="mall-hero" aria-label="메인 배너">
        <div className="mall-hero-inner">
          <p>고수의 큐레이션</p>
          <h2>MINIBEE 스러운 생활을 시작하세요</h2>
          <button type="button" onClick={userName ? onGoProducts : onGoRegister}>
            {userName ? '들어가기' : '신규 회원 혜택 보기'}
          </button>
        </div>
      </section>

      <section className="mall-feature-grid" aria-label="주요 기획전">
        {FEATURE_TILES.map((tile) => (
          <article
            key={tile.title}
            className="feature-tile"
            style={tile.style}
          >
            <h3>{tile.title}</h3>
            <p>{tile.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="mall-strip" aria-label="카테고리 큐레이션">
        {CATEGORY_TILES.map((tile) => (
          <article
            key={tile.title}
            className="strip-card"
            style={tile.style}
          >
            <h4>{tile.title}</h4>
            <p>{tile.subtitle}</p>
          </article>
        ))}
      </section>

      <section className="mall-products" aria-label="이 주의 신상">
        <div className="mall-products-head">
          <h2>이 주의 신상</h2>
          {hasMoreProducts ? (
            <button type="button" className="mall-more-btn" onClick={onGoProducts}>
              more+
            </button>
          ) : null}
        </div>
        {isLoadingProducts ? <p className="mall-products-message">상품을 불러오는 중입니다...</p> : null}
        {!isLoadingProducts && products.length === 0 ? <p className="mall-products-message">등록된 상품이 없습니다.</p> : null}
        {!isLoadingProducts && products.length > 0 ? (
          <div className="mall-product-grid">
            {products.slice(0, MAIN_PREVIEW_COUNT).map((item) => (
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

      <section className="mall-brand-story" aria-label="브랜드 스토리">
        <p>브랜드 스토리</p>
      </section>

    </div>
  )
}

export default MainPage
