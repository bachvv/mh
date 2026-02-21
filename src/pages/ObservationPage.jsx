import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'mh_observation_data'

function today() {
  return new Date().toISOString().slice(0, 10)
}

const SECTIONS = [
  {
    id: 'cr',
    title: 'Conversion Rate (CR)',
    focus: 'How to SELL',
    represents: 'Conversion rate is the "KING OF THE STATISTICS" — it helps CONFIRM ALL OTHER STATISTICS. It specifically identifies if there is a problem within the basic selling process.',
    behaviours: [
      {
        id: 'cr_opening',
        label: 'Opening – genuine greeting, non-business opening line',
        detail: 'Start with a warm, genuine greeting. Avoid business talk immediately — use a non-business opening line to build rapport before moving into the sale.',
      },
      {
        id: 'cr_friendly',
        label: 'Friendly test – using it to gauge trust level',
        detail: 'Use a friendly comment or question to test the customer\'s openness and gauge how comfortable they are with the SP.',
      },
      {
        id: 'cr_probing',
        label: 'Probing – at least 4 of the 6 Essential Probing Questions',
        detail: 'Ask at minimum 4 of the 6 Essential Probing Questions to fully understand the customer\'s needs, lifestyle and occasion.',
      },
      {
        id: 'cr_qas',
        label: 'QAS – used when probing',
        detail: 'Use the QAS technique (Question, Acknowledge, Sell) during the probing stage to keep the conversation flowing naturally.',
      },
      {
        id: 'cr_tray',
        label: 'Tray and selvyt – effective use',
        detail: 'Use the tray and selvyt cloth correctly and professionally when presenting jewellery to the customer.',
      },
      {
        id: 'cr_fab',
        label: 'F&B\'s – features and benefits matched back to probing',
        detail: 'Demonstrate Features & Benefits that directly match back to information gained during probing — not just generic product facts.',
      },
      {
        id: 'cr_ask',
        label: 'Asking for the sale – using easy closes',
        detail: 'Use easy, natural closing lines. e.g. "Would you like me to wrap that for you?" or "Shall I put that aside for you?"',
      },
      {
        id: 'cr_objections',
        label: 'Handling objections',
        detail: 'Respond to objections with empathy: "Do you LOVE it? What is it that you are unsure about? What don\'t you like about it?" — then address the specific concern.',
      },
    ],
  },
  {
    id: 'ips',
    title: 'Items per Sale (IPS)',
    focus: 'How to ADD ON',
    represents: 'Use PROBING QUESTIONS and BUILD TRUST in the relationship to identify and add additional items to the sale.',
    behaviours: [
      {
        id: 'ips_emotional',
        label: 'Advanced/Emotional probing questions',
        detail: 'Ask advanced or emotional probing questions that allow the customer to open up and share their entire journey — not just the immediate purchase reason.',
      },
      {
        id: 'ips_worm',
        label: 'Adding on – using the WORM method',
        detail: 'Use the WORM method to identify add-on opportunities: Wardrobe, Occasions, Reward & Matching.',
      },
    ],
  },
  {
    id: 'asv',
    title: 'Average Sale Value (ASV)',
    focus: 'How to UPSELL',
    represents: 'CREATE VALUE within the sales presentation to naturally move the customer to a higher price point.',
    behaviours: [
      {
        id: 'asv_higher',
        label: 'Demonstrating higher priced items',
        detail: 'Show higher priced items that match the customer\'s needs — lead with value, not price. Present the features and benefits before revealing the cost.',
      },
      {
        id: 'asv_payment',
        label: 'Introducing payment plan options early',
        detail: 'Introduce payment plan options (e.g. Flexiti, MHC) early in the sale presentation, then recap again when price objections arise.',
      },
    ],
  },
  {
    id: 'tph',
    title: 'Transactions Per Hour (TPH)',
    focus: 'How to SELL FASTER',
    represents: 'CLOSE A SALE efficiently. Every minute counts — the faster sales are closed, the more customers can be served.',
    behaviours: [
      {
        id: 'tph_ask',
        label: 'Asking for the sale – using closing lines',
        detail: 'Use clear, confident closing lines. Don\'t wait for the customer to volunteer to buy — ask directly and naturally.',
      },
      {
        id: 'tph_control',
        label: 'Control of the sale',
        detail: 'Observe who is leading the interaction — is the customer following the SP around the store, or is the SP following the customer? The SP should lead.',
      },
      {
        id: 'tph_rotation',
        label: 'Approaching clients regularly, in appropriate time',
        detail: 'Rotation System: Is the SP approaching new clients regularly and within an appropriate time frame after they enter the store?',
      },
      {
        id: 'tph_ops',
        label: 'Not too focused on operations',
        detail: 'Operations focus — is the SP too focused on tidying, cleaning or admin tasks rather than actively engaging with customers on the floor?',
      },
      {
        id: 'tph_step',
        label: 'Stepping back to let others serve',
        detail: 'Is the SP stepping back appropriately to give other SPs the opportunity to serve new customers, rather than holding the floor?',
      },
    ],
  },
]

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function ObservationPage() {
  const navigate = useNavigate()
  const [nameInput, setNameInput] = useState('')
  const [activeName, setActiveName] = useState('')
  const [checked, setChecked] = useState({})

  const handleSetName = (e) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed) return
    const d = loadData()
    const key = `${trimmed}__${today()}`
    setActiveName(trimmed)
    setChecked(d[key] || {})
    setNameInput('')
  }

  const handleCheck = (behaviourId) => {
    const next = { ...checked, [behaviourId]: !checked[behaviourId] }
    setChecked(next)
    const d = loadData()
    d[`${activeName}__${today()}`] = next
    saveData(d)
  }

  const totalBehaviours = SECTIONS.reduce((sum, s) => sum + s.behaviours.length, 0)
  const totalChecked = Object.values(checked).filter(Boolean).length

  return (
    <div className="obs-page">
      <div className="obs-header">
        <button className="back-button" onClick={() => navigate('/')}>Home</button>
        <h1 className="obs-title">Observation</h1>
      </div>

      {!activeName ? (
        <div className="obs-name-card">
          <p className="obs-name-prompt">Who are you observing?</p>
          <form onSubmit={handleSetName} className="obs-name-form">
            <input
              className="obs-name-input"
              type="text"
              placeholder="Salesperson name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="obs-name-btn" disabled={!nameInput.trim()}>
              Start
            </button>
          </form>
        </div>
      ) : (
        <div className="obs-content">
          <div className="obs-who">
            <span className="obs-who-name">{activeName}</span>
            <span className="obs-who-date">
              {new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
            <button className="obs-change-btn" onClick={() => { setActiveName(''); setChecked({}) }}>
              Change
            </button>
          </div>

          <div className="obs-progress">
            <div className="obs-progress-bar">
              <div
                className="obs-progress-fill"
                style={{ width: `${totalBehaviours > 0 ? (totalChecked / totalBehaviours) * 100 : 0}%` }}
              />
            </div>
            <span className="obs-progress-label">{totalChecked} / {totalBehaviours} behaviours observed</span>
          </div>

          {SECTIONS.map((section) => {
            const sectionChecked = section.behaviours.filter((b) => checked[b.id]).length
            return (
              <div key={section.id} className="obs-section">
                <div className="obs-section-header">
                  <div className="obs-section-meta">
                    <span className="obs-section-focus">{section.focus}</span>
                    <h2 className="obs-section-title">{section.title}</h2>
                  </div>
                  <div className="obs-section-right">
                    <span className="obs-section-count">{sectionChecked}/{section.behaviours.length}</span>
                    <div className="obs-tip obs-tip--section">
                      <span className="obs-tip-icon">?</span>
                      <div className="obs-tip-popup obs-tip-popup--left">
                        <strong>What it represents:</strong>
                        <p>{section.represents}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <ul className="obs-behaviour-list">
                  {section.behaviours.map((b) => (
                    <li key={b.id} className={`obs-behaviour${checked[b.id] ? ' obs-behaviour--checked' : ''}`}>
                      <label className="obs-behaviour-label">
                        <input
                          type="checkbox"
                          className="obs-checkbox"
                          checked={!!checked[b.id]}
                          onChange={() => handleCheck(b.id)}
                        />
                        <span className="obs-behaviour-text">{b.label}</span>
                      </label>
                      <div className="obs-tip">
                        <span className="obs-tip-icon">?</span>
                        <div className="obs-tip-popup">{b.detail}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ObservationPage
