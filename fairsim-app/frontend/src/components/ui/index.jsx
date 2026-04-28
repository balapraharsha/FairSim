import React from 'react'

export const T = {
  red:'#EF4444', amber:'#F59E0B', green:'#22C55E', indigo:'#6366F1',
  text:'#E2E8F0', sub:'#94A3B8', muted:'#64748B', hint:'#475569',
  border:'#1E293B', card:'#161F2E', bg:'#0F172A', line:'#1A2537',
}

export const scoreColor = (s) => s==null?T.muted:s>=75?T.green:s>=50?T.amber:T.red
export const riskLabel  = (s) => s>=75?'Low Risk':s>=50?'Medium Risk':'High Risk'

export function ScoreRing({ score, size=100, label='FairScore' }) {
  const r=size/2-8, circ=2*Math.PI*r, s=score??0, col=scoreColor(s)
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
      <div style={{position:'relative',width:size,height:size}}>
        <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={6}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6}
            strokeDasharray={circ} strokeDashoffset={circ-(s/100)*circ}
            strokeLinecap="round" style={{transition:'stroke-dashoffset 1s ease'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <div style={{fontSize:Math.round(size*.26),fontWeight:600,color:col,lineHeight:1}}>{score??'—'}</div>
          <div style={{fontSize:9,color:T.hint,marginTop:2,textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</div>
        </div>
      </div>
      {score!=null&&<div style={{fontSize:10,color:col,fontWeight:500,marginTop:4}}>{riskLabel(s)}</div>}
    </div>
  )
}

export function Card({ children, style={}, accent }) {
  return (
    <div style={{background:T.card,border:`1px solid ${accent||T.border}`,borderRadius:10,padding:'16px 18px',marginBottom:10,...style}}>
      {children}
    </div>
  )
}

export function PageHeader({ tag, title, sub }) {
  return (
    <div style={{marginBottom:24}}>
      <div style={{fontSize:11,fontWeight:600,color:T.indigo,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>{tag}</div>
      <div style={{fontSize:20,fontWeight:600,color:T.text,letterSpacing:'-0.01em',marginBottom:sub?6:0}}>{title}</div>
      {sub&&<div style={{fontSize:13,color:T.muted,lineHeight:1.6}}>{sub}</div>}
    </div>
  )
}

export function Stat({ label, value, color='default' }) {
  const colors={red:T.red,green:T.green,amber:T.amber,cyan:'#22D3EE',blue:'#818CF8',default:T.text}
  return (
    <div style={{background:T.bg,borderRadius:8,padding:'12px 14px'}}>
      <div style={{fontSize:10,color:T.hint,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>{label}</div>
      <div style={{fontSize:20,fontWeight:600,color:colors[color]||T.text}}>{value}</div>
    </div>
  )
}

export const StatCard = Stat

export function Btn({ children, onClick, disabled, variant='primary', style={}, fullWidth }) {
  const base={padding:'9px 20px',borderRadius:7,fontSize:13,fontWeight:500,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.4:1,border:'none',letterSpacing:'0.01em',width:fullWidth?'100%':undefined,display:'inline-block',transition:'opacity .15s'}
  const v={primary:{background:'#4F46E5',color:'#fff'},outline:{background:'transparent',color:T.sub,border:`1px solid ${T.border}`}}
  return <button onClick={onClick} disabled={disabled} style={{...base,...(v[variant]||v.primary),...style}}>{children}</button>
}

export function ProgressBar({ pct, color='#6366F1', label }) {
  return (
    <div style={{marginTop:10}}>
      <div style={{height:3,background:T.border,borderRadius:2,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:2,transition:'width .5s'}}/>
      </div>
      {label&&<div style={{fontSize:11,color:T.hint,marginTop:5}}>{label}</div>}
    </div>
  )
}

export function Spinner({ text='Processing...' }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'32px 0',color:T.hint,fontSize:13}}>
      <style>{`@keyframes fspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:14,height:14,border:`2px solid ${T.border}`,borderTopColor:T.indigo,borderRadius:'50%',animation:'fspin .7s linear infinite',flexShrink:0}}/>
      {text}
    </div>
  )
}

export function Empty({ title, sub, action }) {
  return (
    <Card>
      <div style={{textAlign:'center',padding:'28px 0'}}>
        <div style={{fontSize:13,fontWeight:500,color:T.sub,marginBottom:6}}>{title}</div>
        {sub&&<div style={{fontSize:12,color:T.hint,marginBottom:14}}>{sub}</div>}
        {action}
      </div>
    </Card>
  )
}

export function Badge({ children, color='blue' }) {
  const m={red:['rgba(239,68,68,.1)','#FCA5A5'],green:['rgba(34,197,94,.1)','#86EFAC'],amber:['rgba(245,158,11,.1)','#FCD34D'],blue:['rgba(99,102,241,.1)','#A5B4FC'],cyan:['rgba(34,211,238,.1)','#67E8F9']}
  const [bg,text]=m[color]||m.blue
  return <span style={{background:bg,color:text,fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:20,display:'inline-block'}}>{children}</span>
}

export function Bar({ label, value, max=100, color=T.green }) {
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
        <span style={{color:T.sub}}>{label}</span>
        <span style={{fontWeight:600,color}}>{value}%</span>
      </div>
      <div style={{height:5,background:T.border,borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${Math.min(100,(value/max)*100)}%`,background:color,borderRadius:3,transition:'width .7s'}}/>
      </div>
    </div>
  )
}

export function Divider() {
  return <div style={{borderTop:`1px solid ${T.line}`,margin:'12px 0'}}/>
}

export function SectionLabel({ children }) {
  return <div style={{fontSize:10,fontWeight:600,color:T.hint,textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:10}}>{children}</div>
}

export function Tag({ label }) {
  return <div style={{fontSize:11,fontWeight:600,color:T.indigo,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>{label}</div>
}

export function Title({ children }) {
  return <div style={{fontSize:20,fontWeight:600,color:T.text,letterSpacing:'-0.01em',marginBottom:4}}>{children}</div>
}

export function Sub({ children }) {
  return <div style={{fontSize:13,color:T.muted,lineHeight:1.6,marginBottom:16}}>{children}</div>
}
