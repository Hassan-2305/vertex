import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const INR = (v) => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })
