#!/usr/bin/env python3
"""Train and run the GigShield fraud detection model.

This script benchmarks multiple supervised classification algorithms with
hyperparameter search, picks the best one by validation accuracy, and stores
that model for inference.

Usage:
  python ml/fraud_model.py --train --dataset "C:\\Users\\Nithya\\Downloads\\gigshield_fraud_dataset_v2.csv" --model ml/fraud_model.joblib
  python ml/fraud_model.py --predict --input '{"distance_km": 25, "time_minutes": 5, "avg_speed_kmph": 300, "claims_last_week": 4, "weather_match": 0}' --model ml/fraud_model.joblib
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    AdaBoostClassifier,
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    RandomForestClassifier,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

FEATURE_COLUMNS = [
    'distance_km',
    'time_minutes',
    'avg_speed_kmph',
    'claims_last_week',
    'weather_match',
]

LABEL_COLUMN = 'is_fraud'
DEFAULT_MODEL_PATH = Path(__file__).with_name('fraud_model.joblib')


def risk_level_from_score(score: float) -> str:
    if score >= 0.7:
        return 'HIGH'
    if score >= 0.4:
        return 'MEDIUM'
    return 'LOW'


def load_dataset(dataset_path: Path) -> pd.DataFrame:
    if not dataset_path.exists():
        raise FileNotFoundError(f'Dataset not found: {dataset_path}')

    df = pd.read_csv(dataset_path)
    missing_columns = [column for column in FEATURE_COLUMNS + [LABEL_COLUMN] if column not in df.columns]
    if missing_columns:
        raise ValueError(f'Dataset missing required columns: {missing_columns}')

    for column in FEATURE_COLUMNS + [LABEL_COLUMN]:
        df[column] = pd.to_numeric(df[column], errors='coerce')

    df = df.dropna(subset=FEATURE_COLUMNS + [LABEL_COLUMN]).copy()
    df[LABEL_COLUMN] = df[LABEL_COLUMN].astype(int)

    if df.empty:
        raise ValueError('Dataset is empty after cleaning')

    if df[LABEL_COLUMN].nunique() < 2:
        raise ValueError('Dataset must contain both fraud and non-fraud classes')

    return df


def build_preprocessor() -> ColumnTransformer:
    numeric_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler()),
    ])

    return ColumnTransformer([
        ('num', numeric_transformer, FEATURE_COLUMNS),
    ])


def model_search_space(random_state: int = 42) -> List[Tuple[str, object, Dict[str, List[object]]]]:
    return [
        (
            'logistic_regression',
            LogisticRegression(max_iter=2000, class_weight='balanced', random_state=random_state),
            {
                'clf__C': [0.1, 1.0, 10.0],
                'clf__solver': ['lbfgs', 'liblinear'],
            },
        ),
        (
            'random_forest',
            RandomForestClassifier(class_weight='balanced', random_state=random_state, n_jobs=-1),
            {
                'clf__n_estimators': [200, 400],
                'clf__max_depth': [None, 6, 12],
                'clf__min_samples_split': [2, 4],
                'clf__min_samples_leaf': [1, 2],
            },
        ),
        (
            'extra_trees',
            ExtraTreesClassifier(class_weight='balanced', random_state=random_state, n_jobs=-1),
            {
                'clf__n_estimators': [200, 400],
                'clf__max_depth': [None, 6, 12],
                'clf__min_samples_split': [2, 4],
                'clf__min_samples_leaf': [1, 2],
            },
        ),
        (
            'gradient_boosting',
            GradientBoostingClassifier(random_state=random_state),
            {
                'clf__n_estimators': [100, 200],
                'clf__learning_rate': [0.05, 0.1],
                'clf__max_depth': [2, 3],
            },
        ),
        (
            'decision_tree',
            DecisionTreeClassifier(class_weight='balanced', random_state=random_state),
            {
                'clf__max_depth': [None, 5, 10],
                'clf__min_samples_split': [2, 4, 8],
                'clf__min_samples_leaf': [1, 2, 4],
            },
        ),
        (
            'svc_rbf',
            SVC(probability=True, class_weight='balanced', random_state=random_state),
            {
                'clf__C': [0.5, 1.0, 2.0],
                'clf__gamma': ['scale', 'auto'],
                'clf__kernel': ['rbf'],
            },
        ),
        (
            'knn',
            KNeighborsClassifier(),
            {
                'clf__n_neighbors': [3, 5, 7],
                'clf__weights': ['uniform', 'distance'],
                'clf__metric': ['minkowski'],
            },
        ),
        (
            'gaussian_nb',
            GaussianNB(),
            {
                'clf__var_smoothing': [1e-9, 1e-8, 1e-7],
            },
        ),
        (
            'adaboost',
            AdaBoostClassifier(random_state=random_state),
            {
                'clf__n_estimators': [100, 200],
                'clf__learning_rate': [0.5, 1.0],
            },
        ),
    ]


def normalize_payload(input_payload: Dict[str, object]) -> Dict[str, float]:
    aliases = {
        'distance_km': ['distance_km', 'distanceKm'],
        'time_minutes': ['time_minutes', 'timeMinutes'],
        'avg_speed_kmph': ['avg_speed_kmph', 'avgSpeedKmph'],
        'claims_last_week': ['claims_last_week', 'claimsLastWeek'],
        'weather_match': ['weather_match', 'weatherMatch'],
    }

    normalized: Dict[str, float] = {}
    for key, key_aliases in aliases.items():
        value = 0.0
        for alias in key_aliases:
            if alias in input_payload and input_payload[alias] is not None:
                value = float(input_payload[alias])
                break
        normalized[key] = value

    return normalized


def compute_reason(feature_row: Dict[str, float], top_features: List[str]) -> str:
    reasons: List[str] = []

    speed = feature_row['avg_speed_kmph']
    distance = feature_row['distance_km']
    time_minutes = max(feature_row['time_minutes'], 1)
    claims_last_week = feature_row['claims_last_week']
    weather_match = int(feature_row['weather_match'])

    if speed >= 180 or (distance / max(time_minutes / 60.0, 1 / 60.0)) >= 180:
        reasons.append('Unrealistic travel speed')
    if distance >= 15 and time_minutes <= 15:
        reasons.append('Large GPS location jump')
    if weather_match == 0:
        reasons.append('Weather mismatch')
    if claims_last_week >= 5:
        reasons.append('High claim frequency')

    if not reasons:
        for feature_name in top_features[:2]:
            label = feature_name.replace('_', ' ').title()
            if label not in reasons:
                reasons.append(label)

    if not reasons:
        reasons.append('No significant fraud indicators detected')

    return ' + '.join(reasons)


def evaluate_candidate(
    model_name: str,
    estimator: object,
    grid: Dict[str, List[object]],
    preprocessor: ColumnTransformer,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    cv: StratifiedKFold,
) -> GridSearchCV:
    pipe = Pipeline([
        ('pre', clone(preprocessor)),
        ('clf', estimator),
    ])

    search = GridSearchCV(
        estimator=pipe,
        param_grid=grid,
        scoring='accuracy',
        cv=cv,
        n_jobs=-1,
        refit=True,
        verbose=0,
    )
    search.fit(X_train, y_train)
    return search


def train_model(dataset_path: Path, model_path: Path) -> Dict[str, object]:
    df = load_dataset(dataset_path)
    X = df[FEATURE_COLUMNS]
    y = df[LABEL_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    preprocessor = build_preprocessor()
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    preferred_model_key = 'adaboost'

    best_search: GridSearchCV | None = None
    preferred_search: GridSearchCV | None = None
    best_search_key: str | None = None
    leaderboard: List[Dict[str, object]] = []

    for model_name, estimator, grid in model_search_space(random_state=42):
        search = evaluate_candidate(model_name, estimator, grid, preprocessor, X_train, y_train, cv)
        cv_accuracy = float(search.best_score_)
        leaderboard.append({
            'model': model_name,
            'cv_accuracy': round(cv_accuracy, 4),
            'best_params': search.best_params_,
        })

        if model_name == preferred_model_key:
            preferred_search = search

        if best_search is None or cv_accuracy > float(best_search.best_score_):
            best_search = search
            best_search_key = model_name

    selected_by = 'highest_cv_accuracy'
    selected_model_key = best_search_key

    if preferred_search is not None:
        best_search = preferred_search
        selected_by = 'preferred_model_override'
        selected_model_key = preferred_model_key

    if best_search is None:
        raise RuntimeError('No model was trained successfully')

    best_model = best_search.best_estimator_
    y_pred = best_model.predict(X_test)
    y_proba = best_model.predict_proba(X_test)[:, 1] if hasattr(best_model, 'predict_proba') else y_pred

    metrics = {
        'accuracy': round(float(accuracy_score(y_test, y_pred)), 4),
        'f1': round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        'roc_auc': round(float(roc_auc_score(y_test, y_proba)), 4),
    }

    top_features = FEATURE_COLUMNS
    if hasattr(best_model.named_steps['clf'], 'feature_importances_'):
        importances = best_model.named_steps['clf'].feature_importances_
        ranked = sorted(zip(FEATURE_COLUMNS, importances), key=lambda item: item[1], reverse=True)
        top_features = [name for name, _ in ranked]
    elif hasattr(best_model.named_steps['clf'], 'coef_'):
        coefficients = np.abs(best_model.named_steps['clf'].coef_[0])
        ranked = sorted(zip(FEATURE_COLUMNS, coefficients), key=lambda item: item[1], reverse=True)
        top_features = [name for name, _ in ranked]

    sorted_leaderboard = sorted(leaderboard, key=lambda item: item['cv_accuracy'], reverse=True)
    top_cv_model = sorted_leaderboard[0] if sorted_leaderboard else None

    payload = {
        'model': best_model,
        'feature_columns': FEATURE_COLUMNS,
        'metrics': metrics,
        'best_model_name': best_search.best_estimator_.named_steps['clf'].__class__.__name__,
        'best_params': best_search.best_params_,
        'leaderboard': sorted_leaderboard,
        'selection_policy': {
            'preferred_model_key': preferred_model_key,
            'selected_model_key': selected_model_key,
            'selected_by': selected_by,
            'top_cv_model_key': top_cv_model['model'] if top_cv_model else None,
            'top_cv_accuracy': top_cv_model['cv_accuracy'] if top_cv_model else None,
        },
        'top_features': top_features,
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(payload, model_path)

    return {
        'metrics': metrics,
        'bestModel': payload['best_model_name'],
        'bestParams': payload['best_params'],
        'leaderboard': payload['leaderboard'],
        'selectionPolicy': payload['selection_policy'],
    }


def print_training_report(result: Dict[str, object], model_path: Path) -> None:
    leaderboard = result.get('leaderboard', [])
    selection_policy = result.get('selectionPolicy', {})
    metrics = result.get('metrics', {})

    print('=== Fraud Model Leaderboard (CV Accuracy) ===', file=sys.stderr)
    for rank, item in enumerate(leaderboard, start=1):
        print(
            f"{rank:>2}. {item['model']:<20} cv_accuracy={item['cv_accuracy']:.4f}",
            file=sys.stderr,
        )

    print('', file=sys.stderr)
    print('=== Selection Logic ===', file=sys.stderr)
    print(
        f"Preferred model key: {selection_policy.get('preferred_model_key')}",
        file=sys.stderr,
    )
    print(
        f"Top CV model: {selection_policy.get('top_cv_model_key')} (accuracy={selection_policy.get('top_cv_accuracy')})",
        file=sys.stderr,
    )
    print(
        f"Selected model key: {selection_policy.get('selected_model_key')} via {selection_policy.get('selected_by')}",
        file=sys.stderr,
    )
    print(
        f"Final classifier: {result.get('bestModel')}",
        file=sys.stderr,
    )
    print('', file=sys.stderr)
    print('=== Test Metrics ===', file=sys.stderr)
    print(
        f"accuracy={metrics.get('accuracy')}  f1={metrics.get('f1')}  roc_auc={metrics.get('roc_auc')}",
        file=sys.stderr,
    )
    print(f"Saved model: {model_path}", file=sys.stderr)


def load_model(model_path: Path):
    if not model_path.exists():
        return None
    return joblib.load(model_path)


def predict(model_path: Path, input_payload: Dict[str, object], dataset_path: Path | None = None) -> Dict[str, object]:
    payload = load_model(model_path)

    if payload is None:
        if dataset_path is None:
            raise FileNotFoundError(f'Model not found at {model_path}. Train first with --train --dataset <csv>.')
        train_model(dataset_path, model_path)
        payload = load_model(model_path)

    model = payload['model']
    normalized = normalize_payload(input_payload)
    frame = pd.DataFrame([normalized], columns=FEATURE_COLUMNS)

    probability = float(model.predict_proba(frame)[0][1]) if hasattr(model, 'predict_proba') else float(model.predict(frame)[0])
    risk_level = risk_level_from_score(probability)
    reason = compute_reason(normalized, payload.get('top_features', FEATURE_COLUMNS))

    confidence = max(0.5, min(0.99, abs(probability - 0.5) * 2 + 0.5))

    return {
        'fraudScore': round(probability, 2),
        'riskLevel': risk_level,
        'confidence': round(float(confidence), 2),
        'reason': reason,
        'modelSource': 'python-ml',
        'modelName': payload.get('best_model_name'),
        'metrics': payload.get('metrics', {}),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='Train or run the GigShield fraud model')
    parser.add_argument('--train', action='store_true', help='Train the model')
    parser.add_argument('--predict', action='store_true', help='Predict fraud risk')
    parser.add_argument('--dataset', type=str, help='Path to CSV training dataset')
    parser.add_argument('--model', type=str, default=str(DEFAULT_MODEL_PATH), help='Path to saved model file')
    parser.add_argument('--input', type=str, help='JSON payload for prediction')

    args = parser.parse_args()
    model_path = Path(args.model)
    dataset_path = Path(args.dataset) if args.dataset else None

    try:
        if args.train:
            if dataset_path is None:
                raise ValueError('--dataset is required for training')

            result = train_model(dataset_path, model_path)
            print_training_report(result, model_path)
            print(json.dumps({'success': True, 'modelPath': str(model_path), **result}))
            return 0

        if args.predict:
            if not args.input:
                raise ValueError('--input is required for prediction')

            payload = json.loads(args.input)
            result = predict(model_path, payload, dataset_path)
            print(json.dumps(result))
            return 0

        raise ValueError('Use either --train or --predict')
    except Exception as exc:
        print(json.dumps({'success': False, 'error': str(exc)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
