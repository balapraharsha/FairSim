import axios from 'axios'

// In production (Cloud Run), VITE_API_URL is injected at build time.
// In dev, Vite proxy routes /api -> localhost:8000.
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({ baseURL: BASE, timeout: 120000 })

api.interceptors.response.use(
  r => r.data,
  e => Promise.reject(e.response?.data?.detail || e.message || 'Request failed')
)

export const uploadCSV     = (file)        => { const fd = new FormData(); fd.append('file', file); return api.post('/upload/csv', fd) }
export const trainModel    = (sid, mtype)  => api.post('/upload/train', { session_id: sid, model_type: mtype })
export const runAttack     = (sid, mode)   => api.post('/attack/run', { session_id: sid, mode })
export const getHeatmap    = (sid)         => api.get(`/attack/heatmap/${sid}`)
export const getShap       = (sid)         => api.get(`/shap/${sid}`)
export const applyFix      = (sid, ft, mt) => api.post('/fix/apply', { session_id: sid, fix_type: ft, model_type: mt })
export const eli5Explain   = (topic, ctx)  => api.post('/eli5/explain', { topic, context: ctx || {} })
export const whatifPredict = (sid, prof, fx) => api.post('/whatif/predict', { session_id: sid, profile: prof, use_fixed: fx })
export const getReport     = (sid)         => api.get(`/report/${sid}`)

// Download URLs — direct links (not axios, browser handles download)
export const getModelDownloadUrl      = (sid) => `${BASE}/fix/download-model/${sid}`
export const getPredictionsDownloadUrl = (sid) => `${BASE}/fix/download-predictions/${sid}`
export const getModelInfo             = (sid) => api.get(`/fix/model-info/${sid}`)