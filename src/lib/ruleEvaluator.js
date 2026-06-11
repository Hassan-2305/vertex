// ─── Rule Evaluator ───────────────────────────────────────────────────────────
// Takes a parsed JSON strategy and OHLCV prices, returns signals + trade log.

import { buildIndicatorSeries } from './indicatorEngine.js'

/**
 * Evaluate a single condition at a given bar index.
 * @param {object} condition - { left, op, right }
 * @param {object} series - map of id → number[]
 * @param {number} i - current bar index
 * @param {number} prev - previous bar index (for cross conditions)
 */
function evalCondition(condition, series, i, prev) {
  const { left, op, right } = condition
  const getVal = (key, idx) => {
    if (typeof key === 'number') return key
    if (series[key]) return series[key][idx] ?? 0
    return 0
  }

  const leftNow = getVal(left, i)
  const rightNow = typeof right === 'number' ? right : getVal(right, i)
  const leftPrev = getVal(left, prev)
  const rightPrev = typeof right === 'number' ? right : getVal(right, prev)

  switch (op) {
    case 'crossAbove': return leftPrev <= rightPrev && leftNow > rightNow
    case 'crossBelow': return leftPrev >= rightPrev && leftNow < rightNow
    case '>': return leftNow > rightNow
    case '<': return leftNow < rightNow
    case '>=': return leftNow >= rightNow
    case '<=': return leftNow <= rightNow
    default: return false
  }
}

/**
 * Evaluate a rule group (entry or exit) at a given bar.
 * @param {object} rule - { logic: 'AND'|'OR', conditions: [] }
 */
function evalRuleGroup(rule, series, i, prev) {
  if (!rule || !rule.conditions?.length) return false
  const results = rule.conditions.map(c => evalCondition(c, series, i, prev))
  return rule.logic === 'OR' ? results.some(Boolean) : results.every(Boolean)
}

/**
 * Run a complete custom-rule backtest.
 * @param {object} strategy - Parsed JSON strategy from Groq
 * @param {Array}  prices   - [{ close, high, low, volume }]
 * @param {Array}  dates    - string labels per bar
 * @returns {{ equity, trades, metrics }}
 */
export function runCustomBacktest(strategy, prices, dates) {
  const series = buildIndicatorSeries(strategy.indicators || [], prices)
  const closes = series['close']
  const n = closes.length

  const SLIPPAGE = 0.0005 // 0.05% per trade
  const SL_PCT = strategy.stopLoss ? strategy.stopLoss / 100 : null
  const TP_PCT = strategy.takeProfit ? strategy.takeProfit / 100 : null

  let capital = 100_000
  let inPosition = false
  let entryPrice = 0
  let entryBar = 0
  const trades = []
  const equity = []
  const signalBars = [] // for chart annotation

  for (let i = 1; i < n; i++) {
    const prev = i - 1
    const c = closes[i]

    if (!inPosition) {
      const entrySignal = evalRuleGroup(strategy.entry, series, i, prev)
      if (entrySignal) {
        entryPrice = c * (1 + SLIPPAGE)
        entryBar = i
        inPosition = true
        signalBars.push({ bar: i, type: 'buy', price: c, date: dates[i] })
      }
    } else {
      // Check stop loss and take profit first (intrabar)
      const gainPct = (c - entryPrice) / entryPrice
      let exitReason = null
      let exitPrice = c

      if (SL_PCT && gainPct <= -SL_PCT) {
        exitPrice = entryPrice * (1 - SL_PCT)
        exitReason = 'SL'
      } else if (TP_PCT && gainPct >= TP_PCT) {
        exitPrice = entryPrice * (1 + TP_PCT)
        exitReason = 'TP'
      } else if (evalRuleGroup(strategy.exit, series, i, prev)) {
        exitReason = 'Signal'
      }

      if (exitReason) {
        exitPrice = exitPrice * (1 - SLIPPAGE)
        const pnlPct = (exitPrice - entryPrice) / entryPrice
        capital *= (1 + pnlPct)
        trades.push({
          entryDate: dates[entryBar],
          exitDate: dates[i],
          entry: +entryPrice.toFixed(2),
          exit: +exitPrice.toFixed(2),
          pnl: pnlPct,
          reason: exitReason,
          bars: i - entryBar,
        })
        signalBars.push({ bar: i, type: 'sell', price: c, date: dates[i], reason: exitReason })
        inPosition = false
      }
    }

    equity.push({ date: dates[i], value: Math.round(inPosition ? capital * (c / entryPrice) : capital) })
  }

  const wins = trades.filter(t => t.pnl > 0)
  const maxDD = equity.length ? (() => {
    let peak = equity[0].value, dd = 0
    equity.forEach(e => { peak = Math.max(peak, e.value); dd = Math.max(dd, (peak - e.value) / peak * 100) })
    return dd
  })() : 0

  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length * 100 : 0
  const avgLoss = trades.filter(t => t.pnl < 0).length
    ? trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / trades.filter(t => t.pnl < 0).length * 100
    : 0

  return {
    equity,
    trades,
    signalBars,
    totalReturn: ((capital - 100_000) / 100_000) * 100,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    totalTrades: trades.length,
    maxDrawdown: maxDD,
    avgWin,
    avgLoss,
    profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
  }
}
