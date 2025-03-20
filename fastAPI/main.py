from fastapi import FastAPI
from pydantic import BaseModel
import torch
import pandas as pd
import numpy as np
import joblib
import torch.nn as nn
from typing import List

# Load pre-trained model and other resources
MODEL_VERSION = 1
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Define the model class
class TFTModel(nn.Module):
    def __init__(self, input_size):
        super(TFTModel, self).__init__()
        self.fc1 = nn.Linear(input_size, 128)
        self.fc2 = nn.Linear(128, 64)
        self.fc3 = nn.Linear(64, 1)  # Output layer for regression

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        x = self.fc3(x)
        return x

# Load the pre-trained model
model = TFTModel(input_size=287)  # Update with actual input size
model.load_state_dict(torch.load(f'./best_model.pth', map_location=device))
model.to(device).eval()

# Load the pre-fitted encoder and scaler from .pkl files
encoder = joblib.load("encoder.pkl")  # Ensure encoder.pkl is in the same folder
scaler = joblib.load("scaler.pkl")    # Ensure scaler.pkl is in the same folder

# Define FastAPI app
app = FastAPI()

class SalesData(BaseModel):
    distributor_id: str
    industry: str
    sku: str
    category: str
    movement_category: str
    sales: float
    avg_quarterly_sales: float
    total_quarter_sales: float
    prev_quarter_sales: float
    is_diwali: bool
    is_ganesh_chaturthi: bool
    is_gudi_padwa: bool
    is_eid: bool
    is_akshay_tritiya: bool
    is_dussehra_navratri: bool
    is_onam: bool
    is_christmas: bool
    time_idx: float

# Preprocessing function
def preprocess_data(data, encoder, scaler):
    categorical_features = ['distributor_id', 'industry', 'sku', 'category', 'movement_category']
    numerical_features = ['sales', 'avg_quarterly_sales', 'total_quarter_sales', 'prev_quarter_sales',
                          'is_diwali', 'is_ganesh_chaturthi', 'is_gudi_padwa', 'is_eid',
                          'is_akshay_tritiya', 'is_dussehra_navratri', 'is_onam', 'is_christmas', 'time_idx']

    # One-hot encoding for categorical features
    encoded_categorical = encoder.transform(data[categorical_features])

    # Scaling numerical features
    scaled_numerical = scaler.transform(data[numerical_features])

    # Combine processed features
    processed_data = np.hstack((encoded_categorical, scaled_numerical))

    return processed_data

# Prediction endpoint
@app.post("/predict/")
def predict_sales(data: List[SalesData]):
    # Convert input data to a DataFrame
    input_data = pd.DataFrame([item.dict() for item in data])
    
    # Preprocess the data
    processed_data = preprocess_data(input_data, encoder, scaler)
    
    # Convert to tensor and move to device
    features = torch.tensor(processed_data, dtype=torch.float32).to(device)
    
    # Make predictions
    with torch.no_grad():
        predictions = model(features).squeeze().cpu().numpy()
    
    return {"predicted_sales": predictions.tolist()}

# Run the FastAPI app
# Run with: uvicorn main:app --reload