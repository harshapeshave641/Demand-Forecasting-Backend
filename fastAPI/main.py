from fastapi import FastAPI
import numpy as np
from sklearn.linear_model import LinearRegression

app = FastAPI()

# Temporary model setup
X_train = np.array([[1], [2], [3], [4], [5]])
y_train = np.array([10, 20, 30, 40, 50])
model = LinearRegression().fit(X_train, y_train)

@app.get("/")
def root():
    return {"message": "FastAPI is running"}

@app.post("/predict")
def predict(data: dict):
    quarter = data.get("quarter", 1)
    prediction = model.predict([[quarter]])[0]
    return {"quarter": quarter, "predicted_value": prediction}
