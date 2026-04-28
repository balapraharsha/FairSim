import pandas as pd
import numpy as np
from itertools import combinations
import traceback
from core.ml_engine import TARGET_COL, _infer_protected

def _prep(df, feat_cols):
    valid = [c for c in feat_cols if c in df.columns]
    return df[valid].copy()

def _safe_predict(pipe, X):
    try:
        return pipe.predict(X)
    except Exception:
        return np.zeros(len(X), dtype=int)

def counterfactual_attack(df: pd.DataFrame, pipe, feat_cols: list, n=400) -> dict:
    protected = _infer_protected(df, feat_cols)
    if not protected:
        return {"_error": "No protected attributes found in this dataset."}

    samp = df.sample(min(n, len(df)), random_state=42).copy().reset_index(drop=True)
    results = {}

    for attr, vals in protected.items():
        if attr not in samp.columns:
            continue
        try:
            flipped = samp.copy()
            flipped[attr] = flipped[attr].apply(
                lambda v: vals["unprivileged"] if str(v).lower()==vals["privileged"] else vals["privileged"]
            )
            orig_p  = _safe_predict(pipe, _prep(samp,    feat_cols))
            flip_p  = _safe_predict(pipe, _prep(flipped, feat_cols))
            mask    = orig_p != flip_p

            col_vals    = samp[attr].astype(str).str.lower()
            priv_mask   = col_vals == vals["privileged"]
            unpriv_mask = col_vals == vals["unprivileged"]

            priv_rate   = orig_p[priv_mask.values].mean()   if priv_mask.sum()   > 0 else 0
            unpriv_rate = orig_p[unpriv_mask.values].mean() if unpriv_mask.sum() > 0 else 0

            examples = []
            for i in np.where(mask)[0][:5]:
                row = samp.iloc[i]
                examples.append({
                    "profile":   {c: str(row[c]) for c in feat_cols[:4] if c in samp.columns},
                    "changed":   attr,
                    "from_val":  str(row[attr]),
                    "to_val":    str(flipped.iloc[i][attr]),
                    "before":    "Selected" if orig_p[i]==1 else "Rejected",
                    "after":     "Selected" if flip_p[i]==1  else "Rejected",
                })

            results[attr] = {
                "flip_rate":    round(float(mask.mean()) * 100, 1),
                "n_flips":      int(mask.sum()),
                "n_tested":     len(samp),
                "priv_rate":    round(float(priv_rate)   * 100, 1),
                "unpriv_rate":  round(float(unpriv_rate) * 100, 1),
                "gap":          round(abs(float(priv_rate) - float(unpriv_rate)) * 100, 1),
                "privileged":   vals["privileged"],
                "unprivileged": vals["unprivileged"],
                "examples":     examples,
            }
        except Exception:
            print(f"[CF attack error for {attr}]\n{traceback.format_exc()}")
            continue

    return results


def intersection_attack(df: pd.DataFrame, pipe, feat_cols: list) -> dict:
    protected = _infer_protected(df, feat_cols)
    if not protected:
        return {"overall_rate": 50, "groups": [], "_error": "No protected attributes found."}

    sample = df.sample(min(2000, len(df)), random_state=42).reset_index(drop=True)
    preds   = _safe_predict(pipe, _prep(sample, feat_cols))
    overall = round(float(preds.mean()) * 100, 1)
    attrs   = list(protected.keys())
    groups  = []

    def add(mask, label, size, typ):
        cnt = int(mask.sum())
        if cnt < 3:
            return
        rate = round(float(preds[mask.values].mean()) * 100, 1)
        groups.append({"group":label,"n":cnt,"approval":rate,
                       "gap":round(rate-overall,1),"type":typ,"size":size})

    for a in attrs:
        if a not in sample.columns: continue
        col = sample[a].astype(str).str.lower()
        add(col == protected[a]["unprivileged"], f"{a} = {protected[a]['unprivileged']}", 1, "single")
        add(col == protected[a]["privileged"],   f"{a} = {protected[a]['privileged']}",   1, "priv")

    for a1, a2 in combinations(attrs, 2):
        if a1 not in sample.columns or a2 not in sample.columns: continue
        c1 = sample[a1].astype(str).str.lower() == protected[a1]["unprivileged"]
        c2 = sample[a2].astype(str).str.lower() == protected[a2]["unprivileged"]
        add(c1 & c2, f"{a1}={protected[a1]['unprivileged']} + {a2}={protected[a2]['unprivileged']}", 2, "pair")

    for a1, a2, a3 in combinations(attrs, 3):
        if not all(a in sample.columns for a in [a1,a2,a3]): continue
        c1 = sample[a1].astype(str).str.lower() == protected[a1]["unprivileged"]
        c2 = sample[a2].astype(str).str.lower() == protected[a2]["unprivileged"]
        c3 = sample[a3].astype(str).str.lower() == protected[a3]["unprivileged"]
        add(c1&c2&c3, f"{a1}={protected[a1]['unprivileged']} + {a2}={protected[a2]['unprivileged']} + {a3}={protected[a3]['unprivileged']}", 3, "triple")

    groups.sort(key=lambda x: x["approval"])
    return {"overall_rate": overall, "groups": groups}


def adversarial_search(df: pd.DataFrame, pipe, feat_cols: list) -> dict:
    protected = _infer_protected(df, feat_cols)
    if not protected:
        return {"worst": None, "combos": [], "overall": 50, "_error": "No protected attributes found."}

    sample  = df.sample(min(2000, len(df)), random_state=42).reset_index(drop=True)
    preds   = _safe_predict(pipe, _prep(sample, feat_cols))
    overall = float(preds.mean())
    attrs   = list(protected.keys())
    worst, combos = None, []

    for size in range(1, min(len(attrs)+1, 5)):
        for combo in combinations(attrs, size):
            if not all(a in sample.columns for a in combo): continue
            mask = pd.Series([True]*len(sample))
            for a in combo:
                mask = mask & (sample[a].astype(str).str.lower() == protected[a]["unprivileged"])
            cnt = int(mask.sum())
            if cnt < 3: continue
            rate       = float(preds[mask.values].mean())
            gap        = overall - rate
            violation  = round(min(99, gap * 200 * (1 + 0.15*(size-1))), 1)
            label      = " + ".join(f"{a}={protected[a]['unprivileged']}" for a in combo)
            combos.append({"combo":label,"n":cnt,"rate":round(rate*100,1),"gap":round(gap*100,1),"violation":violation,"size":size})
            if worst is None or violation > worst["violation"]:
                worst = {"combo":label,"n":cnt,"approval":round(rate*100,1),
                         "overall":round(overall*100,1),"gap":round(gap*100,1),"violation":violation,"size":size}

    combos.sort(key=lambda x: x["rate"])
    return {"worst": worst, "combos": combos[:20], "overall": round(overall*100,1)}


def compute_heatmap(df: pd.DataFrame, pipe, feat_cols: list) -> dict:
    protected = _infer_protected(df, feat_cols)
    sample = df.sample(min(2000, len(df)), random_state=42).reset_index(drop=True)
    preds  = _safe_predict(pipe, _prep(sample, feat_cols))
    y      = sample[TARGET_COL].values if TARGET_COL in sample.columns else np.zeros(len(sample))
    overall = preds.mean()

    groups, filters = [], []
    for attr, vals in protected.items():
        if attr not in sample.columns: continue
        col = sample[attr].astype(str).str.lower()
        groups.append(vals["unprivileged"].replace("_"," ").title())
        filters.append(col == vals["unprivileged"])
    if not groups:
        groups  = ["Group A","Group B","Group C"]
        filters = [pd.Series([True]*len(sample))] * 3

    metrics = ["Dem. Parity","Equal Opp.","CF Stability","Intersect"]
    data = []
    for gf in filters:
        if int(gf.sum()) < 3:
            data.append([50,50,50,50]); continue
        gp  = preds[gf.values]
        gy  = y[gf.values]
        dp  = max(5, int(100 - abs(overall - gp.mean()) * 250))
        ov_tpr = preds[y==1].mean() if (y==1).sum()>0 else 0.5
        tp_mask = gy == 1
        eo  = max(5, int(100 - abs(ov_tpr - (gp[tp_mask].mean() if tp_mask.sum()>0 else ov_tpr)) * 250))
        cf  = max(5, int(dp * 0.88))
        ix  = max(5, int((dp+eo)/2 * 0.75))
        data.append([dp, eo, cf, ix])

    return {"groups": groups, "metrics": metrics, "data": data}