import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { FO_SYMBOLS, LOT_SIZES, getExpiries } from '../../../lib/constants'
import { INR, cn } from '../../../lib/utils'
import { Loader2 } from 'lucide-react'

const expiries = getExpiries()

const formSchema = z.object({
  symbol: z.string(),
  instrument: z.enum(['call', 'put', 'futures', 'stock']),
  trade_type: z.enum(['buy', 'sell']),
  strike_price: z.string().optional(),
  expiry_date: z.string().optional(),
  entry_price: z.preprocess(Number, z.number().min(0.05, 'Invalid price')),
  quantity: z.preprocess(Number, z.number().min(1, 'Min qty is 1')),
})

export default function PaperTradeForm({ onSubmit, isSubmitting }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      symbol: 'NIFTY',
      instrument: 'call',
      trade_type: 'buy',
      strike_price: '',
      expiry_date: expiries[0],
      entry_price: '',
      quantity: LOT_SIZES['NIFTY'] ?? 50,
    }
  })

  const tradeType = watch('trade_type')
  const instrument = watch('instrument')
  const symbol = watch('symbol')
  const entryPrice = watch('entry_price')
  const quantity = watch('quantity')

  // Auto-fill lot size when symbol or instrument changes
  const handleSymbolChange = (e) => {
    setValue('symbol', e.target.value)
    if (instrument !== 'stock') {
      const lot = LOT_SIZES[e.target.value]
      if (lot) setValue('quantity', lot)
    }
  }

  const handleInstrumentChange = (e) => {
    setValue('instrument', e.target.value)
    if (e.target.value !== 'stock') {
      const lot = LOT_SIZES[symbol]
      if (lot) setValue('quantity', lot)
    }
  }

  return (
    <div className="glass-panel p-6 relative overflow-hidden group">
      {/* Subtle glow effect behind form */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-accent/20 transition-colors duration-700" />
      
      <div className="text-[11px] font-bold tracking-widest text-text-muted mb-5 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        PLACE ORDER
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label>Symbol</label>
            <select {...register('symbol')} onChange={handleSymbolChange}>
              {FO_SYMBOLS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label>Instrument</label>
            <select {...register('instrument')} onChange={handleInstrumentChange}>
              <option value="call">Call Option</option>
              <option value="put">Put Option</option>
              <option value="futures">Futures</option>
              <option value="stock">Stock (CNC)</option>
            </select>
          </div>
        </div>

        <div className="flex bg-black/40 backdrop-blur-sm border border-white/5 rounded-lg p-1 gap-1 shadow-inner my-2">
          {['buy', 'sell'].map(t => (
            <button key={t} type="button" onClick={() => setValue('trade_type', t)}
              className={cn(
                "flex-1 p-2 border-none cursor-pointer text-[12px] font-bold tracking-wider rounded-md transition-all duration-300",
                tradeType === t
                  ? (t === 'buy' ? 'bg-green text-black shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'bg-red text-white shadow-[0_0_15px_rgba(248,113,113,0.3)]')
                  : 'bg-transparent text-text-muted hover:text-white hover:bg-white/5'
              )}>
              {t === 'buy' ? 'BUY / LONG' : 'SELL / SHORT'}
            </button>
          ))}
        </div>

        {instrument !== 'stock' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>Strike price</label>
              <input type="number" placeholder="22000" {...register('strike_price')} />
            </div>
            <div>
              <label>Expiry</label>
              <select {...register('expiry_date')}>
                {expiries.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label>Entry price (₹)</label>
            <input type="number" placeholder="150.50" step="0.05" {...register('entry_price')} />
            {errors.entry_price && <span className="text-red text-[10px] mt-1 block">{errors.entry_price.message}</span>}
          </div>
          <div>
            <label>
              Quantity / Lots
              {instrument !== 'stock' && LOT_SIZES[symbol] && (
                <span className="text-accent ml-1 text-[10px]">(lot={LOT_SIZES[symbol]})</span>
              )}
            </label>
            <input type="number" placeholder="50" min="1" {...register('quantity')} />
            {errors.quantity && <span className="text-red text-[10px] mt-1 block">{errors.quantity.message}</span>}
            {instrument !== 'stock' && LOT_SIZES[symbol] && quantity % LOT_SIZES[symbol] !== 0 && (
              <span className="text-amber text-[10px] mt-1 block">
                ⚠ Qty must be a multiple of {LOT_SIZES[symbol]}
              </span>
            )}
          </div>
        </div>

        {entryPrice && quantity ? (
          <div className="bg-black/40 border border-white/5 rounded-lg py-2.5 px-3.5 text-xs mt-2 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent"></div>
            <div className="flex justify-between items-center pl-2">
              <span className="text-text-muted font-medium uppercase tracking-wide text-[10px]">Margin required</span>
              <span className="text-white font-mono font-bold">{INR(Number(entryPrice) * Number(quantity))}</span>
            </div>
          </div>
        ) : null}

        <button type="submit" className="btn btn-primary justify-center p-2.5 mt-2" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Place ${tradeType.toUpperCase()} order`}
        </button>
      </form>
    </div>
  )
}
