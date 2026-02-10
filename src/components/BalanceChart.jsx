import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const blueColors = [
  'rgba(54, 162, 235, 1)',
  'rgba(75, 192, 192, 1)',
  'rgba(153, 102, 255, 1)',
  'rgba(255, 159, 64, 1)',
  'rgba(255, 99, 132, 1)',
  'rgba(201, 203, 207, 1)',
]

const greenColors = [
  'rgba(75, 192, 75, 1)',
  'rgba(34, 139, 34, 1)',
  'rgba(0, 128, 128, 1)',
  'rgba(60, 179, 113, 1)',
  'rgba(46, 139, 87, 1)',
  'rgba(144, 238, 144, 1)',
]

function BalanceChart({ totalWithTax, terms, adminFees, label, colorScheme }) {
  const colors = colorScheme === 'blue' ? blueColors : greenColors

  const data = useMemo(() => {
    const eligibleTerms = terms.filter(
      (t) => t.minAmount === 0 || totalWithTax >= t.minAmount
    )

    if (eligibleTerms.length === 0) return null

    const maxMonths = Math.max(...eligibleTerms.map((t) => t.months))
    const labels = Array.from({ length: maxMonths + 1 }, (_, i) => `Month ${i}`)

    const datasets = eligibleTerms.map((term, idx) => {
      const annualFeeTotal = (term.annualFee || 0) * Math.ceil(term.months / 12)
      const totalOwed = totalWithTax + (adminFees ? term.adminFee : 0) + annualFeeTotal
      const monthlyPayment = totalOwed / term.months
      const balances = []

      for (let m = 0; m <= maxMonths; m++) {
        if (m <= term.months) {
          balances.push(Math.max(0, totalOwed - monthlyPayment * m))
        } else {
          balances.push(0)
        }
      }

      return {
        label: `${term.months} months ($${monthlyPayment.toFixed(2)}/mo)`,
        data: balances,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length].replace('1)', '0.1)'),
        tension: 0.1,
        pointRadius: 2,
      }
    })

    return { labels, datasets }
  }, [totalWithTax, terms, adminFees, colors])

  if (!data) {
    return <p className="no-data">Total amount does not meet minimum requirements for any term.</p>
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: `${label} - Balance Decline Over Time`,
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: $${ctx.raw.toFixed(2)}`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Month' },
      },
      y: {
        title: { display: true, text: 'Remaining Balance ($)' },
        beginAtZero: true,
        ticks: {
          callback: (val) => `$${val.toLocaleString()}`,
        },
      },
    },
  }

  return (
    <div className="chart-container">
      <Line data={data} options={options} />
    </div>
  )
}

export default BalanceChart
