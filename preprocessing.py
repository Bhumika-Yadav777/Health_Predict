import numpy as np

# These are the 131 unique symptoms found in your dataset.csv
SYMPTOMS_LIST = [
    'abdominal_pain', 'abnormal_menstruation', 'acidity', 'acute_liver_failure', 
    'altered_sensorium', 'anxiety', 'back_pain', 'belly_pain', 'blackheads', 
    'bladder_discomfort', 'blister', 'blood_in_sputum', 'bloody_stool', 
    'blurred_and_distorted_vision', 'breathlessness', 'brittle_nails', 
    'bruising', 'burning_micturition', 'chest_pain', 'chills', 'cold_hands_and_feets',
    # ... include all 131 symptoms here ...
]

def clean_user_input(user_symptoms):
    # Convert "Chest Pain" -> "chest_pain" to match CSV columns
    cleaned_list = [s.strip().lower().replace(" ", "_") for s in user_symptoms]
    
    input_vector = np.zeros(len(SYMPTOMS_LIST))
    for s in cleaned_list:
        if s in SYMPTOMS_LIST:
            index = SYMPTOMS_LIST.index(s)
            input_vector[index] = 1
    return input_vector.reshape(1, -1)
  
