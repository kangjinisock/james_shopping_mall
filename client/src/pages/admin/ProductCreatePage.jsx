import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:5000')

const CLOUDINARY_WIDGET_SCRIPT_URL = 'https://widget.cloudinary.com/v2.0/global/all.js'
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''
const CLOUDINARY_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER || 'products'

const CATEGORY_OPTIONS = ['내장재', '외장재', '마감재', '기타 악세사리']

const EMPTY_PRODUCT_FORM = {
  sku: '',
  name: '',
  price: '',
  category: CATEGORY_OPTIONS[0],
  image: '',
  description: '',
}

function getInitialFormData(product) {
  if (!product || typeof product !== 'object') {
    return EMPTY_PRODUCT_FORM
  }

  return {
    sku: typeof product.sku === 'string' ? product.sku : '',
    name: typeof product.name === 'string' ? product.name : '',
    price: product.price === undefined || product.price === null ? '' : String(product.price),
    category: CATEGORY_OPTIONS.includes(product.category) ? product.category : CATEGORY_OPTIONS[0],
    image: typeof product.image === 'string' ? product.image : '',
    description: typeof product.description === 'string' ? product.description : '',
  }
}

function ProductCreatePage({ onBackToProducts, onCreated, onUpdated, initialProduct }) {
  const isEditMode = Boolean(initialProduct?._id)
  const [formData, setFormData] = useState(() => getInitialFormData(initialProduct))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' })
  const [isWidgetReady, setIsWidgetReady] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  useEffect(() => {
    setFormData(getInitialFormData(initialProduct))
    setSubmitMessage({ type: '', text: '' })
    setUploadMessage('')
  }, [initialProduct])

  useEffect(() => {
    if (window.cloudinary?.createUploadWidget) {
      setIsWidgetReady(true)
      return
    }

    const script = document.createElement('script')
    script.src = CLOUDINARY_WIDGET_SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.cloudinary?.createUploadWidget) {
        setIsWidgetReady(true)
      }
    }

    document.body.appendChild(script)
  }, [])

  function handleFormChange(event) {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  function handleOpenCloudinaryWidget() {
    setUploadMessage('')

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      setUploadMessage('Cloudinary 설정(VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET)이 필요합니다.')
      return
    }

    if (!window.cloudinary?.createUploadWidget) {
      setUploadMessage('Cloudinary 위젯이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.')
      return
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        sources: ['local', 'url', 'camera'],
        multiple: false,
        maxFiles: 1,
        folder: CLOUDINARY_FOLDER,
        resourceType: 'image',
      },
      (error, result) => {
        if (error) {
          const detail = error?.message || error?.statusText || error?.status || '알 수 없는 오류'
          setUploadMessage(`이미지 업로드 오류: ${detail}`)
          return
        }

        if (result?.event === 'success' && result.info?.secure_url) {
          setFormData((prev) => ({ ...prev, image: result.info.secure_url }))
          setUploadMessage('이미지가 업로드되었습니다.')
        }
      }
    )

    widget.open()
  }

  async function handleCreateProduct(event) {
    event.preventDefault()
    setSubmitMessage({ type: '', text: '' })

    if (!formData.sku.trim() || !formData.name.trim() || !formData.price || !formData.category || !formData.image.trim()) {
      setSubmitMessage({ type: 'error', text: '필수 항목을 모두 입력해 주세요.' })
      return
    }

    try {
      setIsSubmitting(true)

      const endpoint = isEditMode
        ? `${API_BASE_URL}/products/${initialProduct._id}`
        : `${API_BASE_URL}/products`
      const method = isEditMode ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku: formData.sku.trim(),
          name: formData.name.trim(),
          price: Number(formData.price),
          category: formData.category,
          image: formData.image.trim(),
          description: formData.description.trim(),
        }),
      })

      const contentType = response.headers.get('content-type') || ''
      const rawText = await response.text()
      const data = contentType.includes('application/json') && rawText ? JSON.parse(rawText) : null

      if (!response.ok) {
        throw new Error(data?.message || (isEditMode ? '상품 수정에 실패했습니다.' : '상품 등록에 실패했습니다.'))
      }

      setSubmitMessage({ type: 'success', text: isEditMode ? '상품이 수정되었습니다.' : '상품이 등록되었습니다.' })
      if (!isEditMode) {
        setFormData(EMPTY_PRODUCT_FORM)
      }

      if (isEditMode && typeof onUpdated === 'function') {
        onUpdated()
      }
      if (!isEditMode && typeof onCreated === 'function') {
        onCreated()
      }

      if (typeof onBackToProducts === 'function') {
        onBackToProducts()
      }
    } catch (error) {
      setSubmitMessage({ type: 'error', text: error.message || (isEditMode ? '상품 수정 중 오류가 발생했습니다.' : '상품 등록 중 오류가 발생했습니다.') })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="admin-header-row">
        <div>
          <h2 className="admin-title">{isEditMode ? '상품 수정' : '상품 등록'}</h2>
          <p className="admin-subtitle">
            {isEditMode
              ? '기존 상품 정보를 수정하고 저장하세요.'
              : '새 상품 정보를 입력하고 관리자 상품 목록에 추가하세요.'}
          </p>
        </div>

        <button type="button" className="admin-secondary-button" onClick={onBackToProducts}>
          상품 관리로 돌아가기
        </button>
      </div>

      <section className="admin-section admin-form-section">
        <form className="admin-product-form" onSubmit={handleCreateProduct}>
          <label>
            SKU
            <input name="sku" value={formData.sku} onChange={handleFormChange} placeholder="MINI-001" required />
          </label>

          <label>
            상품 이름
            <input name="name" value={formData.name} onChange={handleFormChange} placeholder="상품명을 입력하세요" required />
          </label>

          <label>
            상품 가격
            <input
              name="price"
              type="number"
              min="0"
              value={formData.price}
              onChange={handleFormChange}
              placeholder="0"
              required
            />
          </label>

          <label>
            카테고리
            <select name="category" value={formData.category} onChange={handleFormChange}>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="admin-form-full">
            이미지 업로드
            <div className="admin-image-upload-row">
              <input
                name="image"
                value={formData.image}
                onChange={handleFormChange}
                placeholder="Cloudinary 업로드 후 자동 입력됩니다"
                required
              />
              <button
                type="button"
                className="admin-secondary-button"
                onClick={handleOpenCloudinaryWidget}
                disabled={!isWidgetReady}
              >
                Cloudinary 업로드
              </button>
            </div>
            {uploadMessage ? <span className="admin-upload-hint">{uploadMessage}</span> : null}
          </label>

          <div className="admin-form-full">
            {formData.image ? (
              <div className="admin-image-preview">
                <img src={formData.image} alt="업로드 이미지 미리보기" loading="lazy" />
              </div>
            ) : (
              <div className="admin-image-preview-empty">이미지를 업로드하면 미리보기가 표시됩니다.</div>
            )}
          </div>

          <label className="admin-form-full">
            설명
            <textarea
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              placeholder="상품 설명을 입력하세요"
              rows="5"
            />
          </label>

          <div className="admin-form-actions admin-form-full">
            <button type="submit" className="admin-primary-button" disabled={isSubmitting}>
              {isSubmitting ? (isEditMode ? '수정 중...' : '등록 중...') : (isEditMode ? '상품 수정하기' : '상품 등록하기')}
            </button>
          </div>
        </form>

        {submitMessage.text ? (
          <p className={`admin-feedback ${submitMessage.type === 'success' ? 'success' : 'error'}`}>
            {submitMessage.text}
          </p>
        ) : null}
      </section>
    </>
  )
}

export default ProductCreatePage
