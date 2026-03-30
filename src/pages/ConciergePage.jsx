import { useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import catalog from '../data/catalog.json'

const GROUPS = [
  {
    label: 'Concierge',
    grid: true,
    links: [
      { label: 'Wedders', path: '/wedders' },
      { label: 'Chains', path: '/chains' },
      { label: 'Rings', path: '/rings' },
      { label: 'Tennis', path: '/tennis' },
      { label: 'Bangles', path: '/bangles' },
      { label: 'Pendant Bar', path: '/pendant-bar' },
    ],
  },
  {
    label: null,
    links: [
      { label: 'Watches', path: '/watches' },
    ],
  },
]

const IMAGE_BASE = 'https://prod-sfcc-api.michaelhill.com/dw/image/v2/AANC_PRD/on/demandware.static/-/Sites-MHJ_Master/default/images'

// Build a flat list of all catalog items with category
const ALL_ITEMS = (() => {
  const items = []
  for (const [cat, products] of Object.entries(catalog)) {
    for (const p of products) {
      items.push({ ...p, category: cat })
    }
  }
  return items
})()

function NewItemsSection() {
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const items = ALL_ITEMS.filter(p => p.s && !p.s.startsWith('609') && !p.s.startsWith('400'))
    items.sort((a, b) => b.s.localeCompare(a.s))
    return items.slice(0, 50)
  }, [])

  return (
    <div className="concierge-group">
      <button
        className="concierge-collapse-btn"
        onClick={() => setOpen(!open)}
      >
        <span>{open ? '▾' : '▸'} New Items ({filtered.length})</span>
      </button>
      {open && (
        <div className="new-items-grid">
            {filtered.map((item) => (
              <div key={item.s} className="new-item-card">
                <div className="new-item-img-wrap">
                  {item.m ? (
                    <img
                      src={`${IMAGE_BASE}/${item.m.split('-')[0]}/${item.m}?sw=200&sm=fit&q=70`}
                      alt={item.n}
                      className="new-item-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="new-item-no-img">No image</div>
                  )}
                </div>
                <div className="new-item-info">
                  <span className="new-item-name">{item.n}</span>
                  <span className="new-item-sku">SKU: {item.s}</span>
                  <span className="new-item-cat">{item.category}</span>
                </div>
              </div>
            ))}
          </div>
      )}
    </div>
  )
}

function ConciergePage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  return (
    <div className="dev-page">
      <div className="dev-header">
        <button className="back-button" onClick={() => navigate('/dev')}>Dev</button>
        <h1>SKU Finder</h1>
      </div>

      {GROUPS.map((group, gi) => (
        <div key={gi} className="concierge-group">
          {group.label && <div className="concierge-group-label">{group.label}</div>}
          <div className={`dev-links${group.grid ? ' dev-links--grid' : ''}`}>
            {group.links.map((link) => (
              <button
                key={link.path}
                className="dev-link-btn"
                onClick={() => navigate(link.path)}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <NewItemsSection />

      {isAdmin && (
        <div className="concierge-group">
          <div className="dev-links">
            <button className="dev-link-btn" onClick={() => navigate('/find-by-photo')}>
              Find by Photo
            </button>
            <button className="dev-link-btn" onClick={() => navigate('/catalog-process')}>
              Catalog Processor
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConciergePage
