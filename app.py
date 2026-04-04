from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd

app = Flask(__name__)
CORS(app)

# Database Setup
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
db = SQLAlchemy(app)

# User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)

# Load Model and symptom names
model = joblib.load('model.pkl')
features = joblib.load('symptoms_features.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    user_selections = data.get('symptoms', []) # e.g. ["itching", "skin_rash"]
    
    # Preprocessing: Create the 1/0 array
    input_vector = np.zeros(len(features))
    for s in user_selections:
        s_clean = s.strip().lower().replace(" ", "_")
        if s_clean in features:
            input_vector[features.index(s_clean)] = 1
            
    # Predict
    prediction = model.predict([input_vector])[0]
    return jsonify({"disease": prediction})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    if user and user.password == data['password']: # Use hashing in real apps!
        return jsonify({"message": "Login Successful", "status": "success"})
    return jsonify({"message": "Invalid Credentials", "status": "fail"}), 401

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    user_selections = data.get('symptoms', [])
    
    input_vector = np.zeros(len(features))
    for s in user_selections:
        s_clean = s.strip().lower().replace(" ", "_")
        if s_clean in features:
            input_vector[features.index(s_clean)] = 1
            
    # Reshape to (1, -1) because it's a single sample
    prediction = model.predict(input_vector.reshape(1, -1))[0]
    return jsonify({"disease": prediction})
