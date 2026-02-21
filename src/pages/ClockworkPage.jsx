import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'mh_clockwork_data'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function dayOfWeek() {
  return new Date().toLocaleDateString('en-AU', { weekday: 'long' })
}

const SECTIONS = [
  {
    id: 'open',
    title: 'Opening',
    tasks: [
      { id: 'open_dashboard', label: 'Check Dashboard' },
      { id: 'open_setup', label: 'Store Set Up / Precheck' },
      { id: 'open_meeting', label: 'Morning Meeting / DIPS Review' },
      { id: 'open_walk', label: 'Walk the Floor / AOR' },
    ],
  },
  {
    id: 'drive',
    title: 'Drive Sales',
    tasks: [
      { id: 'drive_coach', label: 'On Floor Coaching' },
      { id: 'drive_appt', label: 'Appointment Review & Actions' },
      { id: 'drive_thankyou', label: 'Thank You Cards' },
      { id: 'drive_leadreview', label: 'Lead Review' },
      { id: 'drive_leadcalls', label: 'Lead Calls' },
      { id: 'drive_observation', label: 'Observation' },
      { id: 'drive_coachlog', label: 'Coaching Log' },
    ],
  },
  {
    id: 'admin',
    title: 'Customer Service & Admin',
    tasks: [
      { id: 'admin_specialorder', label: 'Update special order register' },
      { id: 'admin_reviewso', label: 'Review special order register & follow up' },
      { id: 'admin_repairs_out', label: 'Send out repairs' },
      { id: 'admin_repairs_in', label: 'Receive in repairs & phone customers — check costs, quotes' },
      { id: 'admin_rush', label: 'Follow up with rush repairs' },
      { id: 'admin_tags', label: 'Order and tag items from tag request' },
      { id: 'admin_couriers', label: 'Receive and prepare couriers' },
      { id: 'admin_fedex', label: 'FedEx shipments' },
      { id: 'admin_delegate', label: 'Delegate 1 of 5 weekly activities from Admin Matrix' },
      { id: 'admin_credit', label: 'Finalise and submit credit contracts' },
      { id: 'admin_cheques', label: 'Write out store cheques & update Jasper' },
    ],
  },
  {
    id: 'stock',
    title: 'Stock Review',
    tasks: [
      { id: 'stock_negative', label: 'Negative stock' },
      { id: 'stock_outstanding', label: 'Outstanding to receive' },
      { id: 'stock_overdue', label: 'Overdue CA / SO' },
      { id: 'stock_closerepairs', label: 'Close repairs' },
      { id: 'stock_invoices', label: 'Check & prepare invoices / DW cost' },
    ],
  },
  {
    id: 'close',
    title: 'Closing',
    tasks: [
      { id: 'close_banking', label: 'Finalise banking' },
      { id: 'close_dips', label: 'DIPS Completion' },
    ],
  },
  {
    id: 'weekly',
    title: 'Weekly Tasks',
    tasks: [
      { id: 'weekly_faulty', label: 'Send faulty stock' },
      { id: 'weekly_cash', label: 'Check cash change' },
      { id: 'weekly_supplies', label: 'Check supplies & packaging' },
      { id: 'weekly_banking', label: 'Prepare banking slip & ebags (Monday)' },
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

function ClockworkPage() {
  const navigate = useNavigate()
  const dateKey = today()
  const [checked, setChecked] = useState(() => {
    const d = loadData()
    return d[dateKey] || {}
  })

  const handleCheck = (taskId) => {
    const next = { ...checked, [taskId]: !checked[taskId] }
    setChecked(next)
    const d = loadData()
    d[dateKey] = next
    saveData(d)
  }

  const totalTasks = SECTIONS.reduce((sum, s) => sum + s.tasks.length, 0)
  const totalChecked = Object.values(checked).filter(Boolean).length
  const pct = totalTasks > 0 ? Math.round((totalChecked / totalTasks) * 100) : 0

  const handleReset = () => {
    if (!confirm('Reset all tasks for today?')) return
    setChecked({})
    const d = loadData()
    delete d[dateKey]
    saveData(d)
  }

  return (
    <div className="cw-page">
      <div className="cw-header">
        <button className="back-button" onClick={() => navigate('/dev')}>Dev</button>
        <h1 className="cw-title">Clockwork</h1>
      </div>

      <div className="cw-date-bar">
        <span className="cw-day">{dayOfWeek()}</span>
        <span className="cw-date">
          {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      <div className="cw-progress">
        <div className="cw-progress-bar">
          <div
            className={`cw-progress-fill${pct === 100 ? ' cw-progress-fill--done' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="cw-progress-meta">
          <span className="cw-progress-label">{totalChecked} / {totalTasks} tasks</span>
          <span className="cw-progress-pct">{pct}%</span>
        </div>
      </div>

      <div className="cw-sections">
        {SECTIONS.map((section) => {
          const sectionChecked = section.tasks.filter((t) => checked[t.id]).length
          const allDone = sectionChecked === section.tasks.length
          return (
            <div key={section.id} className={`cw-section${allDone ? ' cw-section--done' : ''}`}>
              <div className="cw-section-header">
                <h2 className="cw-section-title">{section.title}</h2>
                <span className="cw-section-count">{sectionChecked}/{section.tasks.length}</span>
              </div>
              <ul className="cw-task-list">
                {section.tasks.map((task) => (
                  <li key={task.id} className={`cw-task${checked[task.id] ? ' cw-task--checked' : ''}`}>
                    <label className="cw-task-label">
                      <input
                        type="checkbox"
                        className="cw-checkbox"
                        checked={!!checked[task.id]}
                        onChange={() => handleCheck(task.id)}
                      />
                      <span className="cw-task-text">{task.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="cw-reset-row">
        <button className="cw-reset-btn" onClick={handleReset}>Reset Today</button>
      </div>
    </div>
  )
}

export default ClockworkPage
