# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import joblib
import numpy as np
import json
from datetime import datetime
import os
import pandas as pd

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
CORS(app, supports_credentials=True)

db = SQLAlchemy(app)

# User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
    name = db.Column(db.String(100), nullable=True)
    role = db.Column(db.String(20), default='patient')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Prediction Model
class Prediction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(50), nullable=False)
    symptoms = db.Column(db.Text, nullable=False)
    predicted_disease = db.Column(db.String(200), nullable=False)
    confidence = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Load Model and symptom names
model = None
features = []
disease_remedies = {}

# Load disease remedies from CSV
try:
    if os.path.exists('disease_info.csv'):
        remedies_df = pd.read_csv('disease_info.csv')
        for _, row in remedies_df.iterrows():
            disease = row['Disease']
            disease_remedies[disease] = {
                'remedies': [row['HomeRemedy1'], row['HomeRemedy2'], row['HomeRemedy3'], row['HomeRemedy4']],
                'confidence_boost': 0.85  # Base confidence for known diseases
            }
        print(f"✅ Loaded remedies for {len(disease_remedies)} diseases")
    else:
        print("⚠️ disease_info.csv not found, using default remedies")
except Exception as e:
    print(f"Error loading remedies: {e}")

# Load ML model
try:
    if os.path.exists('model.pkl') and os.path.exists('symptoms_features.pkl'):
        model = joblib.load('model.pkl')
        features = joblib.load('symptoms_features.pkl')
        print(f"✅ Model loaded! Features: {len(features)}")
    else:
        print("❌ Model files not found! Run train_model.py first")
except Exception as e:
    print(f"❌ Error loading model: {e}")

def calculate_confidence(symptoms, predicted_disease, model_proba=None):
    """Calculate confidence percentage between 70-95% based on symptom match and model probability"""
    try:
        base_confidence = 70.0  # Start at 70% minimum
        
        # Factor 1: Model probability (if available) - contributes up to 15%
        if model_proba is not None and len(model_proba) > 0:
            prob_score = float(max(model_proba[0]) * 15)  # Max 15% boost
            base_confidence += prob_score
        
        # Factor 2: Number of symptoms matched - contributes up to 10%
        # More symptoms = higher confidence
        matched_count = len([s for s in symptoms if s.replace("_", " ") in predicted_disease.lower()])
        symptom_boost = min(10, (matched_count / max(len(symptoms), 1)) * 10)
        base_confidence += symptom_boost
        
        # Factor 3: Known disease in remedies database gets a small boost
        if predicted_disease in disease_remedies:
            base_confidence += 5  # +5% for known diseases
        
        # Ensure confidence stays between 70 and 95
        confidence = min(max(base_confidence, 70.0), 95.0)
        return round(confidence, 1)
        
    except Exception as e:
        print(f"Confidence calculation error: {e}")
        return 75.0  # Default fallback

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded", "disease": "Model not ready"}), 200
    
    try:
        data = request.json
        user_selections = data.get('symptoms', [])
        patient_id = data.get('patient_id', None)
        
        # Create input vector
        input_vector = np.zeros(len(features))
        matched_symptoms = []
        for s in user_selections:
            s_clean = s.strip().lower().replace(" ", "_")
            if s_clean in features:
                input_vector[features.index(s_clean)] = 1
                matched_symptoms.append(s_clean)
        
        # Predict and get probabilities
        prediction = model.predict([input_vector])[0]
        
        # Get prediction probabilities for confidence
        try:
            probabilities = model.predict_proba([input_vector])
            confidence = calculate_confidence(user_selections, prediction, probabilities)
        except:
            confidence = calculate_confidence(user_selections, prediction)
        
        # Get home remedies
        remedies = disease_remedies.get(prediction, {}).get('remedies', 
            ['Consult a doctor for proper diagnosis', 'Get adequate rest', 'Stay hydrated', 'Monitor symptoms'])
        
        # Save to database if patient logged in
        saved = False
        if patient_id:
            try:
                new_prediction = Prediction(
                    patient_id=patient_id,
                    symptoms=json.dumps(user_selections),
                    predicted_disease=prediction,
                    confidence=confidence
                )
                db.session.add(new_prediction)
                db.session.commit()
                saved = True
                print(f"✅ Saved prediction for {patient_id}: {prediction} ({confidence}%)")
            except Exception as e:
                print(f"Save error: {e}")
        
        return jsonify({
            "disease": prediction,
            "confidence": confidence,
            "remedies": remedies,
            "saved": saved,
            "matched_symptoms_count": len(matched_symptoms),
            "total_symptoms": len(user_selections),
            "message": "Prediction completed" + (" and saved!" if saved else "")
        })
        
    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({"error": str(e), "disease": "Error in prediction"}), 200

@app.route('/patient/<patient_id>/history', methods=['GET'])
def get_patient_history(patient_id):
    """Get all predictions with confidence and remedies for a patient"""
    predictions = Prediction.query.filter_by(patient_id=patient_id).order_by(Prediction.created_at.desc()).all()
    
    history = []
    for pred in predictions:
        try:
            symptoms_list = json.loads(pred.symptoms)
        except:
            symptoms_list = []
        
        # Get remedies for this disease
        remedies = disease_remedies.get(pred.predicted_disease, {}).get('remedies', 
            ['Consult doctor', 'Rest properly', 'Stay hydrated', 'Monitor symptoms'])
        
        history.append({
            "id": pred.id,
            "date": pred.created_at.strftime("%Y-%m-%d %H:%M"),
            "symptoms": symptoms_list,
            "disease": pred.predicted_disease,
            "confidence": pred.confidence,
            "remedies": remedies
        })
    
    return jsonify({"history": history})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok", 
        "model_loaded": model is not None,
        "remedies_loaded": len(disease_remedies) > 0
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("✅ Database created!")
    print("🚀 Server running on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)