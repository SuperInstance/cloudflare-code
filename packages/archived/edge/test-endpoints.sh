#!/bin/bash
# Test script for ClaudeFlare Edge API endpoints

BASE_URL="http://localhost:8787"

echo "Testing ClaudeFlare Edge API Endpoints..."
echo "========================================"
echo ""

# Test 1: Root endpoint
echo "1. Testing GET /"
curl -s ${BASE_URL}/ | jq . 2>/dev/null || echo "Failed"
echo ""
echo ""

# Test 2: Health endpoint
echo "2. Testing GET /health"
curl -s ${BASE_URL}/health | jq . 2>/dev/null || echo "Failed"
echo ""
echo ""

# Test 3: Status endpoint
echo "3. Testing GET /v1/status"
curl -s ${BASE_URL}/v1/status | jq . 2>/dev/null || echo "Failed"
echo ""
echo ""

# Test 4: Models endpoint
echo "4. Testing GET /v1/models"
curl -s ${BASE_URL}/v1/models | jq . 2>/dev/null || echo "Failed"
echo ""
echo ""

# Test 5: Chat endpoint (POST)
echo "5. Testing POST /v1/chat"
curl -s -X POST ${BASE_URL}/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}' | jq . 2>/dev/null || echo "Failed"
echo ""
echo ""

# Test 6: 404 endpoint
echo "6. Testing 404 on GET /v1/unknown"
curl -s ${BASE_URL}/v1/unknown | jq . 2>/dev/null || echo "Failed"
echo ""
echo ""

echo "========================================"
echo "Tests completed!"
