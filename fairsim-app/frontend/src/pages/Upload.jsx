import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useStore from '../store'
import { getHeatmap, getShap, applyFix, eli5Explain, whatifPredict, getReport } from '../utils/api'
import { Card, PageHeader, Stat, Btn, Spinner, Empty, Badge, Bar, ScoreRing, SectionLabel, T } from '../components/ui'

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

// ── HeatmapPage ───────────────────────────────────────────────────────────────
export function HeatmapPage() {
  const [data, setData]    = useState(null)
  const [loading, setLoad] = useState(false)
  const { sessionId, trainInfo, heatmapData, setHeatmap } = useStore()
  const nav = useNavigate()
  useEffect(() => {
    if (heatmapData) { setData(heatmapData); return }
    if (!sessionId || !trainInfo) return
    setLoad(true)
    getHeatmap(sessionId).then(r => { setData(r); setHeatmap(r) })
      .catch(e => toast.error(String(e))).finally(() => setLoad(false))
  }, [sessionId])
  const cellColor = v => v < 30 ? '#EF4444' : v < 55 ? '#F59E0B' : '#22C55E'
  return (
    <div style={{ maxWidth: 740 }}>
      <PageHeader tag="Bias Heatmap" title="Group × Metric Fairness Matrix"
        sub="Each cell is a fairness score (0–100). Red = high bias, amber = medium, green = fair."/>
      {!trainInfo && <Empty title="Train a model first" action={<Btn onClick={() => nav('/upload')}>Upload & Train</Btn>}/>}
      {loading && <Spinner text="Computing heatmap..."/>}
      {data && !loading && (
        <>
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', color: T.hint, fontWeight: 500, padding: '0 12px 10px 0', fontSize: 11 }}>Group</th>
                  {data.metrics.map(m => <th key={m} style={{ textAlign: 'center', color: T.hint, fontWeight: 500, padding: '0 8px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>{m}</th>)}
                </tr></thead>
                <tbody>
                  {data.groups.map((g, gi) => (
                    <tr key={g} style={{ borderTop: `1px solid ${T.line}` }}>
                      <td style={{ padding: '8px 12px 8px 0', color: T.sub, fontSize: 12, whiteSpace: 'nowrap' }}>{g}</td>
                      {(data.data[gi] || []).map((v, mi) => {
                        const col = cellColor(v)
                        return <td key={mi} style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 32, borderRadius: 6, fontWeight: 600, fontSize: 12, background: `${col}15`, color: col, border: `1px solid ${col}30` }}>{v}</div>
                        </td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, padding: '10px 16px', background: T.card, borderRadius: 8, border: `1px solid ${T.border}` }}>
            {[['#EF4444', 'High bias (< 30)'], ['#F59E0B', 'Medium (30–55)'], ['#22C55E', 'Fair (> 55)']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.sub }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c }}/>{l}
              </div>
            ))}
          </div>
          <Btn onClick={() => nav('/shap')} fullWidth>SHAP Analysis</Btn>
        </>
      )}
    </div>
  )
}

// ── ShapPage ──────────────────────────────────────────────────────────────────
export function ShapPage() {
  const [loading, setLoad] = useState(false)
  const { sessionId, trainInfo, shapData, setShap } = useStore()
  const nav = useNavigate()
  useEffect(() => {
    if (!sessionId || !trainInfo) return
    if (shapData) return
    setLoad(true)
    getShap(sessionId).then(r => setShap(r)).catch(e => toast.error(String(e))).finally(() => setLoad(false))
  }, [sessionId, trainInfo])
  const data = shapData
  const maxPct = data ? Math.max(...data.ranked.map(([, v]) => v), 1) : 100
  const biasFeatures = ['gender', 'city_tier', 'school_type', 'income_bracket']
  return (
    <div style={{ maxWidth: 660 }}>
      <PageHeader tag="SHAP Analysis" title="Feature Attribution" sub="Which features drive the model's decisions — and by how much?"/>
      {!trainInfo && <Empty title="Train a model first" action={<Btn onClick={() => nav('/upload')}>Upload & Train</Btn>}/>}
      {loading && <Spinner text="Computing SHAP values..."/>}
      {data && !loading && (
        <>
          <Card accent="rgba(99,102,241,.25)" style={{ background: 'rgba(99,102,241,.04)', marginBottom: 10 }}>
            <SectionLabel>Auto-explanation</SectionLabel>
            <p style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.75, margin: 0 }}>{data.explanation}</p>
          </Card>
          <Card>
            <SectionLabel>Feature influence</SectionLabel>
            {data.ranked.map(([feat, pct]) => {
              const isBias = biasFeatures.includes(feat), col = isBias ? '#EF4444' : '#6366F1'
              return (
                <div key={feat} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: T.sub, textTransform: 'capitalize' }}>{feat.replace(/_/g, ' ')}</span>
                      {isBias && <Badge color="red">bias driver</Badge>}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: col }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: T.bg, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(pct / maxPct) * 100}%`, background: col, borderRadius: 3, transition: 'width .8s' }}/>
                  </div>
                </div>
              )
            })}
          </Card>
          <Btn onClick={() => nav('/fix')} fullWidth>Apply Fix</Btn>
        </>
      )}
    </div>
  )
}

// ── FixPage ───────────────────────────────────────────────────────────────────
export function FixPage() {
  const [fixType, setFixType] = useState('rebalancing')
  const [loading, setLoad]    = useState(false)
  const { sessionId, trainInfo, shapData, fixResult, setFix, setShap } = useStore()
  const nav = useNavigate()

  const doFix = async () => {
    if (!sessionId || !trainInfo) { toast.error('Train a model first'); return }
    setLoad(true)
    try {
      const res = await applyFix(sessionId, fixType, 'random_forest')
      setFix(res, fixType)
      if (res.shap_after && shapData) setShap({ ...shapData, after: res.shap_after })
      toast.success('Fix applied')
    } catch (e) { toast.error(String(e)) } finally { setLoad(false) }
  }

  const strategies = [
    ['rebalancing',    'Data Rebalancing',            'Oversample underrepresented groups to correct historical imbalance.'],
    ['neutralization', 'Feature Neutralization',      'Reduce influence of proxy features encoding sensitive attributes.'],
    ['constraint',     'Fairness Constraint Training', 'Retrain with sample weights upweighting unprivileged groups.'],
  ]

  const before = fixResult?.before?.composite
  const after  = fixResult?.after?.composite
  const diff   = (after || 0) - (before || 0)

  return (
    <div style={{ maxWidth: 660 }}>
      <PageHeader tag="Fix Engine" title="Remediate Bias" sub="Choose a strategy, apply it, and measure the FairScore improvement."/>
      {!trainInfo && <Empty title="Train a model first" action={<Btn onClick={() => nav('/upload')}>Upload & Train</Btn>}/>}
      {trainInfo && (
        <>
          <div style={{ marginBottom: 12 }}>
            {strategies.map(([v, l, d]) => (
              <div key={v} onClick={() => setFixType(v)} style={{ border: `1px solid ${fixType === v ? 'rgba(99,102,241,.5)' : T.border}`, background: fixType === v ? 'rgba(99,102,241,.06)' : T.card, borderRadius: 8, padding: '13px 15px', cursor: 'pointer', marginBottom: 8, transition: 'all .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${fixType === v ? '#6366F1' : T.hint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {fixType === v && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366F1' }}/>}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: fixType === v ? T.text : T.sub }}>{l}</div>
                    <div style={{ fontSize: 11, color: T.hint, marginTop: 2, lineHeight: 1.4 }}>{d}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Btn onClick={doFix} disabled={loading} fullWidth style={{ padding: '10px 0' }}>
            {loading ? 'Applying fix...' : 'Apply Fix & Retrain'}
          </Btn>
          {loading && <Spinner text="Retraining model with fairness constraints..."/>}

          {fixResult && !loading && (
            <div style={{ marginTop: 12 }}>
              {/* Before/After scores */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 1fr', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.04)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: T.hint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Before</div>
                  <div style={{ fontSize: 36, fontWeight: 600, color: '#EF4444' }}>{before}</div>
                  <div style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>High Risk</div>
                </div>
                <div style={{ fontSize: 16, color: T.hint, textAlign: 'center' }}>→</div>
                <div style={{ border: '1px solid rgba(34,197,94,.3)', background: 'rgba(34,197,94,.04)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: T.hint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>After</div>
                  <div style={{ fontSize: 36, fontWeight: 600, color: '#22C55E' }}>{after}</div>
                  <div style={{ fontSize: 11, color: '#22C55E', marginTop: 3 }}>{after >= 75 ? 'Low Risk' : 'Medium Risk'}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <Stat label="Accuracy retained" value={`${fixResult.accuracy}%`} color="green"/>
                <Stat label="Improvement" value={`${diff >= 0 ? '+' : ''}${diff} pts`} color={diff >= 0 ? 'green' : 'red'}/>
              </div>

              {/* Download section */}
              <div style={{ marginBottom: 12, padding: '16px', background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <SectionLabel>Download the fixed model</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <a href={`${BASE}/fix/download-model/${sessionId}`} download="fairsim_fixed_model.joblib"
                     style={{ textDecoration: 'none' }}>
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 7, padding: '12px', background: T.card, cursor: 'pointer' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#A5B4FC', marginBottom: 3 }}>Fixed model</div>
                      <div style={{ fontSize: 11, color: T.hint, marginBottom: 6 }}>Debiased scikit-learn pipeline</div>
                      <div style={{ fontSize: 10, color: '#6366F1', fontWeight: 600 }}>Download .joblib</div>
                    </div>
                  </a>
                  <a href={`${BASE}/fix/download-predictions/${sessionId}`} download="fairsim_predictions.csv"
                     style={{ textDecoration: 'none' }}>
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 7, padding: '12px', background: T.card, cursor: 'pointer' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#86EFAC', marginBottom: 3 }}>Predictions CSV</div>
                      <div style={{ fontSize: 11, color: T.hint, marginBottom: 6 }}>Original vs debiased decisions</div>
                      <div style={{ fontSize: 10, color: '#22C55E', fontWeight: 600 }}>Download .csv</div>
                    </div>
                  </a>
                </div>
                <div style={{ background: '#070c15', borderRadius: 6, padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748B', lineHeight: 1.8 }}>
                  <span style={{ color: '#475569' }}># Python usage</span><br/>
                  <span style={{ color: '#818CF8' }}>import</span> joblib<br/>
                  model = joblib.<span style={{ color: '#22D3EE' }}>load</span>(<span style={{ color: '#86EFAC' }}>'fairsim_fixed_model.joblib'</span>)<br/>
                  preds = model.<span style={{ color: '#22D3EE' }}>predict</span>(your_dataframe)
                </div>
              </div>

              <Btn onClick={() => nav('/whatif')} fullWidth>Try What-If Simulator</Btn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── WhatIfPage ────────────────────────────────────────────────────────────────
export function WhatIfPage() {
  const { sessionId, trainInfo, fixResult } = useStore()
  const nav = useNavigate()
  const [profile, setProfile] = useState({ gender: 'female', city_tier: '3', school_type: 'government', income_bracket: 'low', years_experience: 4, education_level: 'undergraduate' })
  const [result, setResult]   = useState(null)
  const [loading, setLoad]    = useState(false)
  const [useFix, setUseFix]   = useState(false)

  const predict = async () => {
    if (!sessionId) return
    setLoad(true)
    try { const r = await whatifPredict(sessionId, profile, useFix && !!fixResult); setResult(r) }
    catch (e) { toast.error(String(e)) } finally { setLoad(false) }
  }

  const Field = ({ label, field, options }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: T.hint, marginBottom: 4 }}>{label}</div>
      <select value={profile[field]} onChange={e => { setProfile(p => ({ ...p, [field]: e.target.value })); setResult(null) }}
        style={{ width: '100%', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, padding: '7px 10px', fontSize: 12 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader tag="What-If Simulator" title="Live Decision Explorer" sub="Change any feature and see the model's decision update instantly."/>
      {!trainInfo && <Empty title="Train a model first" action={<Btn onClick={() => nav('/upload')}>Upload & Train</Btn>}/>}
      {trainInfo && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <SectionLabel>Profile</SectionLabel>
            <Field label="Gender"      field="gender"          options={[['female', 'Female'], ['male', 'Male'], ['other', 'Other']]}/>
            <Field label="City tier"   field="city_tier"       options={[['3', 'Tier 3 — rural'], ['2', 'Tier 2 — mid-city'], ['1', 'Tier 1 — metro']]}/>
            <Field label="School type" field="school_type"     options={[['government', 'Government'], ['private', 'Private']]}/>
            <Field label="Income"      field="income_bracket"  options={[['low', 'Low'], ['mid', 'Mid'], ['high', 'High']]}/>
            <Field label="Education"   field="education_level" options={[['undergraduate', 'Undergraduate'], ['postgraduate', 'Postgraduate']]}/>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: T.hint, marginBottom: 4 }}>Experience — {profile.years_experience} yrs</div>
              <input type="range" min="0" max="15" value={profile.years_experience} step="1"
                onChange={e => { setProfile(p => ({ ...p, years_experience: +e.target.value })); setResult(null) }}
                style={{ width: '100%', accentColor: '#6366F1' }}/>
            </div>
            {fixResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: `1px solid ${T.line}`, marginBottom: 12 }}>
                <input type="checkbox" id="uf" checked={useFix} onChange={e => setUseFix(e.target.checked)} style={{ accentColor: '#6366F1' }}/>
                <label htmlFor="uf" style={{ fontSize: 11, color: T.hint, cursor: 'pointer' }}>Use fixed model</label>
              </div>
            )}
            <Btn onClick={predict} disabled={loading} fullWidth>{loading ? 'Predicting...' : 'Predict'}</Btn>
          </Card>
          <div>
            {result ? (
              <>
                <div style={{ border: `1px solid ${result.label === 'Selected' ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`, background: result.label === 'Selected' ? 'rgba(34,197,94,.04)' : 'rgba(239,68,68,.04)', borderRadius: 10, padding: '24px 16px', textAlign: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 28, fontWeight: 600, color: result.label === 'Selected' ? '#22C55E' : '#EF4444' }}>{result.label}</div>
                  <div style={{ fontSize: 12, color: T.hint, marginTop: 4 }}>{result.probability}% confidence</div>
                </div>
                {fixResult && result.label !== result.orig_label && (
                  <Card>
                    <div style={{ padding: 8, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 6, fontSize: 11, color: '#86EFAC', textAlign: 'center' }}>
                      Fix changed this outcome
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <Card style={{ textAlign: 'center', padding: '40px 16px' }}>
                <div style={{ fontSize: 12, color: T.hint }}>Configure a profile and click Predict</div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ELI5Page ──────────────────────────────────────────────────────────────────
export function ELI5Page() {
  const [topic, setTopic]  = useState('what_is_bias')
  const [text, setText]    = useState('')
  const [loading, setLoad] = useState(false)
  const { trainInfo, attackResult, fixResult, shapData } = useStore()
  const TOPICS = [{ value: 'what_is_bias', label: 'What is bias?' }, { value: 'what_found', label: 'What did we find?' }, { value: 'how_fixed', label: 'How did we fix it?' }, { value: 'intersection', label: 'Intersection bias' }, { value: 'shap', label: 'What is SHAP?' }]
  const explain = async () => {
    setLoad(true)
    const ctx = { fix_type: fixResult?.fix_type?.replace(/_/g, ' ') || 'data rebalancing', before: fixResult?.before?.composite || 38, after: fixResult?.after?.composite || 81, top_features: shapData?.top3?.map(([f]) => f).join(', ') || 'income, location, school type' }
    try { const r = await eli5Explain(topic, ctx); setText(r.explanation) } catch (e) { toast.error(String(e)) } finally { setLoad(false) }
  }
  return (
    <div style={{ maxWidth: 660 }}>
      <PageHeader tag="Explain" title="Plain-language explanations" sub="AI-powered explanations of any part of the bias audit."/>
      <Card>
        <SectionLabel>Topic</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {TOPICS.map(t => (
            <button key={t.value} onClick={() => setTopic(t.value)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${topic === t.value ? '#6366F1' : T.border}`, background: topic === t.value ? 'rgba(99,102,241,.1)' : 'transparent', color: topic === t.value ? '#A5B4FC' : T.hint, transition: 'all .15s' }}>{t.label}</button>
          ))}
        </div>
        <Btn onClick={explain} disabled={loading}>{loading ? 'Generating...' : 'Generate explanation'}</Btn>
      </Card>
      {loading && <Spinner text="Generating explanation..."/>}
      {text && !loading && (
        <div style={{ borderLeft: '3px solid #6366F1', borderRadius: '0 8px 8px 0', background: 'rgba(99,102,241,.04)', padding: '14px 18px' }}>
          <SectionLabel>Explanation</SectionLabel>
          <p style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.8, margin: 0 }}>{text}</p>
        </div>
      )}
    </div>
  )
}

// ── ReportPage ────────────────────────────────────────────────────────────────
export function ReportPage() {
  const [report, setReport] = useState(null)
  const [loading, setLoad]  = useState(false)
  const { sessionId, trainInfo, fixResult, attackResult, shapData } = useStore()
  const nav = useNavigate()
  useEffect(() => {
    if (!sessionId) return
    setLoad(true)
    getReport(sessionId).then(setReport).catch(() => {}).finally(() => setLoad(false))
  }, [sessionId])
  const before = trainInfo?.fairscore?.composite
  const after  = fixResult?.after?.composite
  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader tag="Audit Report" title="FairSim Compliance Report" sub="Session summary for regulatory submissions."/>
      {!trainInfo && <Empty title="Complete the workflow first" action={<Btn onClick={() => nav('/upload')}>Start here</Btn>}/>}
      {loading && <Spinner/>}
      {trainInfo && !loading && (
        <>
          <Card style={{ background: 'linear-gradient(135deg,rgba(30,58,138,.6),rgba(49,46,129,.6))', borderColor: 'rgba(99,102,241,.2)', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>FairSim Audit Certificate</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Bias Penetration Test Report</div>
                <div style={{ fontSize: 11, color: T.hint, marginTop: 2 }}>Session {sessionId?.slice(0, 8)}...</div>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                {before && <ScoreRing score={before} size={80} label="Before"/>}
                {after  && <ScoreRing score={after}  size={80} label="After"/>}
              </div>
            </div>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Card>
              <SectionLabel>Model info</SectionLabel>
              {[['Rows', report?.rows?.toLocaleString() ?? '—'], ['Accuracy', trainInfo?.accuracy ? `${trainInfo.accuracy}%` : '—'], ['FairScore', before ?? '—'], ['Risk level', trainInfo?.fairscore?.risk ?? '—']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.line}`, fontSize: 12 }}>
                  <span style={{ color: T.hint }}>{l}</span><span style={{ color: T.text }}>{v}</span>
                </div>
              ))}
            </Card>
            <Card>
              <SectionLabel>Fix summary</SectionLabel>
              {fixResult
                ? [['Fix type', fixResult.fix_type?.replace(/_/g, ' ') ?? '—'], ['Before', before ?? '—'], ['After', after ?? '—'], ['Improvement', `${(after||0)-(before||0) >= 0 ? '+' : ''}${(after||0)-(before||0)} pts`], ['Accuracy', `${fixResult.accuracy}%`]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.line}`, fontSize: 12 }}>
                      <span style={{ color: T.hint }}>{l}</span><span style={{ color: '#22C55E' }}>{v}</span>
                    </div>
                  ))
                : <div style={{ fontSize: 12, color: T.hint, paddingTop: 4 }}>No fix applied yet.</div>
              }
            </Card>
          </div>
          {shapData?.top3 && (
            <Card style={{ marginBottom: 10 }}>
              <SectionLabel>Top bias drivers (SHAP)</SectionLabel>
              {shapData.top3.map(([f, p]) => (
                <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.line}`, fontSize: 12 }}>
                  <span style={{ color: T.sub, textTransform: 'capitalize' }}>{f.replace(/_/g, ' ')}</span>
                  <span style={{ color: '#EF4444', fontWeight: 600 }}>{p}%</span>
                </div>
              ))}
            </Card>
          )}
          {/* Downloads */}
          <Card style={{ marginBottom: 10 }}>
            <SectionLabel>Downloads</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <a href={`${BASE}/fix/download-model/${sessionId}`} download="fairsim_fixed_model.joblib" style={{ textDecoration: 'none' }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 7, padding: '12px', background: T.bg, cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 2 }}>Fixed model</div>
                  <div style={{ fontSize: 11, color: T.hint, marginBottom: 6 }}>{fixResult ? 'Debiased model ready' : 'Baseline model'}</div>
                  <div style={{ fontSize: 10, color: '#6366F1', fontWeight: 600 }}>Download .joblib</div>
                </div>
              </a>
              <a href={`${BASE}/fix/download-predictions/${sessionId}`} download="fairsim_predictions.csv" style={{ textDecoration: 'none' }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 7, padding: '12px', background: T.bg, cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text, marginBottom: 2 }}>Predictions CSV</div>
                  <div style={{ fontSize: 11, color: T.hint, marginBottom: 6 }}>Original + debiased side by side</div>
                  <div style={{ fontSize: 10, color: '#22C55E', fontWeight: 600 }}>Download .csv</div>
                </div>
              </a>
            </div>
            <div style={{ background: '#070c15', borderRadius: 6, padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748B', lineHeight: 1.8 }}>
              <span style={{ color: '#475569' }}># How to use the downloaded model</span><br/>
              <span style={{ color: '#818CF8' }}>import</span> joblib, pandas <span style={{ color: '#818CF8' }}>as</span> pd<br/>
              model = joblib.<span style={{ color: '#22D3EE' }}>load</span>(<span style={{ color: '#86EFAC' }}>'fairsim_fixed_model.joblib'</span>)<br/>
              df = pd.<span style={{ color: '#22D3EE' }}>read_csv</span>(<span style={{ color: '#86EFAC' }}>'your_new_data.csv'</span>)<br/>
              preds = model.<span style={{ color: '#22D3EE' }}>predict</span>(df)
            </div>
          </Card>
          <Card accent="rgba(34,197,94,.2)" style={{ background: 'rgba(34,197,94,.03)' }}>
            <SectionLabel>Compliance checklist</SectionLabel>
            {[['Demographic Parity Test', !!attackResult], ['Counterfactual Audit', !!attackResult], ['SHAP Feature Attribution', !!shapData], ['Bias Remediation Log', !!fixResult], ['EU AI Act Article 13', !!fixResult], ['DPDP Act Disclosure', !!fixResult]].map(([check, done]) => (
              <div key={check} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${T.line}`, fontSize: 12 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, flexShrink: 0, background: done ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.04)', color: done ? '#22C55E' : T.hint }}>{done ? '✓' : '○'}</div>
                <span style={{ color: done ? T.sub : T.hint }}>{check}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}

export default HeatmapPage
