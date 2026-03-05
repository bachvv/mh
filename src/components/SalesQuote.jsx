import { useState, useEffect, useCallback } from 'react'
import salesQuotes from '../data/salesQuotes'

function SalesQuote() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * salesQuotes.length))
  const [fade, setFade] = useState(true)

  const nextQuote = useCallback(() => {
    setFade(false)
    setTimeout(() => {
      setIndex((prev) => (prev + 1) % salesQuotes.length)
      setFade(true)
    }, 300)
  }, [])

  useEffect(() => {
    const interval = setInterval(nextQuote, 12000)
    return () => clearInterval(interval)
  }, [nextQuote])

  const quote = salesQuotes[index]

  return (
    <div className="sales-quote" onClick={nextQuote}>
      <div className={`sales-quote__content${fade ? ' sales-quote--visible' : ''}`}>
        <p className="sales-quote__text">"{quote.text}"</p>
        <span className="sales-quote__author">— {quote.author}</span>
      </div>
    </div>
  )
}

export default SalesQuote
