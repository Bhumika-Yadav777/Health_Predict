# -*- coding: utf-8 -*-
import joblib
import numpy as np

print("Loading model...")
model = joblib.load('model.pkl')
features = joblib.load('symptoms_features.pkl')

print("Model loaded successfully!")
print(f"Number of symptoms: {len(features)}")
print(f"First 10 symptoms: {features[:10]}")

# Test prediction
test_symptoms = ['fever', 'cough']
print(f"\nTesting with symptoms: {test_symptoms}")

input_vector = np.zeros(len(features))
for s in test_symptoms:
    if s in features:
        input_vector[features.index(s)] = 1
        print(f"  - Found: {s}")
    else:
        print(f"  - Not found: {s}")

prediction = model.predict([input_vector])[0]
print(f"\nPrediction: {prediction}")
