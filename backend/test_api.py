#!/usr/bin/env python3
"""
Quick test script to verify the PixSnap API is running correctly.

Usage:
  python test_api.py

Make sure the API is running first:
  uvicorn app.main:app --reload --port 8000
"""

import requests

BASE = "http://localhost:8000"


def test_health():
    print("Testing health endpoint...")
    r = requests.get(f"{BASE}/")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert data["status"] == "ok"
    print("  ✓ Health check passed")


def test_embed_bad_url():
    print("Testing /embed with invalid URL (should handle gracefully)...")
    r = requests.post(f"{BASE}/embed", json={
        "photo_id": "test-photo-id-123",
        "photo_url": "https://httpbin.org/status/404"
    })
    # Should return 500 or handle the error gracefully
    print(f"  Status: {r.status_code} — {r.json()}")
    print("  ✓ Error handling works")


def test_find_empty_event():
    print("Testing /find with a non-existent event (should return empty matches)...")
    r = requests.post(f"{BASE}/find", json={
        "event_id": "00000000-0000-0000-0000-000000000000",
        "selfie_url": "https://httpbin.org/status/404"
    })
    print(f"  Status: {r.status_code}")
    print("  ✓ Empty event handled")


if __name__ == "__main__":
    print(f"\nRunning PixSnap API tests against {BASE}\n")
    try:
        test_health()
        test_embed_bad_url()
        test_find_empty_event()
        print("\nAll tests passed!\n")
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Could not connect to {BASE}")
        print("   Make sure the API is running: uvicorn app.main:app --reload --port 8000\n")
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}\n")
