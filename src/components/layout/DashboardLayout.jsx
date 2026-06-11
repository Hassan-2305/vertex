import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Menu, X } from 'lucide-react'
import WatchlistSidebar from './WatchlistSidebar'

const NAV = [
  { to: '/dashboard', label: 'Portfolio', icon: <GridIcon />, exact: true, section: 'overview' },
  { to: '/dashboard/analytics', label: 'Analytics', icon: <ActivityIcon />, section: 'overview' },
  { to: '/dashboard/backtest', label: 'Backtest', icon: <ChartIcon />, section: 'trading' },
  { to: '/dashboard/strategy', label: 'Strategy AI', icon: <BrainIcon />, section: 'trading' },
  { to: '/dashboard/paper', label: 'Paper Trade', icon: <ShieldIcon />, section: 'trading' },
]

export default function DashboardLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const overviewNav = NAV.filter(n => n.section === 'overview')
  const tradingNav = NAV.filter(n => n.section === 'trading')

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#0a0a0f]">
      {/* Mobile Header overlay */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-[#111118]/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2.5">
          <VertexLogo size={22} />
          <span className="font-head text-lg tracking-wide font-bold text-white">Vertex</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 text-text-muted hover:text-white rounded-md bg-[#18181f] border border-white/5">
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-[260px] bg-[#0d0d12] h-full flex flex-col shadow-2xl animate-in slide-in-from-left max-w-[80vw] border-r border-white/5">
            {/* Subtle vertical gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#4f8ef7]/[0.02] via-transparent to-transparent pointer-events-none" />
            
            <div className="relative flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <VertexLogo size={24} />
                <span className="font-head text-xl tracking-wide font-bold text-white">Vertex</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-text-muted hover:text-white bg-[#18181f] rounded-md border border-white/5">
                <X size={20} />
              </button>
            </div>
            
            <nav className="relative flex-1 p-3 overflow-y-auto">
              {/* Overview Section */}
              <div className="mb-4">
                <span className="block text-[10px] font-semibold text-text-dim uppercase tracking-[0.12em] px-3 mb-2">Overview</span>
                {overviewNav.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center gap-3 p-3 rounded-lg text-[13px] font-medium no-underline mb-1 transition-all duration-150 ${
                        isActive 
                          ? 'bg-[rgba(79,142,247,0.08)] text-[#4f8ef7] border-l-2 border-l-[#4f8ef7] pl-[10px]' 
                          : 'text-text-muted hover:bg-white/5 hover:text-white border-l-2 border-l-transparent'
                      }`
                    }
                  >
                    <span className="opacity-80">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>

              {/* Trading Section */}
              <div>
                <span className="block text-[10px] font-semibold text-text-dim uppercase tracking-[0.12em] px-3 mb-2">Trading</span>
                {tradingNav.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center gap-3 p-3 rounded-lg text-[13px] font-medium no-underline mb-1 transition-all duration-150 ${
                        isActive 
                          ? 'bg-[rgba(79,142,247,0.08)] text-[#4f8ef7] border-l-2 border-l-[#4f8ef7] pl-[10px]' 
                          : 'text-text-muted hover:bg-white/5 hover:text-white border-l-2 border-l-transparent'
                      }`
                    }
                  >
                    <span className="opacity-80">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
            
            <div className="relative p-4 border-t border-white/5">
              <button 
                onClick={handleSignOut} 
                className="w-full flex items-center justify-center gap-2 p-3 bg-[rgba(247,97,79,0.1)] border border-[rgba(247,97,79,0.2)] text-[#f7614f] rounded-lg text-sm font-medium hover:bg-[rgba(247,97,79,0.15)] transition-colors"
              >
                <LogOutIcon /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar - 220px as per spec */}
      <aside className="hidden md:flex w-[220px] bg-[#0d0d12] border-r border-white/[0.07] flex-col shrink-0 relative z-10">
        {/* Subtle vertical gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#4f8ef7]/[0.02] via-transparent to-transparent pointer-events-none" />
        
        {/* Logo */}
        <div className="relative flex items-center gap-3 p-5 border-b border-white/[0.07]">
          <div className="group cursor-pointer">
            <VertexLogo size={28} className="transition-all duration-300 group-hover:drop-shadow-[0_0_12px_rgba(79,142,247,0.6)]" />
          </div>
          <span className="font-head text-[20px] tracking-tight font-bold text-white">Vertex</span>
        </div>

        <nav className="relative flex-1 p-3 overflow-y-auto">
          {/* Overview Section */}
          <div className="mb-5">
            <span className="block text-[10px] font-semibold text-text-dim uppercase tracking-[0.12em] px-3 mb-2">Overview</span>
            {overviewNav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) => 
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] no-underline mb-0.5 transition-all duration-150 ${
                    isActive 
                      ? 'bg-[rgba(79,142,247,0.08)] text-[#4f8ef7] border-l-2 border-l-[#4f8ef7] pl-[10px] font-semibold' 
                      : 'text-text-muted hover:bg-white/5 hover:text-white border-l-2 border-l-transparent hover:translate-x-0.5'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Trading Section */}
          <div>
            <span className="block text-[10px] font-semibold text-text-dim uppercase tracking-[0.12em] px-3 mb-2">Trading</span>
            {tradingNav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) => 
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] no-underline mb-0.5 transition-all duration-150 ${
                    isActive 
                      ? 'bg-[rgba(79,142,247,0.08)] text-[#4f8ef7] border-l-2 border-l-[#4f8ef7] pl-[10px] font-semibold' 
                      : 'text-text-muted hover:bg-white/5 hover:text-white border-l-2 border-l-transparent hover:translate-x-0.5'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="relative p-3 border-t border-white/[0.07]">
          <div className="flex items-center gap-2.5 p-2.5 bg-[#111118] rounded-lg border border-white/[0.07]">
            {/* Avatar with initials in blue */}
            <div className="w-8 h-8 rounded-full bg-[rgba(79,142,247,0.1)] border border-[rgba(79,142,247,0.25)] flex items-center justify-center text-xs font-bold text-[#4f8ef7] shrink-0">
              {(user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-white truncate">
                {user?.user_metadata?.full_name || 'Trader'}
              </div>
              <div className="text-[10px] text-text-dim truncate">
                {user?.email?.slice(0, 20) || ''}
              </div>
            </div>
            
            <button 
              onClick={handleSignOut} 
              className="p-1.5 bg-[rgba(247,97,79,0.1)] border border-[rgba(247,97,79,0.2)] rounded-md text-[#f7614f] hover:bg-[rgba(247,97,79,0.15)] transition-colors shrink-0" 
              title="Sign out"
            >
              <LogOutIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-[100dvh] min-w-0 pt-14 md:pt-0 overflow-hidden bg-[#0a0a0f]">
        <div className="flex-1 overflow-auto">
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

function VertexLogo({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`transition-all duration-300 ${className}`}>
      {/* Circle at top - the vertex point */}
      <circle cx="12" cy="4.5" r="2.5" fill="#4f8ef7" />
      {/* Triangle/chevron shape */}
      <path 
        d="M4 8.5 L12 21 L20 8.5 L16 8.5 L12 14.5 L8 8.5 Z" 
        fill="#2d5a9e" 
      />
      <path 
        d="M12 21 L20 8.5 L16 8.5 L12 14.5 Z" 
        fill="#1e3f6e" 
      />
    </svg>
  )
}
