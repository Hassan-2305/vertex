import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SEARCH_CACHE = new Map()

export function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useSymbolSearch(query) {
  const debouncedQuery = useDebounce(query, 300)
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      setIsSearching(false)
      return
    }

    const ctrl = new AbortController()
    setIsSearching(true)

    const key = debouncedQuery.trim().toLowerCase()
    if (SEARCH_CACHE.has(key)) {
      setResults(SEARCH_CACHE.get(key))
      setIsSearching(false)
      return
    }

    const search = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yfinance-proxy?q=${encodeURIComponent(debouncedQuery)}`,
          {
            headers: { 'Authorization': `Bearer ${session?.access_token}` },
            signal: ctrl.signal
          }
        )
        const data = await res.json()
        const matches = (data?.quotes || [])
          .filter(q => q.quoteType === 'EQUITY' && (q.exchange === 'NSI' || q.exchange === 'BSE' || q.symbol?.endsWith('.NS') || q.symbol?.endsWith('.BO')))
          .slice(0, 5)
        
        const mapped = matches.map(q => ({
          symbol: q.symbol,
          name: q.longName || q.shortName || q.symbol,
          exchange: q.exchange === 'NSI' ? 'NSE' : 'BSE'
        }))
        
        SEARCH_CACHE.set(key, mapped)
        if (!ctrl.signal.aborted) {
          setResults(mapped)
          setIsSearching(false)
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          setResults([])
          setIsSearching(false)
        }
      }
    }
    
    search()
    return () => ctrl.abort()
  }, [debouncedQuery])

  return { results, isSearching }
}
