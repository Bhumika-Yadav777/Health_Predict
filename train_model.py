# -*- coding: utf-8 -*-
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib
import warnings
warnings.filterwarnings('ignore')

print("Loading dataset...")
df = pd.read_csv('dataset.csv')
print(f"Dataset shape: {df.shape}")

# Get symptom columns
symptom_cols = [col for col in df.columns if col.startswith('Symptom_')]

# Collect all unique symptoms
all_symptoms = set()
for col in symptom_cols:
    symptoms = df[col].dropna().tolist()
    for s in symptoms:
        all_symptoms.add(str(s).strip().lower().replace(" ", "_"))

symptoms_list = sorted(list(all_symptoms))
print(f"Total unique symptoms: {len(symptoms_list)}")

# Create feature matrix
X = np.zeros((len(df), len(symptoms_list)))
for i, row in df.iterrows():
    for col in symptom_cols:
        symptom = row[col]
        if pd.notna(symptom):
            symptom_clean = str(symptom).strip().lower().replace(" ", "_")
            if symptom_clean in symptoms_list:
                X[i, symptoms_list.index(symptom_clean)] = 1

# Target
y = df['Disease']

# Train model
print("Training Random Forest model...")
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X, y)

# Save model and features
joblib.dump(model, 'model.pkl')
joblib.dump(symptoms_list, 'symptoms_features.pkl')

print("✅ Model saved successfully!")
print(f"✅ Features saved: {len(symptoms_list)} symptoms")
