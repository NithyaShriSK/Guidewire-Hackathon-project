#!/usr/bin/env python3
"""Weekly claim risk prediction model for GigShield.

This implementation is self-contained and uses a simple logistic-regression style
trainer so it can run even when external ML libraries are unavailable.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import pickle
import random
import statistics
import sys
from pathlib import Path
from typing import Dict, List

FEATURE_COLUMNS = [
    "rainfall",
    "windSpeed",
    "temperature",
    "humidity",
    "aqi",
    "pm25",
    "pm10",
    "no2",
    "congestionLevel",
    "averageSpeed",
    "cityRisk",
    "claimFrequency",
    "approvalRatio",
    "workWindowHours",
    "incomeVolatility",
]

DEFAULT_MODEL_PATH = Path(__file__).with_name("risk_model.joblib")


def risk_level_from_score(score: float) -> str:
    if score >= 0.7:
        return "HIGH"
    if score >= 0.4:
        return "MEDIUM"
    return "LOW"


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def sigmoid(value: float) -> float:
    value = max(min(value, 30), -30)
    return 1.0 / (1.0 + math.exp(-value))


def generate_synthetic_dataset(rows: int = 5000, seed: int = 42):
    random.seed(seed)
    dataset = []

    for _ in range(rows):
        rainfall = clamp(random.gauss(12, 12), 0, 80)
        wind_speed = clamp(random.gauss(18, 10), 0, 80)
        temperature = clamp(random.gauss(31, 6), 10, 48)
        humidity = clamp(random.gauss(68, 15), 10, 100)
        aqi = clamp(random.gauss(120, 80), 10, 500)
        pm25 = clamp(random.gauss(55, 35), 5, 300)
        pm10 = clamp(random.gauss(90, 50), 5, 400)
        no2 = clamp(random.gauss(30, 18), 2, 200)
        congestion = clamp(random.gauss(5.2, 2.3), 1, 10)
        average_speed = clamp(random.gauss(22, 10), 2, 60)
        city_risk = clamp(random.gauss(0.18, 0.08), 0, 0.4)
        claim_frequency = clamp(random.randint(0, 8), 0, 12)
        approval_ratio = clamp(random.gauss(0.72, 0.2), 0, 1)
        work_window_hours = clamp(random.gauss(11, 2.5), 4, 18)
        income_volatility = clamp(random.gauss(0.32, 0.16), 0, 1)

        risk_signal = (
            rainfall * 0.015
            + wind_speed * 0.01
            + max(0, temperature - 35) * 0.03
            + max(0, humidity - 75) * 0.01
            + aqi * 0.0015
            + pm25 * 0.002
            + pm10 * 0.001
            + no2 * 0.0015
            + congestion * 0.06
            + max(0, 20 - average_speed) * 0.025
            + city_risk * 2.6
            + claim_frequency * 0.12
            + max(0, 0.55 - approval_ratio) * 1.3
            + max(0, work_window_hours - 12) * 0.03
            + income_volatility * 0.6
        )

        probability = sigmoid((risk_signal - 2.8) * 1.35)
        label = 1 if probability > 0.5 else 0

        dataset.append({
            "features": [
                rainfall,
                wind_speed,
                temperature,
                humidity,
                aqi,
                pm25,
                pm10,
                no2,
                congestion,
                average_speed,
                city_risk,
                claim_frequency,
                approval_ratio,
                work_window_hours,
                income_volatility,
            ],
            "label": label,
        })

    return dataset


def load_rows_from_csv(model_path: Path):
    rows = []
    with model_path.open('r', encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                rows.append({
                    "features": [
                        float(row.get('rainfall', 0) or 0),
                        float(row.get('windSpeed', 0) or 0),
                        float(row.get('temperature', 0) or 0),
                        float(row.get('humidity', 0) or 0),
                        float(row.get('aqi', 0) or 0),
                        float(row.get('pm25', 0) or 0),
                        float(row.get('pm10', 0) or 0),
                        float(row.get('no2', 0) or 0),
                        float(row.get('congestionLevel', 0) or 0),
                        float(row.get('averageSpeed', 0) or 0),
                        float(row.get('cityRisk', 0) or 0),
                        float(row.get('claimFrequency', 0) or 0),
                        float(row.get('approvalRatio', 0) or 0),
                        float(row.get('workWindowHours', 0) or 0),
                        float(row.get('incomeVolatility', 0) or 0),
                    ],
                    "label": int(float(row.get('label', 0) or 0)),
                })
            except ValueError:
                continue
    return rows


def split_dataset(dataset, ratio=0.8):
    random.seed(42)
    random.shuffle(dataset)
    split_index = max(1, int(len(dataset) * ratio))
    return dataset[:split_index], dataset[split_index:] or dataset[:]


def mean_and_std(values):
    mean_value = statistics.mean(values)
    std_value = statistics.pstdev(values) or 1.0
    return mean_value, std_value


def train_model(model_path: Path):
    dataset = generate_synthetic_dataset()
    train_rows, test_rows = split_dataset(dataset)

    feature_count = len(FEATURE_COLUMNS)
    feature_means = []
    feature_stds = []
    for index in range(feature_count):
        column_values = [row['features'][index] for row in train_rows]
        mean_value, std_value = mean_and_std(column_values)
        feature_means.append(mean_value)
        feature_stds.append(std_value)

    weights = [0.0] * feature_count
    bias = 0.0
    learning_rate = 0.08

    for _ in range(300):
        grad_w = [0.0] * feature_count
        grad_b = 0.0

        for row in train_rows:
            normalized = [(row['features'][i] - feature_means[i]) / feature_stds[i] for i in range(feature_count)]
            logit = bias + sum(weights[i] * normalized[i] for i in range(feature_count))
            prediction = sigmoid(logit)
            error = prediction - row['label']
            for i in range(feature_count):
                grad_w[i] += error * normalized[i]
            grad_b += error

        sample_count = float(len(train_rows))
        for i in range(feature_count):
            weights[i] -= learning_rate * grad_w[i] / sample_count
        bias -= learning_rate * grad_b / sample_count

    def predict_probability(row):
        normalized = [(row['features'][i] - feature_means[i]) / feature_stds[i] for i in range(feature_count)]
        return sigmoid(bias + sum(weights[i] * normalized[i] for i in range(feature_count)))

    test_probs = [predict_probability(row) for row in test_rows]
    test_preds = [1 if prob >= 0.5 else 0 for prob in test_probs]
    test_labels = [row['label'] for row in test_rows]

    accuracy = sum(1 for predicted, actual in zip(test_preds, test_labels) if predicted == actual) / len(test_labels)
    if any(label == 1 for label in test_labels) and any(label == 0 for label in test_labels):
        positives = [prob for prob, label in zip(test_probs, test_labels) if label == 1]
        negatives = [prob for prob, label in zip(test_probs, test_labels) if label == 0]
        roc_auc = clamp(0.5 + ((statistics.mean(positives) - statistics.mean(negatives)) / 2), 0, 1)
    else:
        roc_auc = 0.5

    metrics = {
        'accuracy': round(float(accuracy), 4),
        'roc_auc': round(float(roc_auc), 4),
    }

    payload = {
        'model_type': 'logistic_regression_from_scratch',
        'feature_columns': FEATURE_COLUMNS,
        'weights': weights,
        'bias': bias,
        'feature_means': feature_means,
        'feature_stds': feature_stds,
        'metrics': metrics,
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    with model_path.open('wb') as handle:
        pickle.dump(payload, handle)

    return metrics


def load_model(model_path: Path):
    if not model_path.exists():
        return None
    with model_path.open('rb') as handle:
        return pickle.load(handle)


def pick_reason(feature_row: Dict[str, float]) -> str:
    reasons: List[str] = []
    if feature_row["rainfall"] >= 20 or feature_row["windSpeed"] >= 30:
        reasons.append("Severe weather exposure")
    if feature_row["aqi"] >= 150 or feature_row["pm25"] >= 80:
        reasons.append("High pollution exposure")
    if feature_row["congestionLevel"] >= 7 or feature_row["averageSpeed"] <= 12:
        reasons.append("Traffic disruption")
    if feature_row["claimFrequency"] >= 4:
        reasons.append("Repeated claims history")
    if feature_row["approvalRatio"] <= 0.5:
        reasons.append("Low claim approval ratio")
    if feature_row["cityRisk"] >= 0.2:
        reasons.append("High-risk geography")

    if not reasons:
        reasons.append("Stable environmental conditions")

    return " + ".join(reasons[:4])


def predict(model_path: Path, input_payload: dict) -> dict:
    payload = load_model(model_path)
    if payload is None:
        metrics = train_model(model_path)
        payload = load_model(model_path)
    else:
        metrics = payload.get('metrics', {})

    feature_row = {column: float(input_payload.get(column, 0) or 0) for column in FEATURE_COLUMNS}
    normalized = [
        (feature_row[column] - payload['feature_means'][index]) / (payload['feature_stds'][index] or 1.0)
        for index, column in enumerate(FEATURE_COLUMNS)
    ]
    probability = sigmoid(payload['bias'] + sum(payload['weights'][index] * normalized[index] for index in range(len(FEATURE_COLUMNS))))

    predicted_claims = max(0, round(probability * 10 + feature_row['claimFrequency'] * 0.3 + feature_row['cityRisk'] * 2))
    premium_adjustment_percent = int(clamp(round(probability * 30 - 5), -10, 35))

    return {
        'riskScore': round(probability, 2),
        'riskLevel': risk_level_from_score(probability),
        'predictedClaimsNextWeek': predicted_claims,
        'confidence': round(clamp(abs(probability - 0.5) * 2 + 0.55, 0.55, 0.98), 2),
        'premiumAdjustmentPercent': premium_adjustment_percent,
        'reason': pick_reason(feature_row),
        'modelSource': 'python-ml',
        'metrics': metrics,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='Train or run the GigShield risk model')
    parser.add_argument('--train', action='store_true', help='Train the model')
    parser.add_argument('--predict', action='store_true', help='Predict risk')
    parser.add_argument('--model', type=str, default=str(DEFAULT_MODEL_PATH), help='Path to the saved model file')
    parser.add_argument('--input', type=str, help='JSON input payload for prediction')

    args = parser.parse_args()
    model_path = Path(args.model)

    try:
        if args.train:
            metrics = train_model(model_path)
            print(json.dumps({'success': True, 'modelPath': str(model_path), 'metrics': metrics}))
            return 0

        if args.predict:
            if not args.input:
                raise ValueError('--input is required for prediction')

            input_payload = json.loads(args.input)
            result = predict(model_path, input_payload)
            print(json.dumps(result))
            return 0

        raise ValueError('Use either --train or --predict')
    except Exception as exc:
        print(json.dumps({'success': False, 'error': str(exc)}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
