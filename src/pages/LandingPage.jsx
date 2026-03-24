import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Ultra-premium, zero-latency 3D mouse tracking tilt effect
function TiltElement({ children, className = '', maxAngle = 10, glare = false }) {
  const ref = useRef(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMouseMove = (e) => {
      const rect = el.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      const rotateX = ((y / h) - 0.5) * -maxAngle * 2
      const rotateY = ((x / w) - 0.5) * maxAngle * 2
      
      setRotation({ x: rotateX, y: rotateY })
      if (glare) {
        setGlarePos({ x: (x / w) * 100, y: (y / h) * 100 })
      }
    }

    const handleMouseEnter = () => setIsHovering(true)
    const handleMouseLeave = () => {
      setIsHovering(false)
      setRotation({ x: 0, y: 0 })
      setGlarePos({ x: 50, y: 50 })
    }

    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseenter', handleMouseEnter)
    el.addEventListener('mouseleave', handleMouseLeave)
    
    return () => {
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseenter', handleMouseEnter)
      el.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [maxAngle, glare])

  return (
    <div 
      ref={ref} 
      className={className} 
      style={{ 
        transform: `perspective(1500px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(${isHovering ? 1.02 : 1}, ${isHovering ? 1.02 : 1}, 1)`,
        transition: isHovering ? 'transform 0.1s cubic-bezier(0.1, 0.5, 0.3, 1)' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        transformStyle: 'preserve-3d'
      }}
    >
      {glare && isHovering && (
        <div 
          className="absolute inset-0 z-50 pointer-events-none rounded-[inherit]"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.1) 0%, transparent 60%)`,
            mixBlendMode: 'overlay',
          }}
        />
      )}
      {children}
    </div>
  )
}

export default function LandingPage() {
  const { user } = useAuth()

  // Minimal fade-up observer
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0')
          entry.target.classList.remove('opacity-0', 'translate-y-12')
        }
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' })

    document.querySelectorAll('.animate-fade').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-[#000000] text-white overflow-hidden font-sans selection:bg-accent/30 flex flex-col items-center">
      
      {/* Hyper-minimalist Dark Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#000000]/50 backdrop-blur-xl border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <VertexLogo size={24} />
            <span className="font-head text-xl font-bold tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">Vertex</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#ecosystem" className="text-sm font-medium text-white/50 hover:text-white transition-colors hidden md:block">Ecosystem</a>
            {user ? (
              <Link to="/dashboard" className="text-sm font-semibold text-white px-5 py-2 rounded-full border border-white/10 hover:bg-white hover:text-black transition-all">
                Dashboard
              </Link>
            ) : (
              <Link to="/auth" className="text-sm font-semibold text-white px-5 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white hover:text-black hover:scale-105 active:scale-95 transition-all">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Dark Hero Section - Spatial & Refractive */}
      <section className="relative w-full min-h-[100vh] flex flex-col items-center justify-center pt-24 pb-12 overflow-hidden bg-black selection:bg-white/20">
        
        {/* Subtle, precise grid */}
        <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTIwIDIwaDIwdjIwSDIweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')] opacity-40 bg-[length:32px_32px]" />
        
        {/* Ambient deep glow, no cheap blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-accent/10 blur-[150px] rounded-[100%] pointer-events-none mix-blend-screen" />

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl mx-auto w-full">
          
          {/* Refractive Interactive Object - The Vertex Glass Cube */}
          <TiltElement className="mb-16 cursor-crosshair animate-fade opacity-0 translate-y-12 transition-all duration-1000 ease-out" maxAngle={12} glare={true}>
            <div className="relative w-[180px] h-[180px] md:w-[240px] md:h-[240px] rounded-[2rem] md:rounded-[3rem] bg-gradient-to-b from-white/10 to-white/5 border border-white/10 backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_20px_60px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
              {/* Internal refractive structure */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              
              <VertexLogo size={120} className="filter drop-shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
              
              {/* Fake light reflections on the edges */}
              <div className="absolute -inset-10 bg-gradient-to-tr from-accent/20 via-transparent to-white/10 opacity-30 transform-gpu rotate-12 blur-xl" style={{ transform: 'translateZ(-50px)' }} />
            </div>
          </TiltElement>

          <div className="animate-fade opacity-0 translate-y-12 transition-all duration-1000 delay-100 ease-out flex flex-col items-center">
            <h1 className="font-head text-[4rem] sm:text-[5.5rem] md:text-[7.5rem] font-bold tracking-tighter leading-[0.95] text-white">
              Execute <span className="text-white/40 font-light italic tracking-tight">with</span> <br /> 
              Absolute Precision.
            </h1>
            
            <p className="mt-8 text-lg md:text-2xl text-white/50 max-w-2xl font-body font-light tracking-wide leading-relaxed">
              Institutional-grade speed. Retail accessibility. The ultimate Indian market terminal engineered inside a pristine glass architecture.
            </p>
            
            <Link to="/auth" className="mt-12 inline-flex items-center justify-center px-10 py-5 rounded-full bg-white text-black font-semibold text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_10px_40px_rgba(255,255,255,0.15)] hover:shadow-[0_15px_50px_rgba(255,255,255,0.3)] border border-transparent">
              View the Terminal
            </Link>
          </div>
        </div>
      </section>

      {/* Pristine White Showcase Section - High Contrast Institutional Look */}
      <section className="relative w-full py-32 bg-[#FAFAFA] text-[#111111] overflow-hidden border-t border-white/10">
        
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10 w-full">
          <div className="text-center mb-20 animate-fade opacity-0 translate-y-12 transition-all duration-1000 ease-out">
            <h2 className="font-head text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter mb-6">
              The Architecture of Edge.
            </h2>
            <p className="text-xl text-[#666] max-w-3xl mx-auto font-body font-light tracking-wide leading-relaxed">
              A unified pipeline mapping Zerodha, Groww, and real-time NIFTY options into a single, flawlessly rendering dashboard. 
            </p>
          </div>

          {/* Hyper-Premium Terminal Showcase on White */}
          <TiltElement className="animate-fade opacity-0 translate-y-12 transition-all duration-1000 delay-200 ease-out w-full" maxAngle={4} glare={true}>
            <div className="relative mx-auto max-w-6xl w-full rounded-[2rem] border border-[#E5E5E5] bg-white shadow-[0_40px_100px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
              
              {/* Mac-like Header */}
              <div className="h-12 border-b border-[#EAEAEA] bg-[#F9F9F9] flex items-center px-6 gap-2">
                <div className="w-3 h-3 rounded-full bg-[#E5E5E5] flex items-center justify-center hover:bg-[#ff5f56] transition-colors" />
                <div className="w-3 h-3 rounded-full bg-[#E5E5E5] flex items-center justify-center hover:bg-[#ffbd2e] transition-colors" />
                <div className="w-3 h-3 rounded-full bg-[#E5E5E5] flex items-center justify-center hover:bg-[#27c93f] transition-colors" />
                <div className="flex-1 text-center text-[10px] font-mono text-[#999] tracking-widest uppercase">Vertex Terminal Env</div>
              </div>
              
              {/* Inner Dark Terminal Window (beautiful contrast) */}
              <div className="p-4 md:p-8 bg-[#fafafa]">
                <div className="rounded-[1.5rem] border border-[#111]/10 bg-[#060B10] shadow-[inset_0_0_20px_rgba(0,0,0,1)] p-6 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                  
                  {/* Left Portfolio Main Panel */}
                  <div className="col-span-2 h-[420px] rounded-2xl border border-white/10 bg-[#0A1118]/80 flex flex-col p-8 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none rounded-[inherit]" />
                    <div className="flex justify-between items-start mb-12 relative z-10">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.15em] text-[#7da5bf] mb-3 font-semibold">Net Liquidating Value</div>
                        <div className="text-4xl md:text-5xl font-mono font-bold text-white tracking-tight">₹2,442,850.00</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono font-medium text-[#34d399] tracking-wider bg-[#34d399]/10 px-3 py-1.5 rounded-md border border-[#34d399]/20">
                          +₹84,200 (3.5%)
                        </div>
                      </div>
                    </div>
                    
                    {/* Minimalist Chart Line */}
                    <div className="flex-1 relative w-full mt-8">
                      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full stroke-accent/40 fill-accent/5">
                        <path d="M0,40 L0,30 Q15,35 25,20 T45,25 T65,10 T85,15 T100,5 L100,40 Z" strokeWidth="0" />
                        <path d="M0,30 Q15,35 25,20 T45,25 T65,10 T85,15 T100,5" fill="none" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {/* Grid lines inside chart */}
                      <div className="absolute inset-0 flex flex-col justify-between border-l border-white/5 pl-2 pb-2">
                        {[40, 30, 20, 10].map(v => <div key={v} className="border-b border-white/[0.02] w-full text-[9px] font-mono text-white/20">{v}k</div>)}
                      </div>
                    </div>
                  </div>

                  {/* Right Watchlist Panel */}
                  <div className="h-[420px] flex flex-col gap-3">
                    {[
                      { sym: 'NIFTY', p: '24,300.50', c: '+120.40', up: true },
                      { sym: 'RELIANCE', p: '3,120.00', c: '-15.20', up: false },
                      { sym: 'HDFCBANK', p: '1,640.25', c: '+8.30', up: true },
                      { sym: 'SENSEX', p: '79,800.00', c: '+350.00', up: true },
                      { sym: 'INFY', p: '1,420.50', c: '-12.10', up: false },
                    ].map((s,i) => (
                      <div key={i} className="flex-1 rounded-xl border border-white/5 bg-white/[0.02] p-4 flex justify-between items-center hover:bg-white/[0.04] transition-colors cursor-pointer group">
                        <div>
                          <div className="font-head font-bold text-[14px] text-white tracking-wide group-hover:text-accent transition-colors">{s.sym}</div>
                          <div className="font-mono text-[10px] text-[#7da5bf]/70 tracking-widest mt-0.5">NSE</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-[14px] font-medium text-white mb-0.5">{s.p}</div>
                          <div className={`font-mono text-[11px] ${s.up ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>{s.c}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TiltElement>
        </div>
      </section>

      {/* Bento Box Dark Ecosystem Section */}
      <section id="ecosystem" className="relative w-full py-32 bg-[#000000] text-white border-t border-[#111]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <BentoCard 
              title="Fluid Interface"
              desc="Forget clunky broker layouts. Vertex uses a unified glassmorphic design language rendering at blinding 120fps."
              className="md:col-span-2"
              delay="0"
            />
            <BentoCard 
              title="Zero-Latency"
              desc="Mock pipelines syncing directly with NSE/BSE websocket APIs for true market simulation without the financial risk."
              className="md:col-span-1"
              delay="100"
            />
            <BentoCard 
              title="Cryptographic Edge"
              desc="Bank-grade encryption handling your broker API keys, ensuring complete anonymity and rapid transaction firing exactly when you click."
              className="md:col-span-3"
              delay="200"
            />
          </div>
        </div>
      </section>

      {/* Minimalist Footer */}
      <footer className="w-full bg-[#000] text-white/40 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <VertexLogo size={20} className="opacity-50" />
            <span className="font-mono text-xs uppercase tracking-widest font-semibold">Vertex Trading Systems</span>
          </div>
          <div className="font-mono text-xs tracking-wider">
            © {new Date().getFullYear()} // ALL SYSTEMS OPERATIONAL
          </div>
        </div>
      </footer>

    </div>
  )
}

function BentoCard({ title, desc, className, delay }) {
  return (
    <div className={`p-10 rounded-[2rem] bg-white/[0.01] border border-white/5 flex flex-col justify-end min-h-[250px] animate-fade opacity-0 translate-y-12 transition-all duration-1000 ease-out hover:bg-white/[0.02] hover:border-white/10 group ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      <div>
        <h3 className="font-head text-2xl font-bold text-white mb-3 tracking-tight group-hover:text-accent transition-colors">{title}</h3>
        <p className="text-white/40 text-[15px] leading-relaxed font-body tracking-wide font-light max-w-2xl">{desc}</p>
      </div>
    </div>
  )
}

function VertexLogo({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="5.5" r="3.5" fill="#38bdf8" />
      <path d="M4 9.5 L12 22 L20 9.5 L15.5 9.5 L12 15 L8.5 9.5 Z" fill="#296a84" />
      <path d="M12 22 L20 9.5 L15.5 9.5 L12 15 Z" fill="#1b4d63" />
    </svg>
  )
}
