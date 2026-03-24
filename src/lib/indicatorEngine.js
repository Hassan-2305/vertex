// ─── Indicator Engine ─────────────────────────────────────────────────────────
// All functions take arrays of numbers and return arrays of numbers.

export function calcEMA(data, period) {
  const k = 2 / (period + 1)
  let ema = data[0]
  return data.map(v => { ema = v * k + ema * (1 - k); return ema })
}

export function calcSMA(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return data[i]
    const slice = data.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

export function calcRSI(data, period = 14) {
  const gains = [], losses = []
  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1]
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? -diff : 0)
  }
  const result = [50] // first point undefined, use 50
  for (let i = 0; i < gains.length; i++) {
    if (i < period) { result.push(50); continue }
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period
    result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)))
  }
  return result
}

export function calcMACD(data, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(data, fast)
  const emaSlow = calcEMA(data, slow)
  const macdLine = emaFast.map((v, i) => v - emaSlow[i])
  const signalLine = calcEMA(macdLine, signal)
  const histogram = macdLine.map((v, i) => v - signalLine[i])
  return { macdLine, signalLine, histogram }
}

export function calcBollingerBands(data, period = 20, multiplier = 2) {
  return data.map((_, i) => {
    if (i < period - 1) return { upper: data[i], lower: data[i], middle: data[i] }
    const slice = data.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period)
    return { upper: mean + multiplier * std, lower: mean - multiplier * std, middle: mean }
  })
}

export function calcATR(highs, lows, closes, period = 14) {
  const tr = [highs[0] - lows[0]]
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i]
    const hpc = Math.abs(highs[i] - closes[i - 1])
    const lpc = Math.abs(lows[i] - closes[i - 1])
    tr.push(Math.max(hl, hpc, lpc))
  }
  return calcEMA(tr, period)
}

export function calcSupertrend(highs, lows, closes, period = 10, multiplier = 3) {
  const atr = calcATR(highs, lows, closes, period)
  let isUp = true, finalUpper = 0, finalLower = 0
  return closes.map((c, i) => {
    if (i === 0) return { value: closes[0], isUp: true }
    const hl2 = (highs[i] + lows[i]) / 2
    let bu = hl2 + multiplier * atr[i]
    let bl = hl2 - multiplier * atr[i]
    if (bu < finalUpper || closes[i - 1] > finalUpper) finalUpper = bu
    if (bl > finalLower || closes[i - 1] < finalLower) finalLower = bl
    if (closes[i - 1] === finalUpper && c > finalUpper) isUp = true
    if (closes[i - 1] === finalLower && c < finalLower) isUp = false
    return { value: isUp ? finalLower : finalUpper, isUp }
  })
}

export function calcVWAP(highs, lows, closes, volumes) {
  let cumVol = 0, cumVolPrice = 0
  return closes.map((c, i) => {
    const tp = (highs[i] + lows[i] + c) / 3
    const vol = volumes[i] || 1
    cumVol += vol; cumVolPrice += tp * vol
    return cumVolPrice / cumVol
  })
}

export function calcSTOCH(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  const kRaw = closes.map((c, i) => {
    if (i < kPeriod - 1) return 50
    const slice_h = highs.slice(i - kPeriod + 1, i + 1)
    const slice_l = lows.slice(i - kPeriod + 1, i + 1)
    const highest = Math.max(...slice_h)
    const lowest = Math.min(...slice_l)
    return highest === lowest ? 50 : ((c - lowest) / (highest - lowest)) * 100
  })
  const dSmooth = calcSMA(kRaw, dPeriod)
  return { k: kRaw, d: dSmooth }
}

export function calcADX(highs, lows, closes, period = 14) {
  const n = closes.length
  const tr = [], plusDM = [], minusDM = []
  for (let i = 1; i < n; i++) {
    const hl = highs[i] - lows[i]
    const hpc = Math.abs(highs[i] - closes[i - 1])
    const lpc = Math.abs(lows[i] - closes[i - 1])
    tr.push(Math.max(hl, hpc, lpc))
    const upMove = highs[i] - highs[i - 1]
    const downMove = lows[i - 1] - lows[i]
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }
  const atr = calcEMA(tr, period)
  const plusDI = calcEMA(plusDM, period).map((v, i) => (v / (atr[i] || 1)) * 100)
  const minusDI = calcEMA(minusDM, period).map((v, i) => (v / (atr[i] || 1)) * 100)
  const dx = plusDI.map((p, i) => {
    const sum = p + minusDI[i]
    return sum === 0 ? 0 : (Math.abs(p - minusDI[i]) / sum) * 100
  })
  const adx = calcEMA(dx, period)
  return { adx: [0, ...adx], plusDI: [0, ...plusDI], minusDI: [0, ...minusDI] }
}

export function calcOBV(closes, volumes) {
  let obv = 0
  return closes.map((c, i) => {
    if (i === 0) return (obv = 0)
    if (c > closes[i - 1]) obv += (volumes[i] || 0)
    else if (c < closes[i - 1]) obv -= (volumes[i] || 0)
    return obv
  })
}

// ─── Indicator Series Builder ─────────────────────────────────────────────────
// Given a list of indicator definitions and OHLCV price arrays,
// returns a map of { indicatorId: number[] }

export function buildIndicatorSeries(indicators, prices) {
  const closes = prices.map(p => p.close)
  const highs = prices.map(p => p.high ?? p.close)
  const lows = prices.map(p => p.low ?? p.close)
  const volumes = prices.map(p => p.volume ?? 0)
  const series = {}

  for (const ind of indicators) {
    const src = ind.on === 'high' ? highs : ind.on === 'low' ? lows : ind.on === 'volume' ? volumes : closes
    const p = ind.period || 14
    switch (ind.type.toUpperCase()) {
      case 'EMA': series[ind.id] = calcEMA(src, p); break
      case 'SMA': series[ind.id] = calcSMA(src, p); break
      case 'RSI': series[ind.id] = calcRSI(src, p); break
      case 'MACD': {
        const { macdLine, signalLine, histogram } = calcMACD(src)
        series[ind.id] = macdLine
        series[ind.id + '_signal'] = signalLine
        series[ind.id + '_hist'] = histogram
        break
      }
      case 'BOLLINGERBANDS':
      case 'BB': {
        const bands = calcBollingerBands(src, p)
        series[ind.id + '_upper'] = bands.map(b => b.upper)
        series[ind.id + '_lower'] = bands.map(b => b.lower)
        series[ind.id + '_middle'] = bands.map(b => b.middle)
        series[ind.id] = bands.map(b => b.middle) // default ref = middle
        break
      }
      case 'ATR': series[ind.id] = calcATR(highs, lows, closes, p); break
      case 'SUPERTREND': {
        const st = calcSupertrend(highs, lows, closes, p, ind.extra?.multiplier ?? 3)
        series[ind.id] = st.map(s => s.value)
        series[ind.id + '_isup'] = st.map(s => s.isUp ? 1 : 0)
        break
      }
      case 'VWAP': series[ind.id] = calcVWAP(highs, lows, closes, volumes); break
      case 'STOCH': {
        const { k, d } = calcSTOCH(highs, lows, closes, p)
        series[ind.id] = k
        series[ind.id + '_d'] = d
        break
      }
      case 'ADX': {
        const { adx, plusDI, minusDI } = calcADX(highs, lows, closes, p)
        series[ind.id] = adx
        series[ind.id + '_plus'] = plusDI
        series[ind.id + '_minus'] = minusDI
        break
      }
      case 'OBV': series[ind.id] = calcOBV(closes, volumes); break
      default: console.warn('Unknown indicator type:', ind.type)
    }
  }
  // Always expose raw OHLCV by name
  series['close'] = closes
  series['high'] = highs
  series['low'] = lows
  series['volume'] = volumes
  return series
}
