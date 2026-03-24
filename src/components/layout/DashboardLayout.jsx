import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Menu, X } from 'lucide-react'
import WatchlistSidebar from './WatchlistSidebar'

const NAV = [
  { to: '/dashboard', label: 'Portfolio', icon: <GridIcon />, exact: true },
  { to: '/dashboard/analytics', label: 'Analytics', icon: <ActivityIcon /> },
  { to: '/dashboard/backtest', label: 'Backtest', icon: <ChartIcon /> },
  { to: '/dashboard/strategy', label: 'Strategy AI', icon: <BrainIcon /> },
  { to: '/dashboard/paper', label: 'Paper Trade', icon: <ShieldIcon /> },
]

export default function DashboardLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('light')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{
      background: 'radial-gradient(ellipse 60% 80% at 30% 0%, rgba(56, 189, 248, 0.07) 0%, transparent 70%), radial-gradient(ellipse 80% 60% at 100% 100%, rgba(27, 77, 99, 0.15) 0%, transparent 70%), #04080c'
    }}>
      {/* Mobile Header overlay */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-bg-card/90 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <VertexLogo size={22} />
          <span className="font-head text-lg tracking-wide font-bold text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]">Vertex</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} className="p-1 text-text-muted hover:text-text rounded-md bg-bg-elevated border-none">
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-[260px] bg-bg-card/95 backdrop-blur-xl h-full flex flex-col shadow-2xl animate-in slide-in-from-left max-w-[80vw] border-r border-white/5">
            <div className="flex items-center justify-between p-[1.5rem_1.25rem] border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="flex items-center gap-2.5">
                <VertexLogo size={24} />
                <span className="font-head text-xl tracking-wide font-bold text-white">Vertex</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-text-muted hover:text-text bg-bg-elevated rounded-md border-none">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 p-[1rem_0.75rem] overflow-y-auto">
              <div className="mb-6">
                <span className="block text-[10px] font-medium text-text-dim uppercase tracking-[0.1em] px-2 mb-1.5">Platform</span>
                {NAV.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center gap-3 p-[10px_12px] rounded-lg text-sm font-medium no-underline mb-1 transition-all duration-150 ${
                        isActive 
                          ? 'bg-accent/10 text-accent border-l-2 border-l-accent shadow-[inset_10px_0_20px_rgba(56,189,248,0.05)] pl-[10px]' 
                          : 'text-text-muted hover:bg-white/5 border-l-2 border-l-transparent'
                      }`
                    }
                  >
                    <span className={location.pathname === item.to ? 'text-accent' : 'text-text-muted'}>{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
            <div className="p-4 border-t border-border bg-bg-elevated/50 flex items-center justify-between">
              <button 
                onClick={toggleTheme} 
                className="w-10 h-10 flex flex-col items-center justify-center p-2 bg-transparent hover:bg-bg border border-border text-text rounded-lg"
              >
                {isDark ? <SunIcon /> : <MoonIcon />}
              </button>
              <button 
                onClick={handleSignOut} 
                className="flex-1 ml-3 flex items-center justify-center gap-2 p-2.5 bg-red-dim/50 border border-red/20 text-red rounded-lg text-sm font-medium"
              >
                <LogOutIcon /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[240px] bg-[#060B10] border-r border-border flex-col shrink-0 relative z-10 transition-all duration-300 shadow-[2px_0_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3 p-[1.5rem_1.25rem] border-b border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent">
          <VertexLogo size={26} />
          <span className="font-head text-[22px] tracking-wide font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">Vertex</span>
        </div>

        <nav className="flex-1 p-[1rem_0.75rem] overflow-y-auto">
          <div className="mb-6">
            <span className="block text-[10px] font-medium text-text-dim uppercase tracking-[0.1em] px-2 mb-1.5">Platform</span>
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) => 
                  `flex items-center gap-2 p-[7px_10px] rounded-lg text-[13px] no-underline mb-[1px] transition-all duration-150 ${
                    isActive 
                      ? 'bg-accent/5 text-accent border-l-2 border-l-accent shadow-[inset_10px_0_20px_rgba(56,189,248,0.05)] pl-[8px] font-semibold' 
                      : 'text-text-muted hover:bg-white/5 hover:text-white border-l-2 border-l-transparent text-sm hover:translate-x-1'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 p-2 bg-bg-elevated rounded-lg">
            <div className="w-8 h-8 rounded-full bg-accent-dim border border-accent-border flex items-center justify-center text-xs font-semibold text-accent shrink-0">
              {(user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-text overflow-hidden text-ellipsis whitespace-nowrap">
                {user?.user_metadata?.full_name || 'Trader'}
              </div>
            </div>
            
            <button onClick={toggleTheme} className="bg-transparent border border-border rounded-md cursor-pointer text-text hover:bg-bg flex p-1.5 shrink-0 transition-colors" title="Toggle Theme">
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            
            <button onClick={handleSignOut} className="bg-red-dim border border-red/20 rounded-md cursor-pointer text-red flex p-1.5 shrink-0 hover:opacity-80 transition-colors" title="Sign out">
              <LogOutIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-[100dvh] min-w-0 md:pl-0 pt-14 md:pt-0 overflow-hidden relative z-0">
        <div className="flex-1 overflow-auto rounded-tl-xl md:border-l md:border-t md:border-white/5 md:bg-black/20 md:mt-2 backdrop-blur-sm shadow-[inset_2px_2px_20px_rgba(0,0,0,0.5)]">
          <Outlet />
        </div>
      </main>

      {/* Persistent Right Sidebar (Watchlist/Alerts) */}
      <div className="hidden xl:flex">
        <WatchlistSidebar />
      </div>
    </div>
  )
}

function GridIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> }
function ChartIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="1,12 5,7 9,10 15,3"/></svg> }
function BrainIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5l1.5-1.5M11 5l1.5-1.5"/></svg> }
function ShieldIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1L15 4V8C15 12 12 15 8 16C4 15 1 12 1 8V4L8 1Z"/></svg> }
function ActivityIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> }
function LogOutIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l4-4-4-4M14 8H6"/></svg> }
function SunIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function MoonIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }

function VertexLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="filter drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
      <circle cx="12" cy="5.5" r="3.5" fill="#38bdf8" />
      <path d="M4 9.5 L12 22 L20 9.5 L15.5 9.5 L12 15 L8.5 9.5 Z" fill="#296a84" />
      <path d="M12 22 L20 9.5 L15.5 9.5 L12 15 Z" fill="#1b4d63" />
    </svg>
  )
}
