import torch
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from torch.utils.data import Dataset, DataLoader

# Load saved model
class TFTModel(torch.nn.Module):
    def __init__(self, input_size):
        super(TFTModel, self).__init__()
        self.fc1 = torch.nn.Linear(input_size, 128)
        self.fc2 = torch.nn.Linear(128, 64)
        self.fc3 = torch.nn.Linear(64, 1)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        x = self.fc3(x)
        return x

# Load model function
def load_model():
    model = TFTModel(input_size=20)  # Set input_size based on your preprocessed features
    model.load_state_dict(torch.load("best_model.pth"))
    model.eval()
    return model

# Prediction function
def predict_sales(input_data):
    model = load_model()
    input_tensor = torch.tensor(np.array(input_data), dtype=torch.float32)
    with torch.no_grad():
        prediction = model(input_tensor)
    return prediction.numpy().tolist()
