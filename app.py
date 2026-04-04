from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import joblib
import numpy as np
import json
from datetime import datetime

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Load Model and symptom names
try:
    model = joblib.load('model.pkl')
    features = joblib.load('symptoms_features.pkl')
    print(f"Model loaded successfully! Features: {len(features)}")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None
    features = []

# SINGLE predict endpoint
@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded properly"}), 500
    
    try:
        data = request.json
        user_selections = data.get('symptoms', [])
        patient_id = data.get('patient_id', None)
        
        # Preprocessing: Create the 1/0 array
        input_vector = np.zeros(len(features))
        for s in user_selections:
            s_clean = s.strip().lower().replace(" ", "_")
            if s_clean in features:
                input_vector[features.index(s_clean)] = 1
        
        # Predict
        prediction = model.predict([input_vector])[0]
        
        # SAVE TO DATABASE if patient is logged in
        saved = False
        if patient_id:
            try:
                new_prediction = Prediction(
                    patient_id=patient_id,
                    symptoms=json.dumps(user_selections),
                    predicted_disease=prediction
                )
                db.session.add(new_prediction)
                db.session.commit()
                saved = True
                print(f"Saved prediction for {patient_id}: {prediction}")
            except Exception as e:
                print(f"Error saving to database: {e}")
        
        return jsonify({
            "disease": prediction,
            "saved": saved,
            "message": "Prediction completed" + (" and saved!" if saved else "")
        })
        
    except Exception as e:
        print(f"Error in predict: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    if user and user.password == data['password']:
        return jsonify({
            "message": "Login Successful", 
            "status": "success",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role
            }
        })
    return jsonify({"message": "Invalid Credentials", "status": "fail"}), 401

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    existing = User.query.filter_by(email=data['email']).first()
    if existing:
        return jsonify({"message": "Email already exists", "status": "fail"}), 400
    
    new_user = User(
        email=data['email'],
        password=data['password'],
        name=data.get('name', ''),
        role=data.get('role', 'patient')
    )
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({"message": "Registration successful", "status": "success"})

@app.route('/patient/<patient_id>/history', methods=['GET'])
def get_patient_history(patient_id):
    """Get all predictions for a specific patient"""
    predictions = Prediction.query.filter_by(patient_id=patient_id).order_by(Prediction.created_at.desc()).all()
    
    history = []
    for pred in predictions:
        try:
            symptoms_list = json.loads(pred.symptoms)
        except:
            symptoms_list = []
        history.append({
            "id": pred.id,
            "date": pred.created_at.strftime("%Y-%m-%d %H:%M"),
            "symptoms": symptoms_list,
            "disease": pred.predicted_disease
        })
    
    return jsonify({"history": history})

@app.route('/predictions/all', methods=['GET'])
def get_all_predictions():
    """Get all predictions (for doctor dashboard)"""
    predictions = Prediction.query.order_by(Prediction.created_at.desc()).limit(50).all()
    
    results = []
    for pred in predictions:
        try:
            symptoms_list = json.loads(pred.symptoms)
        except:
            symptoms_list = []
        results.append({
            "patient_id": pred.patient_id,
            "date": pred.created_at.strftime("%Y-%m-%d %H:%M"),
            "symptoms": symptoms_list,
            "disease": pred.predicted_disease
        })
    
    return jsonify({"predictions": results})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("Database created successfully!")
    print("Starting Flask server on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
