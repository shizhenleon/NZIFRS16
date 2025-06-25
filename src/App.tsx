import { useState } from 'react'
import './App.css'

interface LeaseInput {
  leaseTerm: number
  paymentAmount: number
  paymentFrequency: 'monthly' | 'quarterly' | 'yearly'
  interestRate: number
  startDate: string
  rentIncreaseRate?: number // percent per increase
}

function calculateLeaseLiability({ leaseTerm, paymentAmount, paymentFrequency, interestRate }: LeaseInput) {
  // Convert frequency to payments per year
  const freqMap = { monthly: 12, quarterly: 4, yearly: 1 }
  const paymentsPerYear = freqMap[paymentFrequency]
  const totalPayments = leaseTerm * paymentsPerYear
  const ratePerPeriod = interestRate / 100 / paymentsPerYear
  // Present value of an ordinary annuity formula
  const pv = paymentAmount * (1 - Math.pow(1 + ratePerPeriod, -totalPayments)) / ratePerPeriod
  return pv
}

function generateAmortizationSchedule({ leaseTerm, paymentAmount, paymentFrequency, interestRate, rentIncreaseRate = 0, startDate }: LeaseInput) {
  const freqMap = { monthly: 12, quarterly: 4, yearly: 1 }
  const paymentsPerYear = freqMap[paymentFrequency]
  const totalPayments = leaseTerm * paymentsPerYear
  const ratePerPeriod = interestRate / 100 / paymentsPerYear
  let liabilityBalance = calculateLeaseLiability({ leaseTerm, paymentAmount, paymentFrequency, interestRate, startDate: '' })
  const initialAsset = liabilityBalance
  const depreciationPerPeriod = initialAsset / totalPayments
  let assetBalance = initialAsset
  let currentPayment = paymentAmount
  const schedule = []
  // Calculate period end dates
  let periodDate = startDate ? new Date(startDate) : null
  for (let i = 1; i <= totalPayments; i++) {
    // Apply rent increase at the start of each year (except the first year)
    if (
      rentIncreaseRate > 0 &&
      paymentsPerYear > 0 &&
      i > 1 &&
      ((i - 1) % paymentsPerYear === 0)
    ) {
      currentPayment = currentPayment * (1 + rentIncreaseRate / 100)
    }
    // Calculate period end date
    let periodEnd = ''
    if (periodDate) {
      let endDate = new Date(periodDate)
      if (paymentFrequency === 'monthly') endDate.setMonth(endDate.getMonth() + 1)
      else if (paymentFrequency === 'quarterly') endDate.setMonth(endDate.getMonth() + 3)
      else if (paymentFrequency === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1)
      endDate.setDate(endDate.getDate() - 1)
      periodEnd = endDate.toISOString().slice(0, 10)
      periodDate = new Date(endDate)
      periodDate.setDate(periodDate.getDate() + 1)
    }
    const interest = liabilityBalance * ratePerPeriod
    const principal = currentPayment - interest
    const endingLiability = liabilityBalance - principal
    assetBalance = assetBalance - depreciationPerPeriod
    schedule.push({
      period: i,
      periodEnd,
      openingLiability: liabilityBalance,
      interestExpense: interest,
      payment: currentPayment,
      principal,
      closingLiability: endingLiability > 0 ? endingLiability : 0,
      depreciation: depreciationPerPeriod,
      closingAsset: assetBalance > 0 ? assetBalance : 0,
    })
    liabilityBalance = endingLiability
  }
  return schedule
}

function App() {
  const [input, setInput] = useState<LeaseInput>({
    leaseTerm: 5,
    paymentAmount: 10000,
    paymentFrequency: 'monthly',
    interestRate: 6,
    startDate: '',
    rentIncreaseRate: 0,
  })
  const [result, setResult] = useState<number | null>(null)
  const [schedule, setSchedule] = useState<any[]>([])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setInput((prev) => ({
      ...prev,
      [name]: name === 'leaseTerm' || name === 'paymentAmount' || name === 'interestRate' || name === 'rentIncreaseRate' ? Number(value) : value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setResult(calculateLeaseLiability(input))
    setSchedule(generateAmortizationSchedule(input))
  }

  return (
    <div className="lease-calc-container">
      <h1>NZ IFRS Lease Liability Calculator</h1>
      <form onSubmit={handleSubmit} className="lease-form">
        <div className="lease-form-group">
          <div className="lease-form-title">Lease Term (years)</div>
          <input type="number" name="leaseTerm" value={input.leaseTerm} min={1} onChange={handleChange} required />
        </div>
        <div className="lease-form-group">
          <div className="lease-form-title">Payment Amount (per period, NZD)</div>
          <input
            type="number"
            name="paymentAmount"
            value={input.paymentAmount}
            min={0}
            onChange={handleChange}
            required
            style={{ textAlign: 'right' }}
          />
          <div className="lease-form-hint">
            {input.paymentAmount.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="lease-form-group">
          <div className="lease-form-title">Payment Frequency</div>
          <select name="paymentFrequency" value={input.paymentFrequency} onChange={handleChange}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div className="lease-form-group">
          <div className="lease-form-title">Interest Rate (% per annum)</div>
          <input type="number" name="interestRate" value={input.interestRate} min={0} step={0.01} onChange={handleChange} required />
        </div>
        <div className="lease-form-group">
          <div className="lease-form-title">Lease Start Date</div>
          <input type="date" name="startDate" value={input.startDate} onChange={handleChange} />
        </div>
        <div className="lease-form-group">
          <div className="lease-form-title">Rent Increase Rate (%)</div>
          <input type="number" name="rentIncreaseRate" value={input.rentIncreaseRate} min={0} step={0.01} onChange={handleChange} />
        </div>
        <button type="submit">Calculate</button>
      </form>
      {result !== null && (
        <div className="result">
          <h2>Present Value of Lease Liability</h2>
          <p>{result.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</p>
          <h3>Amortisation Schedule</h3>
          <div className="amortization-table-wrapper">
            <table className="amortization-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Period End</th>
                  <th>Opening Lease Liability</th>
                  <th>Interest</th>
                  <th>Payment</th>
                  <th>Principal</th>
                  <th>Closing Lease Liability</th>
                  <th>Depreciation</th>
                  <th>Closing Right-of-use Asset</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.period}>
                    <td>{row.period}</td>
                    <td>{row.periodEnd}</td>
                    <td>{row.openingLiability.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.interestExpense.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.payment.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.principal.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.closingLiability.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.depreciation.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.closingAsset.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
