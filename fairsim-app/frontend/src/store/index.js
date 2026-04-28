import { create } from 'zustand'

const useStore = create((set, get) => ({
  sessionId:   null,
  dataInfo:    null,   // { rows, columns, feat_cols, preview }
  trainInfo:   null,   // { accuracy, fairscore, feat_cols }
  attackResult:null,
  attackMode:  null,
  heatmapData: null,
  shapData:    null,
  fixResult:   null,
  fixType:     null,

  setSession:    (id)   => set({ sessionId: id }),
  setDataInfo:   (d)    => set({ dataInfo: d }),
  setTrainInfo:  (t)    => set({ trainInfo: t }),
  setAttack:     (r,m)  => set({ attackResult: r, attackMode: m }),
  setHeatmap:    (h)    => set({ heatmapData: h }),
  setShap:       (s)    => set({ shapData: s }),
  setFix:        (r,t)  => set({ fixResult: r, fixType: t }),
  reset: () => set({
    sessionId:null,dataInfo:null,trainInfo:null,
    attackResult:null,attackMode:null,heatmapData:null,
    shapData:null,fixResult:null,fixType:null
  }),

  fairscore: () => get().trainInfo?.fairscore?.composite ?? null,
  fixscore:  () => get().fixResult?.after?.composite     ?? null,
}))

export default useStore
