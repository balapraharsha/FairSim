import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useStore from '../store'
import { runAttack } from '../utils/api'
import { Card, PageHeader, Btn, Spinner, Empty, Badge, Bar, T, SectionLabel } from '../components/ui'

const MODES = [
  { value:'counterfactual', label:'Counterfactual',     desc:'Flip one feature. If decision changes — bias confirmed.' },
  { value:'intersection',   label:'Intersection',       desc:'Combine disadvantaged features. Find compounding bias.' },
  { value:'adversarial',    label:'Adversarial Search',  desc:'AI finds the worst-case combination automatically.' },
]

export default function AttackPage() {
  const [mode, setMode]    = useState('counterfactual')
  const [loading, setLoad] = useState(false)
  const { sessionId, trainInfo, setAttack, attackResult, attackMode } = useStore()
  const nav = useNavigate()

  const fire = async () => {
    if (!sessionId || !trainInfo) { toast.error('Train a model first'); return }
    setLoad(true)
    try { const res = await runAttack(sessionId, mode); setAttack(res.result, res.mode); toast.success('Attack complete') }
    catch(e) { toast.error(String(e)) }
    finally { setLoad(false) }
  }

  const result   = attackResult
  const isActive = attackMode === mode

  return (
    <div style={{ maxWidth:760 }}>
      <PageHeader tag="Attack Engine" title="Bias Penetration Test" sub="Choose an attack mode and probe your model for hidden fairness violations."/>
      {!trainInfo && <Empty title="Train a model first" action={<Btn onClick={()=>nav('/upload')}>Upload & Train</Btn>}/>}
      {trainInfo && (
        <>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12 }}>
            {MODES.map(({ value, label, desc }) => (
              <div key={value} onClick={()=>setMode(value)} style={{ border:`1px solid ${mode===value?'#22D3EE':'#334155'}`,borderRadius:9,padding:'14px',cursor:'pointer',background:mode===value?'rgba(34,211,238,.05)':'#161F2E',transition:'all .15s' }}>
                <div style={{ fontSize:12,fontWeight:500,color:mode===value?'#67E8F9':T.text,marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:11,color:'#64748B',lineHeight:1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
          <Btn onClick={fire} disabled={loading} fullWidth style={{ padding:'10px 0',marginBottom:12 }}>
            {loading?'Running attack...':`Run ${MODES.find(m=>m.value===mode)?.label}`}
          </Btn>
          {loading && <Spinner text="Running attack on your model..."/>}
          {result && isActive && !loading && (
            <div>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
                <span style={{ fontSize:12,fontWeight:500,color:T.text }}>Attack Results</span>
                <Badge color="red">Bias Detected</Badge>
              </div>
              {mode==='counterfactual' && <CFResults data={result}/>}
              {mode==='intersection'   && <InterResults data={result}/>}
              {mode==='adversarial'    && <AdvResults data={result}/>}
              <Btn onClick={()=>nav('/heatmap')} fullWidth style={{ padding:'10px 0',marginTop:10 }}>View Bias Heatmap</Btn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CFResults({ data }) {
  if (data._error) return <Card><div style={{color:T.hint,fontSize:12}}>{data._error}</div></Card>
  return (
    <div>
      {Object.entries(data).map(([attr,r]) => (
        <Card key={attr} style={{marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div>
              <div style={{fontSize:12,fontWeight:500,color:T.text,textTransform:'capitalize'}}>{attr.replace(/_/g,' ')}</div>
              <div style={{fontSize:10,color:T.hint,marginTop:2}}>{r.privileged} → {r.unprivileged} · {r.n_tested} pairs</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:20,fontWeight:600,color:'#EF4444'}}>{r.flip_rate}%</div>
              <div style={{fontSize:10,color:T.hint}}>flip rate</div>
            </div>
          </div>
          <Bar label={`${r.privileged} (privileged)`}    value={r.priv_rate}   color="#22C55E"/>
          <Bar label={`${r.unprivileged} (unprivileged)`} value={r.unpriv_rate} color="#EF4444"/>
          <div style={{fontSize:11,color:'#EF4444',marginTop:4}}>Gap: {r.gap}%</div>
        </Card>
      ))}
    </div>
  )
}

function InterResults({ data }) {
  if (data._error||!data.groups?.length) return <Card><div style={{color:T.hint,fontSize:12}}>{data._error||'No groups found.'}</div></Card>
  return (
    <Card>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:12}}>
        <span style={{color:T.hint}}>Overall approval rate</span>
        <span style={{color:T.text,fontWeight:500}}>{data.overall_rate}%</span>
      </div>
      {data.groups.filter(g=>g.type!=='priv').map((g,i) => {
        const col=g.approval<20?'#EF4444':g.approval<40?'#F59E0B':'#22C55E'
        return (
          <div key={i} style={{marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:2}}>
              <span style={{color:'#94A3B8'}}>{g.group}</span>
              <span style={{fontWeight:600,color:col}}>{g.approval}%</span>
            </div>
            <div style={{height:5,background:T.border,borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${g.approval}%`,background:col,borderRadius:3,transition:'width .7s'}}/>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

function AdvResults({ data }) {
  if (!data.worst) return <Card><div style={{color:T.hint,fontSize:12}}>{data._error||'No combinations found.'}</div></Card>
  const w=data.worst
  return (
    <div>
      <Card accent="rgba(239,68,68,.3)" style={{background:'rgba(239,68,68,.04)',marginBottom:8}}>
        <div style={{fontSize:11,color:'#EF4444',fontWeight:500,marginBottom:8}}>Worst combination found</div>
        <div style={{background:'#0F172A',borderRadius:6,padding:'10px',fontSize:11,color:'#CBD5E1',fontFamily:'monospace',marginBottom:12}}>{w.combo}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,textAlign:'center'}}>
          {[['Approval',w.approval+'%','#EF4444'],['Overall avg',w.overall+'%',T.text],['Violation score',w.violation,'#EF4444']].map(([l,v,c])=>(
            <div key={l} style={{background:'#0F172A',borderRadius:7,padding:10}}>
              <div style={{fontSize:20,fontWeight:600,color:c}}>{v}</div>
              <div style={{fontSize:10,color:T.hint,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionLabel>All combinations ranked</SectionLabel>
        {(data.combos||[]).slice(0,10).map((c,i)=>{
          const col=c.rate<20?'#EF4444':c.rate<40?'#F59E0B':'#22C55E'
          return (
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${T.line}`,fontSize:11}}>
              <span style={{color:T.hint,width:16}}>{i+1}</span>
              <span style={{color:'#94A3B8',flex:1}}>{c.combo}</span>
              <span style={{fontWeight:600,color:col}}>{c.rate}%</span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
