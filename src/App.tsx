import { useState } from 'react'
import './App.css'

interface LeaseModification {
  effectiveDate: string // 变更生效日期
  paymentAmount?: number
  leaseTerm?: number
  interestRate?: number
  rentIncreaseRate?: number // percent per increase
}

interface LeaseInput {
  leaseTerm: number
  paymentAmount: number
  paymentFrequency: 'monthly' | 'quarterly' | 'yearly'
  interestRate: number
  startDate: string
  rentIncreaseRate?: number // percent per increase
  modifications?: LeaseModification[]
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

function generateAmortizationSchedule({ leaseTerm, paymentAmount, paymentFrequency, interestRate, rentIncreaseRate = 0, startDate, modifications = [] }: LeaseInput) {
  const freqMap = { monthly: 12, quarterly: 4, yearly: 1 }
  const paymentsPerYear = freqMap[paymentFrequency]
  const totalPayments = leaseTerm * paymentsPerYear
  let schedule = []
  let periodDate = startDate ? new Date(startDate) : null
  let modIdx = 0
  let mods = modifications.sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime())
  let currentPayment = paymentAmount
  let currentInterestRate = interestRate
  let currentRentIncreaseRate = rentIncreaseRate
  let currentStartPeriod = 1
  let liabilityBalance = calculateLeaseLiability({ leaseTerm, paymentAmount, paymentFrequency, interestRate, startDate: '' })
  let initialAsset = liabilityBalance
  let assetBalance = initialAsset
  let depreciationPerPeriod = initialAsset / totalPayments
  for (let i = 1; i <= totalPayments; i++) {
    // 检查是否有变更生效
    if (
      modIdx < mods.length &&
      periodDate &&
      new Date(mods[modIdx].effectiveDate).getTime() <= periodDate.getTime()
    ) {
      // 应用变更
      if (mods[modIdx].paymentAmount !== undefined) currentPayment = mods[modIdx].paymentAmount as number
      if (mods[modIdx].interestRate !== undefined) currentInterestRate = mods[modIdx].interestRate as number
      if (mods[modIdx].rentIncreaseRate !== undefined) currentRentIncreaseRate = mods[modIdx].rentIncreaseRate as number
      // leaseTerm变更仅用于重新计算现值，不再单独存储currentLeaseTerm
      // 重新计算现值（剩余现金流）
      const modLeaseTerm = mods[modIdx].leaseTerm !== undefined ? mods[modIdx].leaseTerm as number : (totalPayments - i + 1) / paymentsPerYear
      liabilityBalance = calculateLeaseLiability({
        leaseTerm: modLeaseTerm,
        paymentAmount: currentPayment,
        paymentFrequency,
        interestRate: currentInterestRate,
        startDate: ''
      })
      // 资产余额也需重估（简化处理：按剩余期数直线摊销）
      assetBalance = liabilityBalance
      const remainingPeriodsMod = totalPayments - i + 1
      depreciationPerPeriod = assetBalance / remainingPeriodsMod
      initialAsset = assetBalance
      currentStartPeriod = i
      modIdx++
    }
    // Apply rent increase at the start of each year (except the first year)
    if (
      currentRentIncreaseRate > 0 &&
      paymentsPerYear > 0 &&
      i > currentStartPeriod &&
      ((i - currentStartPeriod) % paymentsPerYear === 0)
    ) {
      currentPayment = currentPayment * (1 + currentRentIncreaseRate / 100)
    }
    // Calculate period end date
    let periodEnd = ''
    if (periodDate) {
      let endDate = new Date(periodDate)
      if (paymentFrequency === 'monthly') endDate.setMonth(endDate.getMonth() + 1)
      else if (paymentFrequency === 'quarterly') endDate.setMonth(endDate.getMonth() + 3)
      else if (paymentFrequency === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1)
      endDate.setDate(endDate.getDate() - 1)
      periodEnd = endDate.toLocaleString('en-NZ', { month: 'short', year: 'numeric' })
      periodDate = new Date(endDate)
      periodDate.setDate(periodDate.getDate() + 1)
    }
    const ratePerPeriod = currentInterestRate / 100 / paymentsPerYear
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
      modification: mods.find(m => periodDate && new Date(m.effectiveDate).getTime() === periodDate.getTime())
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
  const [modifications, setModifications] = useState<LeaseModification[]>([])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setInput((prev) => ({
      ...prev,
      [name]: name === 'leaseTerm' || name === 'paymentAmount' || name === 'interestRate' || name === 'rentIncreaseRate' ? Number(value) : value,
    }))
  }

  const handleAddModification = () => {
    setModifications((prev) => [
      ...prev,
      { effectiveDate: '', paymentAmount: undefined, leaseTerm: undefined, interestRate: undefined, rentIncreaseRate: undefined }
    ])
  }
  const handleModificationChange = (idx: number, field: keyof LeaseModification, value: any) => {
    setModifications((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value === '' ? undefined : (field === 'effectiveDate' ? value : Number(value)) } : m))
  }
  const handleRemoveModification = (idx: number) => {
    setModifications((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setResult(calculateLeaseLiability(input))
    setSchedule(generateAmortizationSchedule({ ...input, modifications }))
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
        <div className="lease-form-group">
          <div className="lease-form-title">Lease Modifications</div>
          <button type="button" onClick={handleAddModification} style={{ marginBottom: 8 }}>+ Add Modification</button>
          {modifications.map((mod, idx) => (
            <div key={idx} className="modification-row">
              <input type="date" value={mod.effectiveDate} onChange={e => handleModificationChange(idx, 'effectiveDate', e.target.value)} required placeholder="Effective Date" />
              <input type="number" value={mod.paymentAmount ?? ''} onChange={e => handleModificationChange(idx, 'paymentAmount', e.target.value)} placeholder="New Payment" min={0} />
              <input type="number" value={mod.leaseTerm ?? ''} onChange={e => handleModificationChange(idx, 'leaseTerm', e.target.value)} placeholder="New Term (years)" min={1} />
              <input type="number" value={mod.interestRate ?? ''} onChange={e => handleModificationChange(idx, 'interestRate', e.target.value)} placeholder="New Rate (%)" min={0} step={0.01} />
              <input type="number" value={mod.rentIncreaseRate ?? ''} onChange={e => handleModificationChange(idx, 'rentIncreaseRate', e.target.value)} placeholder="New Rent Increase (%)" min={0} step={0.01} />
              <button type="button" onClick={() => handleRemoveModification(idx)} style={{ marginLeft: 4 }}>Remove</button>
            </div>
          ))}
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
                  <th>Modification</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.period} style={row.modification ? { background: '#073642' } : {}}>
                    <td>{row.period}</td>
                    <td>{row.periodEnd}</td>
                    <td>{row.openingLiability.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.interestExpense.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.payment.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.principal.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.closingLiability.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.depreciation.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.closingAsset.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 2 })}</td>
                    <td>{row.modification ? 'Yes' : ''}</td>
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
