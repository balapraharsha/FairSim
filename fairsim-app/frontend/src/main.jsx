import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import Layout from './components/layout/Layout'
import Dashboard   from './pages/Dashboard'
import Upload      from './pages/Upload'
import AttackPage  from './pages/AttackPage'
import HeatmapPage from './pages/HeatmapPage'
import ShapPage    from './pages/ShapPage'
import FixPage     from './pages/FixPage'
import WhatIfPage  from './pages/WhatIfPage'
import ELI5Page    from './pages/ELI5Page'
import ReportPage  from './pages/ReportPage'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background:'#1E293B', color:'#E2E8F0', border:'1px solid #334155' },
        success: { iconTheme: { primary:'#22C55E', secondary:'#0F172A' } },
        error:   { iconTheme: { primary:'#EF4444', secondary:'#0F172A' } },
      }}/>
      <Routes>
        <Route path="/" element={<Layout/>}>
          <Route index element={<Navigate to="/dashboard" replace/>}/>
          <Route path="dashboard"  element={<Dashboard/>}/>
          <Route path="upload"     element={<Upload/>}/>
          <Route path="attack"     element={<AttackPage/>}/>
          <Route path="heatmap"    element={<HeatmapPage/>}/>
          <Route path="shap"       element={<ShapPage/>}/>
          <Route path="fix"        element={<FixPage/>}/>
          <Route path="whatif"     element={<WhatIfPage/>}/>
          <Route path="eli5"       element={<ELI5Page/>}/>
          <Route path="report"     element={<ReportPage/>}/>
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
