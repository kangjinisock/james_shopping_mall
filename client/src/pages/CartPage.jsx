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

function getCartItemKey(item, index) {
  return `${item?.productId || 'unknown'}-${item?.size || ''}-${item?.color || ''}-${index}`
}

function CartPage({ onGoHome, onGoLogin, onGoRegister, onGoAdmin, onGoCart, onGoOrder, onGoMyOrders }) {
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const [cart, setCart] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [updatingItemId, setUpdatingItemId] = useState('')
  const [removingItemId, setRemovingItemId] = useState('')
  const [selectedItemKeys, setSelectedItemKeys] = useState([])
  const [isDeletingSelected, setIsDeletingSelected] = useState(false)

  const userName = typeof currentUser?.name === 'string' ? currentUser.name : ''
  const isAdmin = typeof currentUser?.user_type === 'string' && currentUser.user_type.toLowerCase() === 'admin'

  const handleLogout = useCallback(() => {
    clearAuthStorage()
    setCurrentUser(null)
  }, [])

  const handleQuantityChange = useCallback(
    async (item, newQuantity) => {
      if (newQuantity < 1 || !cart) return

      try {
        setUpdatingItemId(String(item.productId))

        const updatedItems = cart.items.map((cartItem) =>
          cartItem.productId === item.productId &&
          cartItem.size === item.size &&
          cartItem.color === item.color
            ? { ...cartItem, quantity: newQuantity }
            : cartItem
        )

        const response = await fetch(`${API_BASE_URL}/carts/${cart._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: updatedItems }),
        })

        if (!response.ok) throw new Error('수량 변경 실패')

        setCart((prev) => ({
          ...prev,
          items: updatedItems,
          totalQuantity: updatedItems.reduce((sum, i) => sum + i.quantity, 0),
          totalAmount: updatedItems.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0),
        }))
      } catch (error) {
        alert('수량 변경 중 오류가 발생했습니다.')
      } finally {
        setUpdatingItemId('')
      }
    },
    [cart, API_BASE_URL]
  )

  const handleRemoveItem = useCallback(
    async (item) => {
      if (!cart) return

      try {
        setRemovingItemId(String(item.productId))

        const updatedItems = cart.items.filter(
          (cartItem) =>
            !(
              cartItem.productId === item.productId &&
              cartItem.size === item.size &&
              cartItem.color === item.color
            )
        )

        if (updatedItems.length === 0) {
          const deleteResponse = await fetch(`${API_BASE_URL}/carts/${cart._id}`, {
            method: 'DELETE',
          })
          if (!deleteResponse.ok) throw new Error('아이템 제거 실패')
          setCart(null)
        } else {
          const response = await fetch(`${API_BASE_URL}/carts/${cart._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: updatedItems }),
          })

          if (!response.ok) throw new Error('아이템 제거 실패')

          setCart((prev) => ({
            ...prev,
            items: updatedItems,
            totalQuantity: updatedItems.reduce((sum, i) => sum + i.quantity, 0),
            totalAmount: updatedItems.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0),
          }))
        }
      } catch (error) {
        alert('아이템 제거 중 오류가 발생했습니다.')
      } finally {
        setRemovingItemId('')
      }
    },
    [cart, API_BASE_URL]
  )

  const handleToggleItemSelection = useCallback((itemKey) => {
    setSelectedItemKeys((prev) => (
      prev.includes(itemKey) ? prev.filter((key) => key !== itemKey) : [...prev, itemKey]
    ))
  }, [])

  const handleDeleteSelectedItems = useCallback(async () => {
    if (!cart || selectedItemKeys.length === 0) {
      return
    }

    try {
      setIsDeletingSelected(true)
      const updatedItems = cart.items.filter(
        (item, index) => !selectedItemKeys.includes(getCartItemKey(item, index))
      )

      if (updatedItems.length === 0) {
        const deleteResponse = await fetch(`${API_BASE_URL}/carts/${cart._id}`, {
          method: 'DELETE',
        })

        if (!deleteResponse.ok) {
          throw new Error('선택한 아이템 삭제 실패')
        }

        setCart(null)
      } else {
        const response = await fetch(`${API_BASE_URL}/carts/${cart._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: updatedItems }),
        })

        if (!response.ok) {
          throw new Error('선택한 아이템 삭제 실패')
        }

        setCart((prev) => ({
          ...prev,
          items: updatedItems,
          totalQuantity: updatedItems.reduce((sum, i) => sum + i.quantity, 0),
          totalAmount: updatedItems.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0),
        }))
      }

      setSelectedItemKeys([])
    } catch {
      alert('선택한 아이템 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeletingSelected(false)
    }
  }, [cart, selectedItemKeys])

  useEffect(() => {
    let isMounted = true

    async function fetchMyCart() {
      try {
        setIsLoading(true)
        setErrorMessage('')

        const userId = typeof currentUser?._id === 'string' ? currentUser._id : ''
        if (!userId) {
          if (isMounted) {
            setCart(null)
            setIsLoading(false)
          }
          return
        }

        const response = await fetch(`${API_BASE_URL}/carts?userId=${encodeURIComponent(userId)}&status=active`)
        const contentType = response.headers.get('content-type') || ''
        const rawText = await response.text()
        const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

        if (!response.ok) {
          throw new Error(data?.message || '장바구니를 불러오지 못했습니다.')
        }

        const items = Array.isArray(data?.items) ? data.items : []
        if (isMounted) {
          setCart(items[0] || null)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || '장바구니 조회 중 오류가 발생했습니다.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchMyCart()

    return () => {
      isMounted = false
    }
  }, [currentUser?._id])

  const cartItems = Array.isArray(cart?.items) ? cart.items : []
  const cartItemKeys = cartItems.map((item, index) => getCartItemKey(item, index))
  const isAllSelected = cartItemKeys.length > 0 && cartItemKeys.length === selectedItemKeys.length

  useEffect(() => {
    setSelectedItemKeys((prev) => prev.filter((key) => cartItemKeys.includes(key)))
  }, [cartItemKeys.join('|')])

  const handleToggleSelectAll = useCallback(() => {
    setSelectedItemKeys((prev) => (prev.length === cartItemKeys.length ? [] : cartItemKeys))
  }, [cartItemKeys])

  return (
    <div className="mall-home" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

      <section className="cart-page-section" aria-label="장바구니" style={{ flex: 1 }}>
        <div className="cart-page-head">
          <h1>장바구니</h1>
          <p>담아둔 상품을 확인하고 주문을 진행하세요.</p>
        </div>

        {isLoading ? <p className="mall-products-message">장바구니를 불러오는 중입니다...</p> : null}
        {!isLoading && errorMessage ? <p className="mall-products-message">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && cartItems.length === 0 ? (
          <p className="mall-products-message">장바구니가 비어 있습니다.</p>
        ) : null}

        {!isLoading && !errorMessage && cartItems.length > 0 ? (
          <div className="cart-container">
            <div className="cart-items-section">
              <div className="cart-selection-toolbar">
                <label className="cart-select-all-label">
                  <input
                    type="checkbox"
                    className="cart-item-checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                  />
                  전체 선택 ({selectedItemKeys.length}/{cartItems.length})
                </label>
                <button
                  type="button"
                  className="cart-delete-selected-btn"
                  onClick={handleDeleteSelectedItems}
                  disabled={selectedItemKeys.length === 0 || isDeletingSelected}
                >
                  {isDeletingSelected ? '삭제 중...' : '선택 삭제'}
                </button>
              </div>

              {cartItems.map((item, index) => {
                const itemKey = getCartItemKey(item, index)

                return (
                <div key={itemKey} className="cart-item-row">
                  <label className="cart-item-checkbox-wrap" aria-label="상품 선택">
                    <input
                      type="checkbox"
                      className="cart-item-checkbox"
                      checked={selectedItemKeys.includes(itemKey)}
                      onChange={() => handleToggleItemSelection(itemKey)}
                    />
                  </label>
                  <div className="cart-item-image">
                    <img src={item.image} alt={item.name || '상품'} loading="lazy" />
                  </div>

                  <div className="cart-item-details">
                    <h3 className="cart-item-name">{item.name || '상품'}</h3>
                    <p className="cart-item-sku">SKU: {item.productId || '-'}</p>
                    {item.size && <p className="cart-item-option">사이즈: {item.size}</p>}
                    {item.color && <p className="cart-item-option">색상: {item.color}</p>}
                    <p className="cart-item-price">
                      {typeof item.unitPrice === 'number'
                        ? `₩${item.unitPrice.toLocaleString('ko-KR')}`
                        : '-'}
                    </p>
                  </div>

                  <div className="cart-item-quantity">
                    <button
                      type="button"
                      className="cart-qty-btn"
                      onClick={() => handleQuantityChange(item, item.quantity - 1)}
                      disabled={updatingItemId === String(item.productId) || item.quantity <= 1}
                      aria-label="수량 감소"
                    >
                      −
                    </button>
                    <span className="cart-qty-num">{item.quantity}</span>
                    <button
                      type="button"
                      className="cart-qty-btn"
                      onClick={() => handleQuantityChange(item, item.quantity + 1)}
                      disabled={updatingItemId === String(item.productId)}
                      aria-label="수량 증가"
                    >
                      +
                    </button>
                  </div>

                  <p className="cart-item-line-total">
                    {typeof item.unitPrice === 'number'
                      ? `₩${(item.unitPrice * item.quantity).toLocaleString('ko-KR')}`
                      : '-'}
                  </p>

                  <button
                    type="button"
                    className="cart-item-remove-btn"
                    onClick={() => handleRemoveItem(item)}
                    disabled={removingItemId === String(item.productId)}
                    aria-label="상품 제거"
                  >
                    {removingItemId === String(item.productId) ? '제거 중...' : '취소'}
                  </button>
                </div>
                )
              })}
            </div>

            <div className="cart-summary-section">
              <div className="cart-summary-box">
                <h2>주문 요약</h2>

                <div className="cart-summary-row">
                  <span>상품 금액</span>
                  <span className="cart-summary-value">
                    ₩{typeof cart?.totalAmount === 'number'
                      ? cart.totalAmount.toLocaleString('ko-KR')
                      : '0'}
                  </span>
                </div>

                <div className="cart-summary-row">
                  <span>배송비</span>
                  <span className="cart-summary-value" style={{ color: '#0f766e' }}>무료</span>
                </div>

                <div className="cart-summary-divider" />

                <div className="cart-summary-row cart-summary-total-row">
                  <span>총 결제금액</span>
                  <span className="cart-summary-total-value">
                    ₩{typeof cart?.totalAmount === 'number'
                      ? cart.totalAmount.toLocaleString('ko-KR')
                      : '0'}
                  </span>
                </div>

                <button type="button" className="cart-checkout-btn" onClick={() => onGoOrder(cart, currentUser)}>
                  결제하러 가기
                </button>
                <button type="button" className="cart-continue-btn" onClick={onGoHome}>
                  계속 쇼핑하기
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>


    </div>
  )
}

export default CartPage
