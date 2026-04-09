# test_context.py
from flask import Flask
from app import app  # Replace with the direct import path for your app
from app.models import get_class_by_id

# Push application context
with app.app_context():
    try:
        result = get_class_by_id(2)  # Test with a valid class ID
        print("Class details:", result)
    except Exception as e:
        print("Error:", e)




