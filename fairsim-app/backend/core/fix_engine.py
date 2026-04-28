import pandas as pd
import numpy as np
import traceback
from sklearn.utils import resample
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.pipeline import Pipeline

from core.ml_engine import (
    preprocess, build_pipeline, compute_fairscore,
    TARGET_COL, _infer_protected, _smart_feat_cols,
    MAX_ROWS_TRAINING
)


def apply_fix(df: pd.DataFrame, fix_type: str, feat_cols: list, model_type="random_forest"):
    try:
        df = preprocess(df)

        # Detect cat/num split from actual data
        cat_cols, num_cols = _smart_feat_cols(df)
        # Only keep cols that are in feat_cols (passed from session)
        cat_cols = [c for c in cat_cols if c in feat_cols]
        num_cols = [c for c in num_cols if c in feat_cols]
        # Also keep any feat_cols not yet classified
        extra = [c for c in feat_cols if c not in cat_cols and c not in num_cols and c in df.columns and c != TARGET_COL]
        for c in extra:
            if df[c].dtype == object:
                cat_cols.append(c)
            else:
                num_cols.append(c)

        if not cat_cols and not num_cols:
            raise ValueError("No usable feature columns found for retraining.")

        # Apply fix to data
        if fix_type == "rebalancing":
            df_fixed = _rebalance(df)
        elif fix_type == "neutralization":
            df_fixed = _neutralize(df, cat_cols)
        else:
            df_fixed = df.copy()

        # Subsample large datasets
        if len(df_fixed) > MAX_ROWS_TRAINING:
            df_fixed = df_fixed.sample(MAX_ROWS_TRAINING, random_state=99)

        X = df_fixed[[c for c in cat_cols + num_cols if c in df_fixed.columns]]
        y = df_fixed[TARGET_COL]

        if len(X) < 10:
            raise ValueError("Not enough rows after fix to retrain.")

        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=99)

        if fix_type == "constraint":
            pipe = _constraint_train(X_tr, y_tr, cat_cols, num_cols, model_type, df)
        else:
            pipe = build_pipeline(model_type, cat_cols, num_cols)
            pipe.fit(X_tr, y_tr)

        acc = round(accuracy_score(y_te, pipe.predict(X_te)) * 100, 1)
        fs  = compute_fairscore(df, pipe, cat_cols + num_cols)
        return pipe, acc, fs

    except Exception as e:
        print(f"[fix_engine ERROR]\n{traceback.format_exc()}")
        raise


def _rebalance(df: pd.DataFrame) -> pd.DataFrame:
    """Oversample underrepresented groups in auto-detected protected attributes."""
    protected = _infer_protected(df, [c for c in df.columns if c != TARGET_COL])
    result = df.copy()
    for attr, vals in protected.items():
        if attr not in df.columns:
            continue
        col = df[attr].astype(str).str.lower()
        priv   = df[col == vals["privileged"]]
        unpriv = df[col == vals["unprivileged"]]
        if len(priv) < 2 or len(unpriv) < 2:
            continue
        if len(unpriv) < len(priv):
            up = resample(unpriv, replace=True, n_samples=min(len(priv), len(unpriv)*3), random_state=42)
            result = pd.concat([result, up], ignore_index=True)
    return result.reset_index(drop=True)


def _neutralize(df: pd.DataFrame, cat_cols: list) -> pd.DataFrame:
    """Add noise to sensitive categorical proxy features."""
    df = df.copy()
    protected = _infer_protected(df, cat_cols)
    sensitive = list(protected.keys())[:4]  # limit to top 4
    for feat in sensitive:
        if feat not in df.columns:
            continue
        unique_vals = df[feat].dropna().unique()
        if len(unique_vals) < 2:
            continue
        n    = int(len(df) * 0.25)
        idxs = np.random.RandomState(42).choice(df.index, size=min(n, len(df)), replace=False)
        df.loc[idxs, feat] = np.random.RandomState(42).choice(unique_vals, size=len(idxs))
    return df


def _constraint_train(X_tr, y_tr, cat_cols, num_cols, model_type, df_orig):
    """Retrain with sample weights upweighting unprivileged groups."""
    protected = _infer_protected(df_orig, cat_cols + num_cols)
    weights   = np.ones(len(X_tr))

    for attr, vals in protected.items():
        if attr not in X_tr.columns:
            continue
        mask = X_tr[attr].astype(str).str.lower() == vals["unprivileged"]
        weights[mask.values] = weights[mask.values] * 2.2

    pipe = build_pipeline(model_type, cat_cols, num_cols)
    pre  = pipe.named_steps["pre"]
    clf  = pipe.named_steps["clf"]

    Xt = pre.fit_transform(X_tr)
    try:
        clf.fit(Xt, y_tr, sample_weight=weights)
    except TypeError:
        clf.fit(Xt, y_tr)

    return Pipeline([("pre", pre), ("clf", clf)])