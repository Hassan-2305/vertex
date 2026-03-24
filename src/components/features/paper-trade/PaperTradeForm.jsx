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
    <div className="bg-[#111118] border border-white/[0.07] rounded-xl p-5">
      <div className="text-[10px] font-bold tracking-widest text-text-muted mb-4 flex items-center gap-2 uppercase">
        <div className="w-1.5 h-1.5 rounded-full bg-[#4f8ef7] animate-pulse" />
        Place Order
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">Symbol</label>
            <select 
              {...register('symbol')} 
              onChange={handleSymbolChange}
              className="w-full py-2.5 px-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
            >
              {FO_SYMBOLS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">Instrument</label>
            <select 
              {...register('instrument')} 
              onChange={handleInstrumentChange}
              className="w-full py-2.5 px-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
            >
              <option value="call">Call Option</option>
              <option value="put">Put Option</option>
              <option value="futures">Futures</option>
              <option value="stock">Stock (CNC)</option>
            </select>
          </div>
        </div>

        {/* BUY / SELL Toggle */}
        <div className="flex bg-[#0a0a0f] p-1 rounded-lg border border-white/[0.07] gap-1 my-1">
          {['buy', 'sell'].map(t => (
            <button 
              key={t} 
              type="button" 
              onClick={() => setValue('trade_type', t)}
              className={cn(
                "flex-1 py-2.5 rounded-md text-[12px] font-bold tracking-wider transition-all duration-150",
                tradeType === t
                  ? (t === 'buy' 
                      ? 'bg-[#34d48a] text-[#0a0a0f] shadow-[0_0_15px_rgba(52,212,138,0.3)]' 
                      : 'bg-[#f7614f] text-white shadow-[0_0_15px_rgba(247,97,79,0.3)]')
                  : 'bg-transparent text-text-muted hover:text-white hover:bg-white/5'
              )}
            >
              {t === 'buy' ? 'BUY / LONG' : 'SELL / SHORT'}
            </button>
          ))}
        </div>

        {instrument !== 'stock' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">Strike Price</label>
              <input 
                type="number" 
                placeholder="22000" 
                {...register('strike_price')} 
                className="w-full py-2.5 px-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] font-mono focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">Expiry</label>
              <select 
                {...register('expiry_date')}
                className="w-full py-2.5 px-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
              >
                {expiries.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">Entry Price</label>
            <input 
              type="number" 
              placeholder="150.50" 
              step="0.05" 
              {...register('entry_price')} 
              className="w-full py-2.5 px-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] font-mono focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
            />
            {errors.entry_price && <span className="text-[#f7614f] text-[10px] mt-1 block">{errors.entry_price.message}</span>}
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">
              Quantity
              {instrument !== 'stock' && LOT_SIZES[symbol] && (
                <span className="text-[#4f8ef7] ml-1 text-[10px]">(lot={LOT_SIZES[symbol]})</span>
              )}
            </label>
            <input 
              type="number" 
              placeholder="50" 
              min="1" 
              {...register('quantity')} 
              className="w-full py-2.5 px-3 bg-[#0a0a0f] border border-white/[0.07] rounded-lg text-white text-[13px] font-mono focus:border-[#4f8ef7]/50 focus:outline-none transition-colors"
            />
            {errors.quantity && <span className="text-[#f7614f] text-[10px] mt-1 block">{errors.quantity.message}</span>}
            {instrument !== 'stock' && LOT_SIZES[symbol] && quantity % LOT_SIZES[symbol] !== 0 && (
              <span className="text-[#f7b84f] text-[10px] mt-1 block">
                Qty must be multiple of {LOT_SIZES[symbol]}
              </span>
            )}
          </div>
        </div>

        {/* Margin Preview */}
        {entryPrice && quantity ? (
          <div className="bg-[#0a0a0f] border border-white/[0.07] rounded-lg py-3 px-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#4f8ef7]" />
            <div className="flex justify-between items-center pl-2">
              <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Margin Required</span>
              <span className="text-white font-mono font-bold text-[14px]">{INR(Number(entryPrice) * Number(quantity))}</span>
            </div>
          </div>
        ) : null}

        <button 
          type="submit" 
          disabled={isSubmitting}
          className={cn(
            "w-full py-3 rounded-lg text-[14px] font-semibold transition-all duration-150 flex items-center justify-center gap-2",
            tradeType === 'buy'
              ? 'bg-[#34d48a] text-[#0a0a0f] hover:bg-[#3ee69a] shadow-[0_0_15px_rgba(52,212,138,0.25)]'
              : 'bg-[#f7614f] text-white hover:bg-[#f87363] shadow-[0_0_15px_rgba(247,97,79,0.25)]'
          )}
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Place ${tradeType.toUpperCase()} Order`}
        </button>
      </form>
    </div>
  )
}
