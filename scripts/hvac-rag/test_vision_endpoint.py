import requests
import base64
import json

def test_vision_intake():
    url = "http://127.0.0.1:4019/v1/vision/intake"
    
    # Dummy base64 (very small 1x1 pixel)
    image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    
    payload = {
        "image": image_base64,
        "session_id": "test-session-vision",
        "hints": ["placa inverter", "lg"]
    }
    
    print(f"Sending request to {url}...")
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_vision_intake()
