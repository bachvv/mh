import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function RotationPage({ embedded = false }) {
  const navigate = useNavigate()
  const [names, setNames] = useState(['', ''])

  const handleNameChange = (index, value) => {
    const updated = [...names]
    updated[index] = value
    setNames(updated)
  }

  const addName = () => {
    setNames([...names, ''])
  }

  const removeName = (index) => {
    if (names.length <= 2) return
    setNames(names.filter((_, i) => i !== index))
  }

  const rotate = () => {
    if (names.length < 2) return
    const [first, ...rest] = names
    setNames([...rest, first])
  }

  return (
    <div className="rotation-page">
      {!embedded && (
      <div className="rotation-header">
        <button className="back-button" onClick={() => navigate('/dev')}>
          Dev
        </button>
        <h1>Sales Rotation</h1>
        <button className="rotate-btn" onClick={rotate} title="Next person">
          &#x27A1;
        </button>
      </div>
      )}
      {embedded && (
        <div className="rotation-header">
          <h2 style={{ margin: 0 }}>Sales Rotation</h2>
          <button className="rotate-btn" onClick={rotate} title="Next person">
            &#x27A1;
          </button>
        </div>
      )}

      <div className="rotation-card">
        <div className="rotation-current">
          <span className="current-label">Up Next</span>
          <span className="current-name">{names[0] || '---'}</span>
        </div>

        <div className="rotation-list">
          {names.map((name, index) => (
            <div className="rotation-row" key={index}>
              <span className="rotation-position">{index + 1}</span>
              <input
                type="text"
                className="rotation-input"
                placeholder="Enter name"
                value={name}
                onChange={(e) => handleNameChange(index, e.target.value)}
              />
              {names.length > 2 && (
                <button className="remove-btn" onClick={() => removeName(index)}>
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>

        <button className="add-btn" onClick={addName}>
          + Add Person
        </button>
      </div>
    </div>
  )
}

export default RotationPage
