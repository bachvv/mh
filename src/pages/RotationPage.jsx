import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

function RotationPage({ embedded = false }) {
  const navigate = useNavigate()
  const [names, setNames] = useState(['', ''])
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

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

  const handleDragStart = (index) => {
    dragItem.current = index
    setDragIndex(index)
  }

  const handleDragEnter = (index) => {
    dragOverItem.current = index
    setDragOverIndex(index)
  }

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const updated = [...names]
    const [dragged] = updated.splice(dragItem.current, 1)
    updated.splice(dragOverItem.current, 0, dragged)
    setNames(updated)
    dragItem.current = null
    dragOverItem.current = null
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleTouchStart = (index, e) => {
    dragItem.current = index
    setDragIndex(index)
  }

  const handleTouchMove = (e) => {
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    if (el) {
      const row = el.closest('.rotation-row')
      if (row) {
        const idx = parseInt(row.dataset.index, 10)
        if (!isNaN(idx)) {
          dragOverItem.current = idx
          setDragOverIndex(idx)
        }
      }
    }
  }

  const handleTouchEnd = () => {
    handleDragEnd()
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
          Next &#x279C;
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
            <div
              className={`rotation-row${dragIndex === index ? ' dragging' : ''}${dragOverIndex === index && dragIndex !== index ? ' drag-over' : ''}`}
              key={index}
              data-index={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(index, e)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <span className="rotation-drag-handle" title="Drag to reorder">&#x2630;</span>
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
