export const VIRTUAL_CAPITAL = 1000000

export const FO_SYMBOLS = [
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'RELIANCE', 'TCS',
  'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'WIPRO'
]

// Lot sizes for F&O instruments
export const LOT_SIZES = {
  NIFTY: 25,
  BANKNIFTY: 15,
  FINNIFTY: 40,
  SENSEX: 10,
  RELIANCE: 250,
  TCS: 150,
  INFY: 300,
  HDFCBANK: 550,
  ICICIBANK: 700,
  SBIN: 1500,
  WIPRO: 3000,
}

// Fixed expiry date generator — finds the next 4 weekly Thursdays
export function getExpiries() {
  const expiries = []
  const today = new Date()
  let d = new Date(today)
  // Advance to this week's Thursday
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7))
  // If today IS Thursday and it's already past, start from next Thursday
  if (d <= today) d.setDate(d.getDate() + 7)
  for (let i = 0; i < 4; i++) {
    expiries.push(d.toISOString().split('T')[0])
    d = new Date(d)
    d.setDate(d.getDate() + 7)
  }
  return expiries
}
