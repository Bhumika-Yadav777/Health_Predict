import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib

# 1. Load your dataset
df = pd.read_csv('dataset.csv')

# 2. Convert wide symptoms to a 1/0 matrix
# This gathers all unique symptoms from the Symptom_1...17 columns
X = pd.get_dummies(df.iloc[:, 1:], prefix='', prefix_sep='').groupby(level=0, axis=1).max()
y = df['Disease']

# 3. Train the Random Forest
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X, y)

# 4. Save the model and the list of symptoms (columns) for the backend
joblib.dump(model, 'model.pkl')
joblib.dump(X.columns.tolist(), 'symptoms_features.pkl')
print("Model and Features saved successfully!")