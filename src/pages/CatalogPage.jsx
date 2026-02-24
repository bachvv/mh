import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import catalog from '../data/catalog.json'

const IMAGE_BASE = 'https://prod-sfcc-api.michaelhill.com/dw/image/v2/AANC_PRD/on/demandware.static/-/Sites-MHJ_Master/default/images'

function getImageUrl(pSku, filename, width = 600) {
  return `${IMAGE_BASE}/${pSku}/${filename}?sw=${width}&sm=fit&q=80`
}

function CatalogPage({ title, categories, backLabel = 'SKU Finder', backPath = '/findsku' }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedSku, setSelectedSku] = useState(null)
  const [imageIdx, setImageIdx] = useState(0)

  // Merge products from all specified categories
  const products = useMemo(() => {
    const items = []
    for (const cat of categories) {
      if (catalog[cat]) {
        for (const p of catalog[cat]) {
          items.push({ ...p, category: cat })
        }
      }
    }
    return items
  }, [categories])

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.trim().toLowerCase()
    return products.filter(p =>
      p.n.toLowerCase().includes(q) ||
      p.s.includes(q) ||
      p.p.toLowerCase().includes(q)
    )
  }, [products, search])

  const selectedProduct = selectedSku
    ? products.find(p => p.s === selectedSku)
    : null

  function handleSelect(sku) {
    setSelectedSku(sku === selectedSku ? null : sku)
    setImageIdx(0)
  }

  return (
    <div className="catalog-page">
      <div className="page-header">
        <button className="back-button" onClick={() => navigate(backPath)}>{backLabel}</button>
        <h1>{title}</h1>
      </div>

      <div className="catalog-search">
        <input
          className="catalog-search-input"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${products.length} products by name or SKU...`}
        />
        {search && (
          <button className="catalog-search-clear" onClick={() => setSearch('')}>&times;</button>
        )}
      </div>

      <div className="catalog-count">{filtered.length} products</div>

      {/* Detail view */}
      {selectedProduct && (
        <div className="catalog-detail">
          <div className="catalog-detail-images">
            <img
              src={getImageUrl(selectedProduct.p, selectedProduct.i[imageIdx])}
              alt={selectedProduct.n}
              className="catalog-detail-main-img"
            />
            {selectedProduct.i.length > 1 && (
              <div className="catalog-detail-thumbs">
                {selectedProduct.i.map((img, idx) => (
                  <img
                    key={img}
                    src={getImageUrl(selectedProduct.p, img, 150)}
                    alt=""
                    className={`catalog-detail-thumb${idx === imageIdx ? ' catalog-detail-thumb--active' : ''}`}
                    onClick={() => setImageIdx(idx)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="catalog-detail-info">
            <div className="catalog-detail-name">{selectedProduct.n}</div>
            <div className="catalog-detail-sku">SKU: {selectedProduct.s}</div>
            <div className="catalog-detail-sku">P Number: {selectedProduct.p}</div>
            {categories.length > 1 && (
              <div className="catalog-detail-sku">Category: {selectedProduct.category}</div>
            )}
            <button className="catalog-detail-close" onClick={() => setSelectedSku(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Product grid */}
      <div className="catalog-grid">
        {filtered.map((p) => (
          <button
            key={p.s}
            className={`catalog-card${p.s === selectedSku ? ' catalog-card--active' : ''}`}
            onClick={() => handleSelect(p.s)}
          >
            <div className="catalog-card-img-wrap">
              <img
                src={getImageUrl(p.p, p.m, 400)}
                alt={p.n}
                className="catalog-card-img"
                loading="lazy"
              />
            </div>
            <div className="catalog-card-info">
              <span className="catalog-card-name">{p.n}</span>
              <span className="catalog-card-sku">{p.s}</span>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="fbp-empty">No products match your search.</div>
      )}
    </div>
  )
}

// Pre-configured pages
export function ChainsPage() {
  return <CatalogPage title="Chains" categories={['Chains']} />
}

export function TennisPage() {
  return <CatalogPage title="Tennis" categories={['Bracelets-Bangles', 'Pendants-Necklaces']} />
}

export function RingsPage() {
  return <CatalogPage title="Rings" categories={['Rings']} />
}

export default CatalogPage
