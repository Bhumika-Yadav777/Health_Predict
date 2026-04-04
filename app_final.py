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
import re

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
symptom_mapping = {
    'fever': 'high_fever',
    'cough': 'cough',
    'headache': 'headache',
    'fatigue': 'fatigue',
    'nausea': 'nausea',
    'vomiting': 'vomiting',
    'diarrhea': 'diarrhoea',
    'chest pain': 'chest_pain',
    'shortness of breath': 'breathlessness',
    'dizziness': 'dizziness',
    'sore throat': 'throat_irritation',
    'body aches': 'muscle_pain',
    'chills': 'chills',
    'loss of appetite': 'loss_of_appetite',
    'runny nose': 'runny_nose',
    'sneezing': 'continuous_sneezing',
    'itching': 'itching',
    'skin rash': 'skin_rash',
    'joint pain': 'joint_pain',
    'stomach pain': 'stomach_pain'
}

# Load disease remedies from CSV
try:
    if os.path.exists('disease_info.csv'):
        remedies_df = pd.read_csv('disease_info.csv')
        for _, row in remedies_df.iterrows():
            disease = row['Disease']
            disease_remedies[disease] = {
                'remedies': [row['HomeRemedy1'], row['HomeRemedy2'], row['HomeRemedy3'], row['HomeRemedy4']],
                'confidence_boost': 0.85
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

def map_symptom(symptom):
    """Map common symptom names to model symptom names"""
    symptom_lower = symptom.lower().strip()
    if symptom_lower in symptom_mapping:
        return symptom_mapping[symptom_lower]
    symptom_clean = symptom_lower.replace(" ", "_")
    if symptom_clean in features:
        return symptom_clean
    for key in symptom_mapping:
        if key in symptom_lower or symptom_lower in key:
            return symptom_mapping[key]
    return None

def calculate_confidence(symptoms, predicted_disease, model_proba=None):
    """Calculate confidence percentage between 70-95%"""
    try:
        confidence = 70.0
        symptom_boost = min(10, (len(symptoms) / 10) * 10)
        confidence += symptom_boost
        
        if model_proba is not None and len(model_proba) > 0:
            max_proba = max(model_proba[0]) * 100
            proba_boost = min(10, max_proba / 10)
            confidence += proba_boost
        
        if predicted_disease in disease_remedies:
            confidence += 5
        
        confidence = min(max(confidence, 70.0), 95.0)
        return round(confidence, 1)
        
    except Exception as e:
        print(f"Confidence calculation error: {e}")
        return 75.0

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded", "disease": "Model not ready"}), 200
    
    try:
        data = request.json
        user_selections = data.get('symptoms', [])
        patient_id = data.get('patient_id', None)
        
        print(f"Received symptoms: {user_selections}")
        
        mapped_symptoms = []
        input_vector = np.zeros(len(features))
        
        for s in user_selections:
            mapped = map_symptom(s)
            if mapped and mapped in features:
                input_vector[features.index(mapped)] = 1
                mapped_symptoms.append(mapped)
                print(f"  Mapped: {s} -> {mapped}")
        
        if len(mapped_symptoms) == 0:
            for s in user_selections:
                s_clean = s.lower().strip().replace(" ", "_")
                if s_clean in features:
                    input_vector[features.index(s_clean)] = 1
                    mapped_symptoms.append(s_clean)
        
        prediction = model.predict([input_vector])[0]
        print(f"Prediction: {prediction}")
        
        try:
            probabilities = model.predict_proba([input_vector])
            confidence = calculate_confidence(user_selections, prediction, probabilities)
        except:
            confidence = calculate_confidence(user_selections, prediction)
        
        remedies = disease_remedies.get(prediction, {}).get('remedies', 
            ['Consult a doctor for proper diagnosis', 'Get adequate rest', 'Stay hydrated', 'Monitor symptoms'])
        
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
            "matched_symptoms_count": len(mapped_symptoms),
            "total_symptoms": len(user_selections),
            "message": "Prediction completed" + (" and saved!" if saved else "")
        })
        
    except Exception as e:
        print(f"Prediction error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "disease": "Error in prediction"}), 200

@app.route('/patient/<patient_id>/history', methods=['GET'])
def get_patient_history(patient_id):
    """Get all predictions for a patient"""
    predictions = Prediction.query.filter_by(patient_id=patient_id).order_by(Prediction.created_at.desc()).all()
    
    history = []
    for pred in predictions:
        try:
            symptoms_list = json.loads(pred.symptoms)
        except:
            symptoms_list = []
        
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

@app.route('/patient/<patient_id>/info', methods=['GET'])
def get_patient_info(patient_id):
    """Get patient info by email"""
    user = User.query.filter_by(email=patient_id).first()
    if user:
        return jsonify({
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "joined": user.created_at.strftime("%Y-%m-%d") if user.created_at else "N/A"
        })
    return jsonify({"error": "Patient not found"}), 404

@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')
        role = data.get('role', 'patient')
        
        existing = User.query.filter_by(email=email).first()
        if existing:
            return jsonify({"error": "Email already registered"}), 400
        
        new_user = User(email=email, password=password, name=name, role=role)
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({"message": "User registered successfully", "user_id": new_user.id}), 200
    except Exception as e:
        print(f"Register error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("✅ Database created!")
    print("🚀 Server running on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)