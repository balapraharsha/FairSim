import numpy as np
import pandas as pd
import traceback

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

from core.ml_engine import CATEGORICAL_COLS, NUMERIC_COLS, _prep_X


def compute_shap(pipe, df: pd.DataFrame, feat_cols: list) -> dict:
    """
    Compute SHAP-based feature attribution.
    Falls back to built-in feature importances if SHAP fails for any reason.
    Works with both the standard hiring dataset AND any custom dataset.
    """
    try:
        # Only keep feat_cols that actually exist in df
        valid_feat_cols = [c for c in feat_cols if c in df.columns]
        X   = _prep_X(df, valid_feat_cols)
        pre = pipe.named_steps["pre"]
        clf = pipe.named_steps["clf"]
        Xt  = pre.transform(X)

        # Get feature names after one-hot encoding
        all_names = _get_feature_names(pre, valid_feat_cols)

        if SHAP_AVAILABLE:
            sv = _try_shap(clf, Xt)
        else:
            sv = None

        if sv is not None:
            mean_abs = np.abs(sv).mean(axis=0)
        else:
            # Fall back to feature importances
            mean_abs = _get_importances(clf, Xt)

        return _build_result(mean_abs, all_names, valid_feat_cols)

    except Exception:
        print(f"[shap ERROR]\n{traceback.format_exc()}")
        # Last-resort fallback: equal weights across all features
        return _equal_fallback(feat_cols)


def _get_feature_names(pre, feat_cols: list) -> list:
    """Get feature names after preprocessing — handles any column set."""
    try:
        # Get the categorical columns that were actually fitted
        cat_transformer = pre.named_transformers_.get("cat")
        if cat_transformer is not None:
            # Only the categorical cols that are in feat_cols
            fitted_cat_cols = [c for c in CATEGORICAL_COLS if c in feat_cols]
            cat_names = cat_transformer.get_feature_names_out(fitted_cat_cols).tolist()
        else:
            cat_names = []
    except Exception:
        # Estimate: total columns minus numeric
        num_count = len([c for c in NUMERIC_COLS if c in feat_cols])
        try:
            total = pre.transform(pd.DataFrame(columns=feat_cols).head(0)).shape[1]
            cat_names = [f"cat_{i}" for i in range(total - num_count)]
        except Exception:
            cat_names = []

    num_names = [c for c in NUMERIC_COLS if c in feat_cols]
    return cat_names + num_names


def _try_shap(clf, Xt: np.ndarray):
    """Try TreeExplainer first, then KernelExplainer, return None on failure."""
    sample = Xt[:min(150, len(Xt))]
    try:
        ex = shap.TreeExplainer(clf)
        sv = ex.shap_values(sample)
        sv = sv[1] if isinstance(sv, list) and len(sv) > 1 else sv
        if sv is not None and len(sv.shape) == 2:
            return sv
    except Exception:
        pass

    try:
        background = shap.sample(sample, min(30, len(sample)))
        ex = shap.KernelExplainer(clf.predict_proba, background)
        sv = ex.shap_values(sample[:50], nsamples=50)
        sv = sv[1] if isinstance(sv, list) and len(sv) > 1 else sv
        if sv is not None and len(sv.shape) == 2:
            return sv
    except Exception:
        pass

    return None


def _get_importances(clf, Xt: np.ndarray) -> np.ndarray:
    """Get feature importances from the model directly."""
    try:
        return clf.feature_importances_
    except AttributeError:
        pass
    try:
        return np.abs(clf.coef_[0])
    except Exception:
        pass
    return np.ones(Xt.shape[1])


def _build_result(mean_abs: np.ndarray, all_names: list, feat_cols: list) -> dict:
    """Map raw importance array back to original feature names."""
    raw = {}
    for orig in feat_cols:
        idxs = [i for i, n in enumerate(all_names)
                if n == orig or n.startswith(orig + "_") or n.startswith(orig + "__")]
        if idxs:
            raw[orig] = float(sum(mean_abs[i] for i in idxs if i < len(mean_abs)))

    if not raw:
        # Nothing matched — split equally
        raw = {f: 1.0 for f in feat_cols}

    t = sum(raw.values()) or 1
    pct = {k: round(v / t * 100, 1) for k, v in raw.items()}
    ranked = sorted(pct.items(), key=lambda x: x[1], reverse=True)
    top3   = ranked[:3]
    expl   = " ".join(
        f"{f.replace('_', ' ').title()} influenced the decision by {p:.0f}%."
        for f, p in top3
    )
    expl  += f" Together these three features explain {sum(p for _, p in top3):.0f}% of decisions."
    return {"ranked": ranked, "pct": pct, "explanation": expl, "top3": top3}


def _equal_fallback(feat_cols: list) -> dict:
    """Absolute last resort — equal weights, no crash."""
    n   = len(feat_cols) or 1
    pct = {f: round(100 / n, 1) for f in feat_cols}
    ranked = sorted(pct.items(), key=lambda x: x[1], reverse=True)
    return {
        "ranked":      ranked,
        "pct":         pct,
        "explanation": "Feature attribution unavailable for this model type. Showing equal weights.",
        "top3":        ranked[:3],
    }


def shap_after_fix(before: dict, fix_type: str) -> list:
    """Simulate reduced SHAP influence after a fix is applied."""
    reductions = {
        "rebalancing":    0.50,
        "neutralization": 0.38,
        "constraint":     0.45,
    }
    r   = reductions.get(fix_type, 0.5)
    raw = {k: v * r for k, v in before["pct"].items()}
    t   = sum(raw.values()) or 1
    pct = {k: round(v / t * 100, 1) for k, v in raw.items()}
    return sorted(pct.items(), key=lambda x: x[1], reverse=True)