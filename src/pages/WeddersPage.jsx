import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { wedderCategories } from '../data/wedders'

function CategoryCard({ category, onSelect }) {
  return (
    <div className="wedder-category-card" onClick={() => onSelect(category)}>
      <div className="wedder-category-img-wrap">
        <img
          src={category.image}
          alt={category.name}
          className="wedder-category-img"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
          }}
        />
        <div className="wedder-category-img-placeholder" style={{ display: 'none' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
      </div>
      <div className="wedder-category-name">{category.name}</div>
    </div>
  )
}

function PNumberFinder({ category, onBack }) {
  const [selections, setSelections] = useState({})

  const allSelected = category.choices.every((c) => selections[c.id])

  const pKey = allSelected
    ? category.choices.map((c) => selections[c.id]).join('|')
    : null

  const pNumber = pKey ? category.pNumbers[pKey] : null

  function handleChange(choiceId, value) {
    setSelections((prev) => ({ ...prev, [choiceId]: value }))
  }

  function handleReset() {
    setSelections({})
  }

  return (
    <div className="wedder-finder">
      <div className="wedder-finder-top">
        <button className="back-button" onClick={onBack}>← Categories</button>
        <h2 className="wedder-finder-title">{category.name}</h2>
      </div>

      <div className="wedder-finder-body">
        <div className="wedder-finder-img-wrap">
          <img
            src={category.image}
            alt={category.name}
            className="wedder-finder-img"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
          <div className="wedder-finder-img-placeholder" style={{ display: 'none' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            <span>Gold Wedders</span>
          </div>
        </div>

        <div className="wedder-finder-controls">
          {category.choices.map((choice) => (
            <div key={choice.id} className="wedder-choice-group">
              <label className="wedder-choice-label">{choice.label}</label>
              <div className="wedder-choice-options">
                {choice.options.map((opt) => (
                  <button
                    key={opt}
                    className={`wedder-choice-btn${selections[choice.id] === opt ? ' wedder-choice-btn--active' : ''}`}
                    onClick={() => handleChange(choice.id, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="wedder-result">
            {!allSelected && (
              <p className="wedder-result-prompt">Select all options above to find the P number</p>
            )}
            {allSelected && pNumber && (
              <div className="wedder-result-found">
                <span className="wedder-result-label">P Number</span>
                <span className="wedder-result-p">{pNumber}</span>
              </div>
            )}
            {allSelected && !pNumber && (
              <p className="wedder-result-not-found">No P number found for this combination</p>
            )}
          </div>

          {Object.keys(selections).length > 0 && (
            <button className="wedder-reset-btn" onClick={handleReset}>Reset</button>
          )}
        </div>
      </div>
    </div>
  )
}

function WeddersPage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState(null)

  return (
    <div className="wedders-page">
      <div className="page-header">
        <button
          className="back-button"
          onClick={() => activeCategory ? setActiveCategory(null) : navigate('/dev')}
        >
          {activeCategory ? '← Categories' : 'Dev'}
        </button>
        <h1>Wedders</h1>
      </div>

      {!activeCategory && (
        <div className="wedder-categories">
          {wedderCategories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} onSelect={setActiveCategory} />
          ))}
        </div>
      )}

      {activeCategory && (
        <PNumberFinder
          category={activeCategory}
          onBack={() => setActiveCategory(null)}
        />
      )}
    </div>
  )
}

export default WeddersPage
