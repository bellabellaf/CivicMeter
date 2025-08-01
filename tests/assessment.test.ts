import { describe, it, expect, beforeEach } from 'vitest'

type Taxpayer = {
  income: number
  lastPaid: number
  taxRate: number
}

type AssessmentState = {
  admin: string
  taxpayers: Map<string, Taxpayer>
}

const PERIOD_SECONDS = 31556926 // 1 year
const TAX_RATE = 5 // percentage

const ERR_NOT_AUTHORIZED = 100
const ERR_ALREADY_REGISTERED = 101
const ERR_NOT_REGISTERED = 102
const ERR_TOO_EARLY = 103

let state: AssessmentState

beforeEach(() => {
  state = {
    admin: 'STADMIN0000000000000000000000000000000',
    taxpayers: new Map(),
  }
})

const isAdmin = (sender: string) => sender === state.admin

const registerTaxpayer = (sender: string, entity: string, income: number) => {
  if (!isAdmin(sender)) return { error: ERR_NOT_AUTHORIZED }
  if (state.taxpayers.has(entity)) return { error: ERR_ALREADY_REGISTERED }

  state.taxpayers.set(entity, {
    income,
    lastPaid: 0,
    taxRate: TAX_RATE,
  })
  return { value: true }
}

const payTax = (sender: string, timestamp: number) => {
  const taxpayer = state.taxpayers.get(sender)
  if (!taxpayer) return { error: ERR_NOT_REGISTERED }

  const dueTime = taxpayer.lastPaid + PERIOD_SECONDS
  if (timestamp < dueTime) return { error: ERR_TOO_EARLY }

  const amountDue = (taxpayer.income * taxpayer.taxRate) / 100
  taxpayer.lastPaid = timestamp
  return { value: amountDue }
}

const updateIncome = (sender: string, newIncome: number) => {
  const taxpayer = state.taxpayers.get(sender)
  if (!taxpayer) return { error: ERR_NOT_REGISTERED }

  taxpayer.income = newIncome
  return { value: true }
}

const getTaxDetails = (sender: string) => {
  const taxpayer = state.taxpayers.get(sender)
  if (!taxpayer) return { error: ERR_NOT_REGISTERED }

  return {
    value: {
      income: taxpayer.income,
      lastPaid: taxpayer.lastPaid,
      taxRate: taxpayer.taxRate,
    },
  }
}

const transferAdmin = (sender: string, newAdmin: string) => {
  if (!isAdmin(sender)) return { error: ERR_NOT_AUTHORIZED }
  state.admin = newAdmin
  return { value: true }
}

// Vitest test cases
describe('Taxpayer Assessment Contract', () => {
  const admin = 'STADMIN0000000000000000000000000000000'
  const user = 'STUSER000000000000000000000000000000000'
  const newAdmin = 'STNEWAUTH0000000000000000000000000000'

  it('should register a new taxpayer', () => {
    const result = registerTaxpayer(admin, user, 50000)
    expect(result).toEqual({ value: true })
    expect(state.taxpayers.get(user)).toBeDefined()
  })

  it('should not register taxpayer by non-admin', () => {
    const result = registerTaxpayer(user, user, 40000)
    expect(result).toEqual({ error: ERR_NOT_AUTHORIZED })
  })

  it('should not register a taxpayer twice', () => {
    registerTaxpayer(admin, user, 30000)
    const result = registerTaxpayer(admin, user, 30000)
    expect(result).toEqual({ error: ERR_ALREADY_REGISTERED })
  })

  it('should allow a registered taxpayer to pay tax after period', () => {
    registerTaxpayer(admin, user, 100000)
    const result = payTax(user, PERIOD_SECONDS + 1)
    expect(result).toEqual({ value: 5000 }) // 5% of 100000
  })

  it('should block tax payment before due period', () => {
    registerTaxpayer(admin, user, 100000)
    const result = payTax(user, 10000)
    expect(result).toEqual({ error: ERR_TOO_EARLY })
  })

  it('should update income of a registered taxpayer', () => {
    registerTaxpayer(admin, user, 60000)
    const result = updateIncome(user, 75000)
    expect(result).toEqual({ value: true })
    expect(state.taxpayers.get(user)?.income).toBe(75000)
  })

  it('should get tax details', () => {
    registerTaxpayer(admin, user, 88000)
    const result = getTaxDetails(user)
    expect(result).toEqual({
      value: {
        income: 88000,
        lastPaid: 0,
        taxRate: TAX_RATE,
      },
    })
  })

  it('should transfer admin rights', () => {
    const result = transferAdmin(admin, newAdmin)
    expect(result).toEqual({ value: true })
    expect(state.admin).toBe(newAdmin)
  })

  it('should reject admin transfer by non-admin', () => {
    const result = transferAdmin(user, newAdmin)
    expect(result).toEqual({ error: ERR_NOT_AUTHORIZED })
  })
})
