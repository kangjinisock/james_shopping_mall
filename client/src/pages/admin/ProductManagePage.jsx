import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')

function formatPrice(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return `${value.toLocaleString('ko-KR')}원`
}

function ProductManagePage({ onGoCreateProduct, onGoEditProduct }) {
  const [products, setProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [productError, setProductError] = useState('')
  const [deletingProductId, setDeletingProductId] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 5,
    totalItems: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function fetchProducts() {
      try {
        setIsLoadingProducts(true)
        setProductError('')

        const query = new URLSearchParams({
          page: String(currentPage),
        })

        if (searchKeyword.trim()) {
          query.set('search', searchKeyword.trim())
        }

        const response = await fetch(`${API_BASE_URL}/products?${query.toString()}`)
        const contentType = response.headers.get('content-type') || ''
        const rawText = await response.text()
        const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

        if (!response.ok) {
          throw new Error(data?.message || '상품 목록을 불러오지 못했습니다.')
        }

        if (isMounted) {
          setProducts(Array.isArray(data?.items) ? data.items : [])
          setPagination({
            page: Number(data?.pagination?.page) || currentPage,
            pageSize: Number(data?.pagination?.pageSize) || 5,
            totalItems: Number(data?.pagination?.totalItems) || 0,
            totalPages: Number(data?.pagination?.totalPages) || 1,
            hasPreviousPage: Boolean(data?.pagination?.hasPreviousPage),
            hasNextPage: Boolean(data?.pagination?.hasNextPage),
          })
        }
      } catch (error) {
        if (isMounted) {
          setProductError(error.message || '상품 목록 조회 중 오류가 발생했습니다.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false)
        }
      }
    }

    fetchProducts()

    return () => {
      isMounted = false
    }
  }, [currentPage, reloadToken, searchKeyword])

  async function handleDeleteProduct(product) {
    const productId = typeof product?._id === 'string' ? product._id : ''
    if (!productId) {
      setProductError('삭제할 상품 id를 확인할 수 없습니다.')
      return
    }

    const confirmDelete = window.confirm(`${product.name || '이 상품'}을(를) 삭제할까요?`)
    if (!confirmDelete) {
      return
    }

    try {
      setDeletingProductId(productId)
      setProductError('')

      const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
        method: 'DELETE',
      })

      const contentType = response.headers.get('content-type') || ''
      const rawText = await response.text()
      const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

      if (!response.ok) {
        throw new Error(data?.message || '상품 삭제에 실패했습니다.')
      }

      if (products.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => Math.max(prev - 1, 1))
      } else {
        setReloadToken((prev) => prev + 1)
      }
    } catch (error) {
      setProductError(error.message || '상품 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingProductId('')
    }
  }

  const pageNumbers = Array.from({ length: pagination.totalPages }, (_, index) => index + 1)

  return (
    <>
      <div className="admin-header-row">
        <div>
          <h2 className="admin-title">상품 관리</h2>
          <p className="admin-subtitle">등록된 상품을 확인하고 새 상품을 추가하세요.</p>
        </div>

        <button type="button" className="admin-primary-button" onClick={onGoCreateProduct}>
          새 상품 등록
        </button>
      </div>

      <section className="admin-section">
        <div className="admin-section-topbar">
          <h3 className="admin-section-title">상품 목록</h3>

          <label className="admin-search-box admin-search-box-inline" htmlFor="product-search">
            <span>상품명으로 찾기</span>
            <div className="admin-search-input-wrap">
              <span className="admin-search-icon" aria-hidden="true">⌕</span>
              <input
                id="product-search"
                type="search"
                value={searchKeyword}
                  onChange={(event) => {
                    setSearchKeyword(event.target.value)
                    setCurrentPage(1)
                  }}
                placeholder="상품명을 입력하세요"
              />
            </div>
          </label>
        </div>

        {isLoadingProducts ? <p className="admin-empty-message">상품 목록을 불러오는 중입니다...</p> : null}
        {productError ? <p className="admin-error-message">{productError}</p> : null}
        {!isLoadingProducts && !productError && products.length === 0 ? (
          <p className="admin-empty-message">등록된 상품이 없습니다. 새 상품을 등록해 주세요.</p>
        ) : null}
        {!isLoadingProducts && !productError && products.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>이미지</th>
                  <th>상품명</th>
                  <th>가격</th>
                  <th>카테고리</th>
                  <th>설명</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id || product.sku}>
                    <td className="admin-order-id">{product.sku}</td>
                    <td>
                      {product.image ? (
                        <div className="admin-product-thumb">
                          <img src={product.image} alt={product.name || product.sku} loading="lazy" />
                        </div>
                      ) : (
                        <div className="admin-product-thumb admin-product-thumb-empty">No image</div>
                      )}
                    </td>
                    <td>{product.name}</td>
                    <td>{formatPrice(product.price)}</td>
                    <td>{product.category}</td>
                    <td>{product.description || '-'}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-row-action-button"
                          onClick={() => onGoEditProduct(product)}
                        >
                          수정하기
                        </button>
                        <button
                          type="button"
                          className="admin-row-action-button danger"
                          onClick={() => handleDeleteProduct(product)}
                          disabled={deletingProductId === product._id}
                        >
                          {deletingProductId === product._id ? '삭제 중...' : '삭제하기'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoadingProducts && !productError && pagination.totalPages > 1 ? (
          <div className="admin-pagination">
            <button
              type="button"
              className="admin-pagination-button"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            >
              이전
            </button>

            <div className="admin-pagination-pages">
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`admin-pagination-button${pageNumber === currentPage ? ' active' : ''}`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="admin-pagination-button"
              disabled={!pagination.hasNextPage}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages))}
            >
              다음
            </button>
          </div>
        ) : null}
      </section>
    </>
  )
}

export default ProductManagePage
