import { useNavigate } from 'react-router-dom'
import useStore from '../store'
import { Card, Stat, ScoreRing, Btn, SectionLabel, scoreColor, T } from '../components/ui'

export default function Dashboard() {
  const { trainInfo, fixResult, attackResult, shapData, fairscore, fixscore } = useStore()
  const nav = useNavigate()
  const fs  = fairscore()
  const fxs = fixscore()

  const steps = [
    { n:1, label:'Upload & Train', done:!!trainInfo,    to:'/upload'  },
    { n:2, label:'Run Attack',     done:!!attackResult, to:'/attack'  },
    { n:3, label:'SHAP Analysis',  done:!!shapData,     to:'/shap'    },
    { n:4, label:'Apply Fix',      done:!!fixResult,    to:'/fix'     },
    { n:5, label:'What-If Demo',   done:false,          to:'/whatif'  },
    { n:6, label:'Audit Report',   done:false,          to:'/report'  },
  ]

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:22,fontWeight:600,color:'#E2E8F0',letterSpacing:'-0.02em' }}>FairSim</div>
        <div style={{ fontSize:13,color:'#64748B',marginTop:4 }}>AI bias penetration testing — find, explain, and fix unfairness before it causes harm</div>
      </div>

      {trainInfo && (
        <Card style={{ marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16 }}>
          <div style={{ display:'flex',gap:32 }}>
            <ScoreRing score={fs} size={100} label="Baseline"/>
            {fxs!=null && <ScoreRing score={fxs} size={100} label="After Fix"/>}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,flex:1,minWidth:200 }}>
            <Stat label="Accuracy"    value={`${trainInfo.accuracy}%`} color="cyan"/>
            <Stat label="Dem. Parity" value={trainInfo.fairscore?.dp}  color="blue"/>
            <Stat label="Eq. Opp."    value={trainInfo.fairscore?.eo}  color="blue"/>
          </div>
        </Card>
      )}

      <div style={{ fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>Workflow</div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:20 }}>
        {steps.map(({ n, label, done, to }) => (
          <button key={n} onClick={() => nav(to)} style={{ background:done?'rgba(34,197,94,.06)':'#161F2E',border:`1px solid ${done?'rgba(34,197,94,.3)':'#1E293B'}`,borderRadius:9,padding:'12px 14px',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:22,height:22,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,background:done?'#22C55E':'#1E293B',color:done?'#fff':'#475569' }}>{done?'✓':n}</div>
            <div>
              <div style={{ fontSize:12,fontWeight:500,color:done?'#86EFAC':'#94A3B8' }}>{label}</div>
              <div style={{ fontSize:10,color:'#475569' }}>{done?'Complete':'Pending'}</div>
            </div>
          </button>
        ))}
      </div>

      {trainInfo?.fairscore?.attr_scores && Object.keys(trainInfo.fairscore.attr_scores).length > 0 && (
        <Card>
          <SectionLabel>Per-attribute bias gaps</SectionLabel>
          {Object.entries(trainInfo.fairscore.attr_scores).map(([attr,s]) => (
            <div key={attr} style={{ marginBottom:10 }}>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3 }}>
                <span style={{ color:'#94A3B8',textTransform:'capitalize' }}>{attr.replace(/_/g,' ')}</span>
                <span style={{ color:'#EF4444',fontWeight:600 }}>Gap: {s.gap}%</span>
              </div>
              <div style={{ fontSize:10,color:'#64748B' }}>{s.priv_rate}% privileged vs {s.unpriv_rate}% unprivileged</div>
            </div>
          ))}
        </Card>
      )}

      {!trainInfo && (
        <Card>
          <div style={{ fontSize:13,fontWeight:500,color:'#E2E8F0',marginBottom:4 }}>Get started</div>
          <div style={{ fontSize:12,color:'#64748B',marginBottom:14 }}>Upload a dataset and train a baseline model to begin the bias audit.</div>
          <Btn onClick={() => nav('/upload')}>Upload dataset</Btn>
        </Card>
      )}
    </div>
  )
}
