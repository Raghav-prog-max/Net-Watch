export default function StitchLayout() {
  return (
    <>

{/*  ==========================================  */}
{/*  1. SIDEBAR (Predicted Shared Rail Component)  */}
{/*  ==========================================  */}
<aside className="fixed left-0 top-0 bottom-0 w-60 z-40 flex flex-col justify-between py-4 bg-[#0E0E12] hairline-border-r select-none">
{/*  Top Branding & Navigation  */}
<div className="flex flex-col">
{/*  Brand Header  */}
<div className="px-5 pb-5 flex items-center gap-3 hairline-border-b">
<div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
<span className="text-black font-headline-md font-extrabold leading-none tracking-tight">N</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-1.5">
<span className="text-white font-headline-sm font-bold tracking-tight text-sm">NetWatch</span>
</div>
<span className="font-mono text-[10px] text-[#8E909B] tracking-[0.18em] uppercase font-semibold">AI SEC-OPS</span>
</div>
</div>
{/*  Main Navigation Rail Links  */}
<nav className="mt-4 flex flex-col space-y-0.5">
{/*  Dashboard (Active)  */}
<a className="flex items-center gap-3 px-5 py-2.5 text-white bg-[#141418] border-l-2 border-white font-semibold transition-all duration-150" href="#dashboard">
<span className="material-symbols-outlined text-[19px]" style={{"fontVariationSettings": "'FILL' 1"}}>dashboard</span>
<span className="text-xs tracking-wide">Dashboard</span>
</a>
{/*  Alerts  */}
<a className="flex items-center justify-between px-5 py-2.5 text-[#8E909B] hover:bg-[#141418] hover:text-white transition-colors duration-150 group" href="#alerts">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-[19px] group-hover:text-white transition-colors">notifications_active</span>
<span className="text-xs tracking-wide">Alerts</span>
</div>
<span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-[#1A1A20] text-[#E1E4EA] border border-white/10">14</span>
</a>
{/*  Evaluation  */}
<a className="flex items-center gap-3 px-5 py-2.5 text-[#8E909B] hover:bg-[#141418] hover:text-white transition-colors duration-150 group" href="#evaluation">
<span className="material-symbols-outlined text-[19px] group-hover:text-white transition-colors">fact_check</span>
<span className="text-xs tracking-wide">Evaluation</span>
</a>
{/*  Drift  */}
<a className="flex items-center gap-3 px-5 py-2.5 text-[#8E909B] hover:bg-[#141418] hover:text-white transition-colors duration-150 group" href="#drift">
<span className="material-symbols-outlined text-[19px] group-hover:text-white transition-colors">timeline</span>
<span className="text-xs tracking-wide">Drift</span>
</a>
{/*  Models  */}
<a className="flex items-center gap-3 px-5 py-2.5 text-[#8E909B] hover:bg-[#141418] hover:text-white transition-colors duration-150 group" href="#models">
<span className="material-symbols-outlined text-[19px] group-hover:text-white transition-colors">model_training</span>
<span className="text-xs tracking-wide">Models</span>
</a>
</nav>
</div>
{/*  Promo Box & Footer Links  */}
<div className="px-4 flex flex-col gap-4">
{/*  Escalate Incident Card  */}
<div className="p-4 rounded-xl bg-[#141418] border border-white/10 flex flex-col">
<div className="flex items-center gap-2 mb-1.5">
<span className="material-symbols-outlined text-white text-[16px]">crisis_alert</span>
<span className="font-mono text-[10px] text-[#E1E4EA] uppercase tracking-wider font-semibold">Escalate Incident</span>
</div>
<p className="text-body-sm text-[#8E909B] text-[11px] leading-relaxed mb-3">High confidence SYN flood requires Tier-3 intervention.</p>
<button className="w-full py-2 px-3 rounded-full bg-white text-black font-sans font-bold text-xs tracking-tight shadow-sm hover:bg-[#E1E4EA] transition-all text-center" onClick={() => {}}>
        Review Alerts to Escalate →
      </button>
</div>
{/*  Footer Rail Links  */}
<div className="pt-2 hairline-border-t flex flex-col space-y-1">
<a className="flex items-center gap-2.5 px-3 py-1.5 text-[#8E909B] hover:text-white text-xs transition-colors" href="#landing">
<span className="material-symbols-outlined text-[17px]">public</span>
<span>Landing Page</span>
</a>
<a className="flex items-center gap-2.5 px-3 py-1.5 text-[#8E909B] hover:text-white text-xs transition-colors" href="#logout">
<span className="material-symbols-outlined text-[17px]">logout</span>
<span>Log out</span>
</a>
</div>
</div>
</aside>
{/*  ==========================================  */}
{/*  2. TOP NAVIGATION BAR (Predicted Component)  */}
{/*  ==========================================  */}
<header className="sticky top-0 z-30 flex items-center justify-between px-6 h-16 w-full pl-64 bg-[#050508]/90 hairline-border-b backdrop-blur-md">
{/*  Greeting & SecOps Status  */}
<div className="flex flex-col">
<div className="flex items-center gap-2">
<h1 className="text-sm font-semibold text-white tracking-tight">Hello, Sarah Analyst</h1>
<span className="text-xs text-[#8E909B]">•</span>
<span className="font-mono text-[11px] text-[#8E909B]">NODE-ONLINE</span>
</div>
<p className="text-[11px] text-[#8E909B]">Real-time network intrusion monitoring &amp; automated triage</p>
</div>
{/*  Search, Quick-Actions, and Analyst Profile  */}
<div className="flex items-center gap-4">
{/*  Search Input  */}
<div className="relative w-80">
<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
<span className="material-symbols-outlined text-[#656773] text-[17px]">search</span>
</div>
<input className="w-full pl-9 pr-14 py-1.5 rounded-full bg-[#0E0E12] border border-white/10 font-mono text-xs text-white placeholder:text-[#656773] focus:border-white/30 focus:ring-0 outline-none transition-all" placeholder="Search threats, IPs, tags..." type="text"/>
<div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
<kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#1A1A20] border border-white/10 text-[#8E909B]">⌘K</kbd>
</div>
</div>
{/*  Notification Action  */}
<button className="relative p-2 rounded-full hover:bg-[#141418] text-[#8E909B] hover:text-white transition-colors">
<span className="material-symbols-outlined text-[20px]">notifications</span>
<span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white"></span>
</button>
{/*  User Avatar / Profile  */}
<div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
<div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#1A1A20] border border-white/20 text-white font-mono font-bold text-xs">
        SA
        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-white ring-2 ring-[#050508]"></span>
</div>
<div className="hidden xl:flex flex-col">
<span className="text-xs font-semibold text-white leading-tight">Sarah Analyst</span>
<span className="text-[10px] font-mono text-[#8E909B]">Tier-2 SecOps</span>
</div>
</div>
</div>
</header>
{/*  ==========================================  */}
{/*  MAIN LAYOUT: WORKSPACE (Central + Right Rail)  */}
{/*  ==========================================  */}
<main className="pl-60 pr-0 pt-0 flex min-h-[calc(100vh-4rem)] bg-[#050508]">
{/*  CENTRAL WORKSPACE (3. Main Dashboard Area)  */}
<div className="flex-1 p-6 flex flex-col gap-6 max-w-[calc(100vw-240px-380px)] overflow-x-hidden">
{/*  Top KPI Metric Cards (3 Columns)  */}
<div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
{/*  Card 1: Critical Threats Active  */}
<div className="p-5 rounded-2xl bg-[#0E0E12] border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all">
<div className="flex items-center justify-between mb-3">
<span className="text-xs font-medium text-[#8E909B]">Critical Threats Active</span>
<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-black tracking-wide">
            ACTION REQ
          </span>
</div>
<div className="flex items-baseline gap-3">
<span className="text-3xl font-bold font-sans text-white tracking-tight">28</span>
<span className="flex items-center text-xs font-mono text-[#E1E4EA] font-semibold">
<span className="material-symbols-outlined text-sm mr-0.5">trending_up</span>
            +14% / hr
          </span>
</div>
<p className="text-xs text-[#8E909B] mt-2">Requires immediate containment protocols</p>
</div>
{/*  Card 2: Awaiting Triage  */}
<div className="p-5 rounded-2xl bg-[#0E0E12] border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all">
<div className="flex items-center justify-between mb-3">
<span className="text-xs font-medium text-[#8E909B]">Awaiting Triage</span>
<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#1A1A20] text-white border border-white/10">
            NOMINAL
          </span>
</div>
<div className="flex items-baseline gap-3">
<span className="text-3xl font-bold font-sans text-white tracking-tight">142</span>
<span className="flex items-center text-xs font-mono text-[#8E909B]">
<span className="material-symbols-outlined text-sm mr-0.5">trending_down</span>
            -5% backlog
          </span>
</div>
<p className="text-xs text-[#8E909B] mt-2">Mean inspection time: 4.2 mins / cluster</p>
</div>
{/*  Card 3: Unknown Novel Hits  */}
<div className="p-5 rounded-2xl bg-[#0E0E12] border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all">
<div className="flex items-center justify-between mb-3">
<span className="text-xs font-medium text-[#8E909B]">Unknown (Never Seen)</span>
<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/10 text-white border border-white/20">
            ZERO-DAY
          </span>
</div>
<div className="flex items-baseline gap-3">
<span className="text-3xl font-bold font-sans text-white tracking-tight">9</span>
<span className="flex items-center text-xs font-mono text-white">
<span className="material-symbols-outlined text-sm mr-0.5">blur_on</span>
            9 Novel Sig
          </span>
</div>
<p className="text-xs text-[#8E909B] mt-2">Unsupervised autoencoder anomaly hits</p>
</div>
</div>
{/*  Main Threat Chart: Network Alert Volume & Severity Distribution  */}
<div className="p-6 rounded-2xl bg-[#0E0E12] border border-white/10 flex flex-col gap-4">
{/*  Chart Header & Interactive Controls  */}
<div className="flex flex-wrap items-center justify-between gap-4">
<div className="flex flex-col">
<h2 className="text-base font-bold text-white tracking-tight">Network Alert Volume &amp; Severity Distribution</h2>
<p className="text-xs text-[#8E909B]">Real-time aggregate ingress packets scrutinized across edge gateways</p>
</div>
<div className="flex items-center gap-4">
{/*  Range Selector Pills  */}
<div className="flex bg-[#050508] p-1 rounded-full border border-white/10 text-xs">
<button className="px-3 py-1 rounded-full text-[#8E909B] hover:text-white transition-colors">1H</button>
<button className="px-3 py-1 rounded-full text-[#8E909B] hover:text-white transition-colors">6H</button>
<button className="px-3 py-1 rounded-full bg-white text-black font-semibold shadow-sm">24H</button>
<button className="px-3 py-1 rounded-full text-[#8E909B] hover:text-white transition-colors">7D</button>
</div>
{/*  Legends  */}
<div className="flex items-center gap-3 text-xs font-mono text-[#8E909B]">
<div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white"></span> Critical</div>
<div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#8E909B]"></span> High</div>
<div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#35353F]"></span> Novel/Low</div>
</div>
</div>
</div>
{/*  High-Fidelity Monochromatic Technical SVG Area Graph  */}
<div className="relative w-full h-64 mt-1">
<svg className="w-full h-full overflow-visible" fill="none" preserveAspectRatio="none" viewBox="0 0 800 240">
<defs>
{/*  White/Silver Area Gradient  */}
<linearGradient id="whiteGlow" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.25"></stop>
<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0"></stop>
</linearGradient>
{/*  Dark Slate Area Gradient  */}
<linearGradient id="slateGlow" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stop-color="#8E909B" stop-opacity="0.18"></stop>
<stop offset="100%" stop-color="#8E909B" stop-opacity="0.0"></stop>
</linearGradient>
</defs>
{/*  Gridlines  */}
<line stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" x1="0" x2="800" y1="40" y2="40"></line>
<line stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" x1="0" x2="800" y1="100" y2="100"></line>
<line stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" x1="0" x2="800" y1="160" y2="160"></line>
<line stroke="rgba(255, 255, 255, 0.12)" x1="0" x2="800" y1="220" y2="220"></line>
{/*  Slate Wave (Baseline & High Threats)  */}
<path d="M0,180 C80,170 140,195 220,150 C300,105 380,165 480,120 C580,75 660,135 740,95 L800,80 L800,220 L0,220 Z" fill="url(#slateGlow)"></path>
<path d="M0,180 C80,170 140,195 220,150 C300,105 380,165 480,120 C580,75 660,135 740,95 L800,80" stroke="#8E909B" strokeLinecap="round" strokeWidth="2"></path>
{/*  Stark White Spikes (Critical Surges)  */}
<path d="M0,210 C100,210 180,205 240,170 C290,140 330,60 380,50 C430,40 470,140 540,160 C620,180 700,90 760,40 L800,45 L800,220 L0,220 Z" fill="url(#whiteGlow)"></path>
<path d="M0,210 C100,210 180,205 240,170 C290,140 330,60 380,50 C430,40 470,140 540,160 C620,180 700,90 760,40 L800,45" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="2"></path>
{/*  Precision Monochromatic Markers  */}
<circle className="glow-pulse-mono" cx="380" cy="50" fill="#FFFFFF" r="4.5"></circle>
<circle cx="380" cy="50" opacity="0.4" r="8" stroke="#FFFFFF" strokeWidth="1.5"></circle>
<circle cx="760" cy="40" fill="#FFFFFF" r="4.5"></circle>
<circle cx="220" cy="150" fill="#8E909B" r="3.5"></circle>
<circle cx="540" cy="160" fill="#E1E4EA" r="3.5"></circle>
</svg>
</div>
{/*  Time Interval X-Axis  */}
<div className="flex justify-between font-mono text-[11px] text-[#656773] px-1">
<span>00:00</span>
<span>04:00</span>
<span>08:00</span>
<span>12:00</span>
<span className="text-[#E1E4EA]">14:00 (Peak SYN Flood)</span>
<span>16:00</span>
<span>20:00</span>
<span className="text-white">Live Now</span>
</div>
</div>
{/*  Lower Detail Cards (2 Columns)  */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{/*  Card A: Drift Monitoring & Model Health  */}
<div className="p-5 rounded-2xl bg-[#0E0E12] border border-white/10 flex flex-col justify-between">
<div>
<div className="flex items-center justify-between mb-3">
<span className="text-xs font-medium text-[#8E909B]">Drift Monitoring &amp; Model Health</span>
<span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#1A1A20] text-white border border-white/10">v4.8.2-PROD</span>
</div>
<div className="flex items-baseline gap-2 mb-1">
<span className="font-mono text-sm text-white font-bold">Data Drift Score: 0.042</span>
<span className="text-[11px] font-mono text-[#E1E4EA] font-medium">(Normal)</span>
</div>
<p className="text-xs text-[#8E909B]">Kolmogorov-Smirnov feature shift within baseline tolerance (&lt; 0.15 threshold).</p>
</div>
<div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="w-1.5 h-1.5 rounded-full bg-white"></span>
<span className="text-xs text-white">Embeddings Latency</span>
</div>
<div className="font-mono text-xs text-[#8E909B]">14.8 ms / inference</div>
</div>
</div>
{/*  Card B: False Positive Budget & SRE Quota  */}
<div className="p-5 rounded-2xl bg-[#0E0E12] border border-white/10 flex flex-col justify-between">
<div>
<div className="flex items-center justify-between mb-3">
<span className="text-xs font-medium text-[#8E909B]">False Positive Budget &amp; SRE Quota</span>
<span className="font-mono text-[10px] text-white px-2 py-0.5 rounded bg-white/10 border border-white/10">Within Budget</span>
</div>
<div className="flex items-baseline gap-2 mb-2">
<span className="font-mono text-sm text-white font-bold">FP Rate: 1.2%</span>
<span className="text-xs text-[#8E909B] font-mono">/ 5.0% threshold</span>
</div>
{/*  Monochromatic Progress Bar  */}
<div className="w-full bg-[#1A1A20] h-2 rounded-full overflow-hidden border border-white/5">
<div className="bg-white h-full rounded-full" style={{"width": "24%"}}></div>
</div>
</div>
<div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-white text-[15px]">verified</span>
<span className="text-xs text-white">Precision Metric</span>
</div>
<span className="font-mono text-xs text-[#E1E4EA]">94.8% across 28,490 flows</span>
</div>
</div>
</div>
</div>
{/*  ==========================================  */}
{/*  RIGHT RAIL (4. Live Alert Feed, ~380px)     */}
{/*  ==========================================  */}
<aside className="w-[380px] bg-[#0E0E12] hairline-border-l flex flex-col h-[calc(100vh-4rem)] sticky top-16 select-none">
{/*  Feed Header  */}
<div className="p-4 hairline-border-b flex items-center justify-between">
<div className="flex items-center gap-2.5">
<span className="relative flex h-2 w-2">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60"></span>
<span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
</span>
<h2 className="text-xs font-bold text-white tracking-wider uppercase font-mono">Live Alert Feed</h2>
</div>
<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-white border border-white/20">
        14 Queue
      </span>
</div>
{/*  Filter Tabs (Pill Buttons)  */}
<div className="px-4 py-2.5 hairline-border-b flex gap-1.5 overflow-x-auto text-xs">
<button className="px-3 py-1 rounded-full bg-white text-black font-semibold whitespace-nowrap shadow-sm">All (14)</button>
<button className="px-3 py-1 rounded-full bg-[#141418] border border-white/10 text-[#8E909B] hover:text-white whitespace-nowrap transition-colors">Critical (5)</button>
<button className="px-3 py-1 rounded-full bg-[#141418] border border-white/10 text-[#8E909B] hover:text-white whitespace-nowrap transition-colors">Zero-Day (3)</button>
</div>
{/*  Scrollable List of Threat Flow Cards  */}
<div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scroll">
{/*  Alert Card 1 (DDoS SYN Flood - Critical)  */}
<div className="p-4 rounded-xl bg-[#141418] border border-white/20 hover:border-white transition-all duration-150 flex flex-col gap-2.5">
<div className="flex items-start justify-between">
<span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-black">
            CRITICAL
          </span>
<div className="flex items-center gap-1 font-mono text-xs text-white font-semibold">
<span className="material-symbols-outlined text-[14px]">bolt</span> 98.4%
          </div>
</div>
<div>
<h3 className="text-xs font-bold text-white tracking-tight">DDoS SYN Flood Exploit</h3>
<span className="text-[11px] font-mono text-[#8E909B]">T1498.001 • 2m ago</span>
</div>
<div className="p-2 rounded bg-[#050508] border border-white/10 font-mono text-[11px] text-[#E1E4EA] select-all">
          SRC: 198.51.100.42 → DST: 10.0.4.12:443 (TCP)
        </div>
<div className="flex items-center justify-between pt-1">
<span className="text-[10px] font-mono text-[#8E909B]">STATUS: <strong className="text-white">OPEN</strong></span>
<div className="flex items-center gap-1.5">
<button className="px-2.5 py-1 rounded-full bg-[#1A1A20] text-[#8E909B] hover:text-white text-xs border border-white/5 transition-colors">Dismiss</button>
<button className="px-3 py-1 rounded-full bg-white text-black font-bold text-xs shadow hover:bg-[#E1E4EA] transition-all" onClick={() => {}}>Investigate →</button>
</div>
</div>
</div>
{/*  Alert Card 2 (Cobalt Strike - High)  */}
<div className="p-4 rounded-xl bg-[#141418] border border-white/10 hover:border-white/30 transition-all duration-150 flex flex-col gap-2.5">
<div className="flex items-start justify-between">
<span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#1A1A20] text-white border border-white/20">
            HIGH
          </span>
<div className="flex items-center gap-1 font-mono text-xs text-[#E1E4EA] font-semibold">
<span className="material-symbols-outlined text-[14px]">analytics</span> 94.1%
          </div>
</div>
<div>
<h3 className="text-xs font-bold text-white tracking-tight">Cobalt Strike Beaconing</h3>
<span className="text-[11px] font-mono text-[#8E909B]">T1071.001 • 8m ago</span>
</div>
<div className="p-2 rounded bg-[#050508] border border-white/10 font-mono text-[11px] text-[#8E909B] select-all">
          SRC: 172.16.88.19 → DST: 45.33.32.156:8080 (HTTPS)
        </div>
<div className="flex items-center justify-between pt-1">
<span className="text-[10px] font-mono text-[#8E909B]">STATUS: <strong className="text-[#E1E4EA]">INVESTIGATING</strong></span>
<div className="flex items-center gap-1.5">
<button className="px-2.5 py-1 rounded-full bg-[#1A1A20] text-[#8E909B] hover:text-white text-xs border border-white/5 transition-colors">Dismiss</button>
<button className="px-3 py-1 rounded-full bg-white text-black font-bold text-xs hover:bg-[#E1E4EA] transition-all" onClick={() => {}}>Investigate →</button>
</div>
</div>
</div>
{/*  Alert Card 3 (DNS Tunneling - Novel)  */}
<div className="p-4 rounded-xl bg-[#141418] border border-white/10 hover:border-white/30 transition-all duration-150 flex flex-col gap-2.5">
<div className="flex items-start justify-between">
<span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/10 text-white border border-white/20">
            NOVEL
          </span>
<div className="flex items-center gap-1 font-mono text-xs text-[#E1E4EA] font-semibold">
<span className="material-symbols-outlined text-[14px]">fingerprint</span> 89.7%
          </div>
</div>
<div>
<h3 className="text-xs font-bold text-white tracking-tight">DNS Tunneling Exfiltration</h3>
<span className="text-[11px] font-mono text-[#8E909B]">T1048.003 • 14m ago</span>
</div>
<div className="p-2 rounded bg-[#050508] border border-white/10 font-mono text-[11px] text-[#8E909B] select-all">
          SRC: 10.0.12.91 → DST: 8.8.8.8:53 (UDP)
        </div>
<div className="flex items-center justify-between pt-1">
<span className="text-[10px] font-mono text-[#8E909B]">STATUS: <strong className="text-white">OPEN</strong></span>
<div className="flex items-center gap-1.5">
<button className="px-2.5 py-1 rounded-full bg-[#1A1A20] text-[#8E909B] hover:text-white text-xs border border-white/5 transition-colors">Dismiss</button>
<button className="px-3 py-1 rounded-full bg-white text-black font-bold text-xs hover:bg-[#E1E4EA] transition-all" onClick={() => {}}>Investigate →</button>
</div>
</div>
</div>
{/*  Alert Card 4 (SSH Brute-Force)  */}
<div className="p-4 rounded-xl bg-[#141418] border border-white/5 hover:border-white/20 transition-all duration-150 flex flex-col gap-2.5">
<div className="flex items-start justify-between">
<span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#1A1A20] text-[#8E909B] border border-white/10">
            HIGH
          </span>
<div className="flex items-center gap-1 font-mono text-xs text-[#8E909B]">
<span className="material-symbols-outlined text-[14px]">key</span> 76.2%
          </div>
</div>
<div>
<h3 className="text-xs font-bold text-white tracking-tight">SSH Brute-Force Wave</h3>
<span className="text-[11px] font-mono text-[#8E909B]">T1110 • 22m ago</span>
</div>
<div className="p-2 rounded bg-[#050508] border border-white/5 font-mono text-[11px] text-[#656773] select-all">
          SRC: 203.0.113.11 → DST: 10.0.2.1:22 (SSH)
        </div>
<div className="flex items-center justify-between pt-1">
<span className="text-[10px] font-mono text-[#656773]">STATUS: <strong className="text-[#8E909B]">QUEUED</strong></span>
<div className="flex items-center gap-1.5">
<button className="px-2.5 py-1 rounded-full bg-[#1A1A20] text-[#8E909B] hover:text-white text-xs border border-white/5 transition-colors">Dismiss</button>
<button className="px-3 py-1 rounded-full bg-[#1A1A20] border border-white/20 text-white text-xs font-semibold hover:bg-white hover:text-black transition-all" onClick={() => {}}>Inspect →</button>
</div>
</div>
</div>
</div>
</aside>
</main>
{/*  ==========================================  */}
{/*  5. ALERT INSPECTOR MODAL ("Investigate" Overlay)  */}
{/*  ==========================================  */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg transition-opacity duration-200" id="inspectorModal">
<div className="relative w-full max-w-3xl rounded-2xl bg-[#0E0E12] border border-white/15 shadow-2xl overflow-hidden flex flex-col">
{/*  Modal Header  */}
<div className="p-6 hairline-border-b flex items-start justify-between bg-[#141418]">
<div className="flex flex-col gap-1.5">
<div className="flex items-center gap-2">
<span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-black">
            CRITICAL
          </span>
<span className="font-mono text-xs font-semibold text-white bg-[#1A1A20] border border-white/15 px-2.5 py-0.5 rounded">
            98.4% Confidence
          </span>
<span className="text-xs text-[#8E909B] font-mono">#NW-98214-X</span>
</div>
<h2 className="text-xl font-bold font-sans text-white tracking-tight mt-0.5">DDoS SYN Flood Exploit (T1498.001)</h2>
<span className="text-xs text-[#8E909B] font-mono">Timestamp: Today, 14:32:08 UTC • Origin: External Gateway AS-15169</span>
</div>
{/*  Close Button  */}
<button className="w-8 h-8 rounded-full flex items-center justify-center text-[#8E909B] hover:text-white hover:bg-[#1A1A20] border border-transparent hover:border-white/10 transition-colors" onClick={() => {}}>
<span className="material-symbols-outlined text-[18px]">close</span>
</button>
</div>
{/*  Modal Body (Forensic Details & SHAP)  */}
<div className="p-6 flex flex-col gap-5 max-h-[720px] overflow-y-auto custom-scroll bg-[#0E0E12]">
{/*  Monospace Network Telemetry Banner  */}
<div className="p-3.5 rounded-xl bg-[#050508] border border-white/15 font-mono text-xs text-[#E1E4EA] flex items-center justify-between">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-base text-white">router</span>
<span className="text-[12px] tracking-tight">SRC: 198.51.100.42:54892 → DST: 10.0.4.12:443 | PROTO: TCP | PKTS: 84,200/s | VOL: 1.4 GB</span>
</div>
<span className="px-2 py-0.5 text-[9px] rounded bg-white text-black font-mono font-bold tracking-widest uppercase">LIVE</span>
</div>
{/*  MITRE ATT&CK Mapping Box  */}
<div className="p-4 rounded-xl bg-[#141418] border border-white/10 flex flex-col gap-2">
<div className="flex items-center gap-2 text-xs font-bold font-mono text-white uppercase tracking-wider">
<span className="material-symbols-outlined text-base text-white">security</span>
<span>MITRE ATT&amp;CK Mapping</span>
</div>
<div className="text-xs text-[#E1E4EA] leading-relaxed">
<strong className="text-white font-semibold">Tactic:</strong> Impact &amp; Denial of Service • <strong className="text-white font-semibold">Technique:</strong> T1498.001 Direct Network Flooding
        </div>
<p className="text-xs text-[#8E909B] bg-[#0E0E12] p-3 rounded-lg border border-white/5 leading-relaxed">
<strong className="text-[#E1E4EA] font-medium">Automated Recommendation:</strong> Deploy perimeter ACL rate-limiting on edge gateway GW-04 and sinkhole source subnet via BGP Flowspec.
        </p>
</div>
{/*  SHAP Feature Attribution Panel  */}
<div className="flex flex-col gap-2.5 pt-1">
<div className="flex items-center justify-between">
<div>
<h4 className="text-xs font-bold text-white tracking-tight uppercase font-mono">SHAP Feature Attribution</h4>
<p className="text-[11px] text-[#8E909B]">Model explainability weights for XGBoost Ensemble v4</p>
</div>
<span className="font-mono text-[11px] text-[#656773]">Local Impact Weight (Φ)</span>
</div>
{/*  SHAP Bar Rows  */}
<div className="flex flex-col gap-2.5 bg-[#141418] p-4 rounded-xl border border-white/10">
{/*  Row 1  */}
<div className="flex items-center justify-between font-mono text-xs">
<span className="w-40 truncate text-[#E1E4EA]">dst_bytes_rate</span>
<div className="flex-1 mx-4 bg-[#050508] h-2 rounded-full overflow-hidden flex border border-white/5">
<div className="bg-white h-full rounded-full" style={{"width": "85%"}}></div>
</div>
<span className="text-white font-bold w-14 text-right">+0.542</span>
</div>
{/*  Row 2  */}
<div className="flex items-center justify-between font-mono text-xs">
<span className="w-40 truncate text-[#E1E4EA]">syn_ack_ratio</span>
<div className="flex-1 mx-4 bg-[#050508] h-2 rounded-full overflow-hidden flex border border-white/5">
<div className="bg-[#C4C6CB] h-full rounded-full" style={{"width": "65%"}}></div>
</div>
<span className="text-white font-bold w-14 text-right">+0.418</span>
</div>
{/*  Row 3  */}
<div className="flex items-center justify-between font-mono text-xs">
<span className="w-40 truncate text-[#E1E4EA]">flow_duration_ms</span>
<div className="flex-1 mx-4 bg-[#050508] h-2 rounded-full overflow-hidden flex border border-white/5">
<div className="bg-[#8E909B] h-full rounded-full" style={{"width": "45%"}}></div>
</div>
<span className="text-[#E1E4EA] font-semibold w-14 text-right">+0.285</span>
</div>
{/*  Row 4  */}
<div className="flex items-center justify-between font-mono text-xs">
<span className="w-40 truncate text-[#8E909B]">src_ip_reputation</span>
<div className="flex-1 mx-4 bg-[#050508] h-2 rounded-full overflow-hidden flex border border-white/5">
<div className="bg-[#656773] h-full rounded-full" style={{"width": "30%"}}></div>
</div>
<span className="text-[#8E909B] font-medium w-14 text-right">+0.194</span>
</div>
{/*  Row 5 (Negative Attribution)  */}
<div className="flex items-center justify-between font-mono text-xs">
<span className="w-40 truncate text-[#656773]">payload_entropy</span>
<div className="flex-1 mx-4 bg-[#050508] h-2 rounded-full overflow-hidden flex border border-white/5">
<div className="bg-[#35353F] h-full rounded-full" style={{"width": "12%"}}></div>
</div>
<span className="text-[#656773] font-normal w-14 text-right">-0.072</span>
</div>
</div>
</div>
</div>
{/*  Modal Footer (Triage Action Buttons)  */}
<div className="p-4 hairline-border-t bg-[#141418] flex items-center justify-between">
<button className="px-4 py-2 rounded-full bg-[#0E0E12] border border-white/15 text-white hover:bg-white hover:text-black text-xs font-semibold transition-all" onClick={() => {}}>
        Mark False Positive
      </button>
<div className="flex items-center gap-2.5">
<button className="px-4 py-2 rounded-full bg-[#1A1A20] text-[#8E909B] hover:text-white border border-white/10 text-xs font-semibold transition-all" onClick={() => {}}>
          Acknowledge
        </button>
<button className="px-4 py-2 rounded-full bg-[#23232A] text-white hover:bg-white/20 border border-white/20 text-xs font-bold flex items-center gap-1.5 transition-all" onClick={() => {}}>
<span className="material-symbols-outlined text-[15px]">emergency</span>
          Escalate to IR
        </button>
<button className="px-5 py-2 rounded-full bg-white text-black hover:bg-[#E1E4EA] text-xs font-bold flex items-center gap-1.5 shadow transition-all" onClick={() => {}}>
<span className="material-symbols-outlined text-[15px]">check_circle</span>
          Resolve Incident
        </button>
</div>
</div>
</div>
</div>
{/*  Inline Interaction Logic  */}


    </>
  );
}
