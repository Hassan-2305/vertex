import { supabase } from './supabase'

export async function fetchCurrentPrice(symbol, instrument) {
  try {
    const ticker = (instrument === 'stock' && !symbol.includes('.'))
      ? `${symbol}.NS`
      : symbol === 'NIFTY' ? '^NSEI'
      : symbol === 'BANKNIFTY' ? '^NSEBANK'
      : symbol === 'FINNIFTY' ? 'NIFTY_FIN_SERVICE.NS'
      : symbol === 'SENSEX' ? '^BSESN'
      : `${symbol}.NS`

    const { data: { session } } = await supabase.auth.getSession()
    const p1 = Math.floor(Date.now() / 1000 - 86400 * 3)
    const p2 = Math.floor(Date.now() / 1000)
    
    // Check if it's our mock F&O contract string (e.g. "NIFTY 25 Mar 22400 CE")
    let finalTicker = ticker
    if (symbol.includes('CE') || symbol.includes('PE')) {
      // It's a mock option. Use the underlying spot price to approximate PNL.
      const match = symbol.match(/^(NIFTY|BANKNIFTY|SENSEX)/)
      finalTicker = match ? (match[1] === 'NIFTY' ? '^NSEI' : match[1] === 'BANKNIFTY' ? '^NSEBANK' : '^BSESN') : ticker
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yfinance-proxy?ticker=${encodeURIComponent(finalTicker)}&period1=${p1}&period2=${p2}`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    
    const data = await res.json()
    const spot = data?.chart?.result?.[0]?.meta?.regularMarketPrice || null
    
    // Very simple mock logic to return something valid for F&O if spot is found
    if (spot && (symbol.includes(' CE') || symbol.includes(' PE'))) {
      const parts = symbol.split(' ')
      const strike = Number(parts[parts.length - 2])
      const type = parts[parts.length - 1]
      let intrinsic = 0
      if (type === 'CE') intrinsic = Math.max(0, spot - strike)
      if (type === 'PE') intrinsic = Math.max(0, strike - spot)
      const timeValue = Math.max(0, 100 - Math.abs(spot - strike) / 2)
      return Math.max(0.5, intrinsic + timeValue)
    }

    return spot
  } catch {
    return null
  }
}
