import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import useStore from '../../store'

const NAV = [
  { to:'/dashboard', label:'Dashboard'    },
  { to:'/upload',    label:'Upload & Train'},
  { to:'/attack',    label:'Attack Engine' },
  { to:'/heatmap',   label:'Bias Heatmap'  },
  { to:'/shap',      label:'SHAP Analysis' },
  { to:'/fix',       label:'Fix Engine'    },
  { to:'/whatif',    label:'What-If'       },
  { to:'/eli5',      label:'Explain'       },
  { to:'/report',    label:'Audit Report'  },
]

const ICONS = {
  'Dashboard':     'M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zM3 14h7v7H3z',
  'Upload & Train':'M12 3v12M8 11l4 4 4-4M4 19h16',
  'Attack Engine': 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'Bias Heatmap':  'M3 3h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4zM3 10h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4zM3 17h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4z',
  'SHAP Analysis': 'M3 17l5-5 4 4 9-9',
  'Fix Engine':    'M14.7 6.3a1 1 0 010 1.4L7.4 15l-3 1 1-3 7.3-7.3a1 1 0 011.4 0z',
  'What-If':       'M9 9a3 3 0 115.12 2.12C13.07 12.16 12 13 12 14m0 3v.5',
  'Explain':       'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'Audit Report':  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2',
}

function Icon({ d }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         style={{flexShrink:0}}>
      <path d={d}/>
    </svg>
  )
}

export default function Layout() {
  const { trainInfo, fixResult, fairscore, fixscore, reset } = useStore()
  const nav = useNavigate()
  const fs  = fairscore()
  const fxs = fixscore()
  const sc  = fxs ?? fs
  const col = sc==null?'#475569':sc>=75?'#22C55E':sc>=50?'#F59E0B':'#EF4444'

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#0F172A'}}>

      {/* ── Sidebar ── */}
      <aside style={{width:220,minWidth:220,background:'#111827',borderRight:'1px solid #1E293B',display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Logo */}
        <div style={{padding:'20px 18px 14px',borderBottom:'1px solid #1E293B'}}>
          <div style={{fontSize:15,fontWeight:600,color:'#E2E8F0',letterSpacing:'-0.01em'}}>FairSim</div>
          <div style={{fontSize:10,color:'#374151',letterSpacing:'0.1em',textTransform:'uppercase',marginTop:2}}>Bias Audit Platform</div>
        </div>

        {/* Score */}
        {trainInfo && (
          <div style={{padding:'10px 16px',borderBottom:'1px solid #1E293B'}}>
            <div style={{fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>
              {fxs!=null?'After Fix':'FairScore'}
            </div>
            <div style={{fontSize:24,fontWeight:600,color:col,lineHeight:1}}>{sc??'—'}</div>
            <div style={{height:3,background:'#1E293B',borderRadius:2,marginTop:6,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${sc??0}%`,background:col,borderRadius:2,transition:'width .8s'}}/>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{flex:1,overflowY:'auto',padding:'8px 8px'}}>
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:9, padding:'8px 10px',
                borderRadius:7, marginBottom:1, textDecoration:'none', fontSize:13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#A5B4FC' : '#6B7280',
                background: isActive ? 'rgba(99,102,241,.12)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(99,102,241,.3)' : 'transparent'}`,
                transition: 'all .15s',
              })}>
              <Icon d={ICONS[label]}/>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Reset */}
        <div style={{padding:'12px 16px',borderTop:'1px solid #1E293B'}}>
          <button onClick={()=>{reset();nav('/dashboard')}}
                  style={{background:'none',border:'none',color:'#374151',fontSize:11,cursor:'pointer',padding:0}}>
            Reset session
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{flex:1,overflowY:'auto',background:'#0F172A'}}>
        <div style={{maxWidth:1000,margin:'0 auto',padding:'32px 40px'}}>
          <Outlet/>
        </div>
      </main>

    </div>
  )
}