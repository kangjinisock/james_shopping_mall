import { useCallback, useEffect, useState } from 'react'
import Navbar from './Navbar'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')

const AUTH_STORAGE_KEYS = ['accessToken', 'tokenType', 'currentUser', 'tokenExpiresIn', 'loginAt']

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key)
  })
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

const MOCK_REVIEWS = [
  {
    id: 1,
    name: '김민지',
    rating: 5,
    date: '2026.03.20',
    content: '원단이 정말 부드럽고 착용감이 너무 좋아요! 사이즈도 딱 맞고 색상도 사진이랑 똑같아서 만족합니다.',
    tag: '사이즈: M / 색상: 블루',
  },
  {
    id: 2,
    name: '이수연',
    rating: 5,
    date: '2026.03.15',
    content: '재구매 했습니다. 품질이 좋고 가격도 합리적이에요. 배송도 빠르고 포장도 꼼꼼하게 해주셨어요.',
    tag: '사이즈: S / 색상: 블랙',
  },
  {
    id: 3,
    name: '박서현',
    rating: 4,
    date: '2026.03.10',
    content: '디자인은 예쁜데 세탁 후 약간 줄었어요. 한 사이즈 크게 구매하시는 걸 추천드립니다.',
    tag: '사이즈: L / 색상: 라이트블루',
  },
  {
    id: 4,
    name: '정다은',
    rating: 5,
    date: '2026.02.28',
    content: '입어보니 훨씬 예쁘네요! 주변 친구들도 어디서 샀냐고 물어봐요. 강추합니다!',
    tag: '사이즈: M / 색상: 블루',
  },
]

function ProductDetailPage({ productId, onGoBack, onGoHome, onGoLogin, onGoRegister, onGoAdmin, onGoCart, onGoOrder, onGoMyOrders }) {
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedSize, setSelectedSize] = useState('M')
  const [selectedColor, setSelectedColor] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedThumb, setSelectedThumb] = useState(0)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [addToCartMessage, setAddToCartMessage] = useState({ type: '', text: '' })
  const [activeInfoTab, setActiveInfoTab] = useState('reviews')

  const SIZES = ['XS', 'S', 'M', 'L', 'XL']
  const COLORS = [
    { name: '블루', hex: '#6ba3d6' },
    { name: '블랙', hex: '#1a1a1a' },
    { name: '라이트블루', hex: '#a8c8e8' },
  ]
  const STOCK_LIMIT = 5

  const userName = typeof currentUser?.name === 'string' ? currentUser.name : ''
  const isAdmin = typeof currentUser?.user_type === 'string' && currentUser.user_type.toLowerCase() === 'admin'

  const handleLogout = useCallback(() => {
    clearAuthStorage()
    setCurrentUser(null)
  }, [])

  const handleAddToCart = useCallback(async () => {
    setAddToCartMessage({ type: '', text: '' })

    // 로그인 확인
    if (!currentUser || !currentUser._id) {
      setAddToCartMessage({ type: 'error', text: '로그인이 필요합니다.' })
      setTimeout(() => {
        onGoLogin()
      }, 1000)
      return
    }

    if (!product || !product._id) {
      setAddToCartMessage({ type: 'error', text: '상품 정보를 불러올 수 없습니다.' })
      return
    }

    try {
      setIsAddingToCart(true)

      // 현재 활성 장바구니 조회
      const cartsResponse = await fetch(
        `${API_BASE_URL}/carts?userId=${encodeURIComponent(currentUser._id)}&status=active`
      )
      const cartsData = await cartsResponse.json()
      const existingCart = Array.isArray(cartsData?.items) && cartsData.items.length > 0
        ? cartsData.items[0]
        : null

      const newCartItem = {
        productId: product._id,
        quantity: quantity,
        unitPrice: product.price,
        name: product.name,
        image: product.image,
        size: selectedSize,
        color: COLORS[selectedColor].name,
      }

      let response

      if (existingCart) {
        // 기존 장바구니가 있으면 아이템 추가/업데이트
        const existingItemIndex = existingCart.items.findIndex(
          (item) => item.productId === product._id && item.size === selectedSize && item.color === COLORS[selectedColor].name
        )

        let updatedItems
        if (existingItemIndex >= 0) {
          // 같은 상품, 사이즈, 색상이 있으면 수량만 증가
          updatedItems = existingCart.items.map((item, idx) =>
            idx === existingItemIndex
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        } else {
          // 새로운 상품/옵션 조합이면 배열에 추가
          updatedItems = [...existingCart.items, newCartItem]
        }

        response = await fetch(`${API_BASE_URL}/carts/${existingCart._id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items: updatedItems }),
        })
      } else {
        // 새로운 장바구니 생성
        response = await fetch(`${API_BASE_URL}/carts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: currentUser._id,
            items: [newCartItem],
            status: 'active',
          }),
        })
      }

      const contentType = response.headers.get('content-type') || ''
      const rawText = await response.text()
      const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

      if (!response.ok) {
        throw new Error(data?.message || '장바구니에 담기에 실패했습니다.')
      }

      // 성공 메시지
      const itemCountText = `${product.name} (수량: ${quantity})`
      setAddToCartMessage({
        type: 'success',
        text: `${itemCountText}을(를) 장바구니에 담았습니다.`,
      })

      // 선택 옵션 초기화
      setQuantity(1)

      // 2초 후 자동으로 메시지 사라짐
      setTimeout(() => {
        setAddToCartMessage({ type: '', text: '' })
      }, 2000)
    } catch (err) {
      setAddToCartMessage({
        type: 'error',
        text: err.message || '장바구니에 담기 중 오류가 발생했습니다.',
      })
    } finally {
      setIsAddingToCart(false)
    }
  }, [currentUser, product, quantity, selectedSize, selectedColor, onGoLogin, COLORS, API_BASE_URL])

  const handleBuyNow = useCallback(() => {
    setAddToCartMessage({ type: '', text: '' })

    if (!currentUser || !currentUser._id) {
      setAddToCartMessage({ type: 'error', text: '로그인이 필요합니다.' })
      setTimeout(() => {
        onGoLogin()
      }, 1000)
      return
    }

    if (!product || !product._id || typeof product.price !== 'number') {
      setAddToCartMessage({ type: 'error', text: '상품 정보를 불러올 수 없습니다.' })
      return
    }

    onGoOrder({
      items: [
        {
          productId: product._id,
          quantity,
          unitPrice: product.price,
          name: product.name,
          image: product.image,
          size: selectedSize,
          color: COLORS[selectedColor].name,
        },
      ],
      totalAmount: product.price * quantity,
      user: currentUser,
    })
  }, [currentUser, product, quantity, selectedSize, selectedColor, onGoLogin, onGoOrder, COLORS])

  useEffect(() => {
    let isMounted = true

    async function fetchProduct() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`${API_BASE_URL}/products/${productId}`)
        const contentType = response.headers.get('content-type') || ''
        const rawText = await response.text()
        const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

        if (!response.ok) {
          throw new Error(data?.message || '상품 정보를 불러오지 못했습니다.')
        }

        if (isMounted) {
          setProduct(data)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || '상품 정보를 불러오지 못했습니다.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchProduct()

    return () => {
      isMounted = false
    }
  }, [productId])

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

      <section className="product-detail-section">
        <button type="button" className="mall-more-btn product-detail-back-btn" onClick={onGoBack}>
          ← 뒤로가기
        </button>

        {isLoading && <p className="mall-products-message">상품 정보를 불러오는 중입니다...</p>}
        {error && <p className="mall-products-message">{error}</p>}

        {!isLoading && !error && product && (
          <div className="product-detail-card">
            <div className="product-detail-image-col">
              <div className="product-detail-image-wrap">
                <img
                  src={
                    selectedThumb === 0
                      ? product.image
                      : `https://picsum.photos/seed/${productId}-${selectedThumb}/600/600`
                  }
                  alt={product.name}
                />
              </div>
              <div className="product-detail-thumbs">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`product-detail-thumb-btn${selectedThumb === idx ? ' active' : ''}`}
                    onClick={() => setSelectedThumb(idx)}
                    aria-label={`상품 이미지 ${idx + 1}`}
                  >
                    <img
                      src={
                        idx === 0
                          ? product.image
                          : `https://picsum.photos/seed/${productId}-${idx}/120/120`
                      }
                      alt={`상품 이미지 ${idx + 1}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="product-detail-info">
              {product.category && (
                <p className="product-detail-category">{product.category}</p>
              )}
              <h1 className="product-detail-name">{product.name}</h1>

              {/* 별점 */}
              <div className="product-detail-rating">
                <span className="product-detail-star">★</span>
                <span className="product-detail-rating-score">4.8</span>
                <span className="product-detail-rating-count">(124 reviews)</span>
              </div>

              {/* 가격 */}
              <div className="product-detail-price-row">
                <span className="product-detail-price">
                  {typeof product.price === 'number'
                    ? `₩${product.price.toLocaleString('ko-KR')}`
                    : '-'}
                </span>
                {typeof product.price === 'number' && (
                  <>
                    <span className="product-detail-original-price">
                      ₩{Math.round(product.price / 0.74 / 100) * 100 > product.price
                        ? (Math.round(product.price / 0.74 / 100) * 100).toLocaleString('ko-KR')
                        : Math.round(product.price * 1.35 / 100) * 100 > product.price
                          ? (Math.round(product.price * 1.35 / 100) * 100).toLocaleString('ko-KR')
                          : (product.price + 10000).toLocaleString('ko-KR')}
                    </span>
                    <span className="product-detail-discount-badge">26% OFF</span>
                  </>
                )}
              </div>

              {/* 사이즈 */}
              <div className="product-detail-option-group">
                <p className="product-detail-option-label">Size</p>
                <div className="product-detail-size-row">
                  {SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`product-detail-size-btn${selectedSize === size ? ' active' : ''}`}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* 컬러 */}
              <div className="product-detail-option-group">
                <p className="product-detail-option-label">Color:</p>
                <div className="product-detail-color-row">
                  {COLORS.map((color, idx) => (
                    <button
                      key={color.name}
                      type="button"
                      aria-label={color.name}
                      className={`product-detail-color-btn${selectedColor === idx ? ' active' : ''}`}
                      style={{ background: color.hex }}
                      onClick={() => setSelectedColor(idx)}
                    />
                  ))}
                </div>
              </div>

              {/* 수량 */}
              <div className="product-detail-option-group">
                <p className="product-detail-option-label">Quantity</p>
                <div className="product-detail-qty-row">
                  <div className="product-detail-qty-ctrl">
                    <button
                      type="button"
                      className="product-detail-qty-btn"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    >
                      −
                    </button>
                    <span className="product-detail-qty-num">{quantity}</span>
                    <button
                      type="button"
                      className="product-detail-qty-btn"
                      onClick={() => setQuantity((q) => Math.min(STOCK_LIMIT, q + 1))}
                    >
                      +
                    </button>
                  </div>
                  <span className="product-detail-stock">재고 {STOCK_LIMIT}개 남음</span>
                  {typeof product.price === 'number' && (
                    <span className="product-detail-total-price">
                      총 ₩{(product.price * quantity).toLocaleString('ko-KR')}
                    </span>
                  )}
                </div>
              </div>

              <div className="product-detail-btn-group">
                <button
                  type="button"
                  className="product-detail-buy-btn"
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                >
                  {isAddingToCart ? '추가 중...' : '장바구니 담기'}
                </button>
                <button type="button" className="product-detail-now-btn" onClick={handleBuyNow}>
                  바로 구매
                </button>
              </div>

              {addToCartMessage.text && (
                <p className={`product-detail-message${addToCartMessage.type === 'success' ? ' success' : ' error'}`}>
                  {addToCartMessage.text}
                </p>
              )}
            </div>
          </div>
        )}

        {!isLoading && !error && product && (
          <div className="product-detail-desc-with-review">
            <div className="product-detail-desc-section">
              <hr className="product-detail-divider" />
              <div className="product-detail-desc-heading">
                <h2 className="product-detail-desc-title">상품 상세 설명</h2>
                <div className="product-detail-review-inline" aria-label="리뷰 요약">
                  <span className="product-detail-review-score">4.8</span>
                  <span className="product-detail-review-stars">★★★★★</span>
                  <span className="product-detail-review-count">{MOCK_REVIEWS.length}개 리뷰</span>
                </div>
              </div>
              <div className="product-detail-desc-body">
                {product.description ? (
                  <p>{product.description}</p>
                ) : (
                  <p className="product-detail-desc-empty">등록된 상세 설명이 없습니다.</p>
                )}
                <div className="product-detail-desc-images">
                  {[1, 2, 3].map((n) => (
                    <img
                      key={n}
                      src={`https://picsum.photos/seed/${productId}-desc-${n}/900/500`}
                      alt={`상품 상세 이미지 ${n}`}
                      className="product-detail-desc-img"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {!isLoading && !error && product && (
          <div className="product-detail-tabs-section">
            <div className="product-detail-tabs-nav">
              <button
                type="button"
                className={`product-detail-tab-btn${activeInfoTab === 'reviews' ? ' active' : ''}`}
                onClick={() => setActiveInfoTab('reviews')}
              >
                리뷰 ({MOCK_REVIEWS.length})
              </button>
              <button
                type="button"
                className={`product-detail-tab-btn${activeInfoTab === 'shipping' ? ' active' : ''}`}
                onClick={() => setActiveInfoTab('shipping')}
              >
                배송 및 반품 정보
              </button>
            </div>

            {activeInfoTab === 'reviews' && (
              <div className="product-reviews-panel">
                <div className="review-summary">
                  <div className="review-avg-block">
                    <span className="review-avg-score">4.8</span>
                    <div className="review-avg-stars">★★★★★</div>
                    <span className="review-avg-label">{MOCK_REVIEWS.length}개 리뷰</span>
                  </div>
                  <div className="review-breakdown">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = MOCK_REVIEWS.filter((r) => r.rating === star).length
                      const pct = MOCK_REVIEWS.length > 0 ? Math.round((count / MOCK_REVIEWS.length) * 100) : 0
                      return (
                        <div key={star} className="review-breakdown-row">
                          <span className="review-star-label">{star}★</span>
                          <div className="review-bar-track">
                            <div className="review-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="review-bar-count">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="review-list">
                  {MOCK_REVIEWS.map((review) => (
                    <div key={review.id} className="review-card">
                      <div className="review-card-header">
                        <div className="review-card-left">
                          <span className="review-card-name">{review.name}</span>
                          <span className="review-card-stars">
                            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                          </span>
                        </div>
                        <span className="review-card-date">{review.date}</span>
                      </div>
                      <p className="review-card-content">{review.content}</p>
                      {review.tag && <span className="review-card-tag">{review.tag}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeInfoTab === 'shipping' && (
              <div className="product-shipping-panel">
                <div className="shipping-info-block">
                  <h3 className="shipping-info-title">🚚 배송 안내</h3>
                  <ul className="shipping-info-list">
                    <li>기본 배송비: <strong>무료</strong> (50,000원 이상 구매 시)</li>
                    <li>50,000원 미만 구매 시 배송비 <strong>3,000원</strong></li>
                    <li>출고 소요일: 결제 완료 후 <strong>1~3일 이내</strong> 출고</li>
                    <li>배송 기간: 출고 후 <strong>2~3 영업일</strong> 내 도착 예정</li>
                    <li>제주 및 도서산간 지역은 추가 배송비가 발생할 수 있습니다.</li>
                  </ul>
                </div>
                <div className="shipping-info-block">
                  <h3 className="shipping-info-title">🔄 교환 및 반품 안내</h3>
                  <ul className="shipping-info-list">
                    <li>교환/반품 신청: 상품 수령 후 <strong>7일 이내</strong></li>
                    <li>단순 변심에 의한 교환/반품 시 왕복 배송비 고객 부담</li>
                    <li>상품 불량 또는 오배송의 경우 배송비 <strong>브랜드 부담</strong></li>
                    <li>착용 흔적, 세탁, 상품 훼손 시 교환/반품 불가</li>
                    <li>일부 상품(속옷, 수영복 등 위생 관련)은 교환/반품 불가</li>
                  </ul>
                </div>
                <div className="shipping-info-block">
                  <h3 className="shipping-info-title">📞 고객센터</h3>
                  <ul className="shipping-info-list">
                    <li>운영시간: 평일 10:00 ~ 17:00 (토·일·공휴일 휴무)</li>
                    <li>점심시간: 12:00 ~ 13:00</li>
                    <li>이메일 문의: <strong>cs@minibee.kr</strong></li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  )
}

export default ProductDetailPage
