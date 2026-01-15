#!/bin/bash

# Simple authentication test using curl

echo "🔐 Testing ClaudeFlare Authentication System"
echo "============================================"

BASE_URL="http://localhost:8787"

# Test 1: Health Check
echo "1. Testing Health Endpoint..."
curl -s "$BASE_URL/health" | jq '.status'
echo ""

# Test 2: Login with demo credentials
echo "2. Testing User Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@claudeflare.com","password":"admin123!"}')

echo "Login Response:"
echo $LOGIN_RESPONSE | jq .
echo ""

# Extract token from login response
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token.accessToken // empty')
if [ -n "$TOKEN" ]; then
    echo "✅ Login successful"

    # Test 3: Access protected endpoint without authentication
    echo "3. Testing Protected Endpoint (No Auth)..."
    curl -s -X POST "$BASE_URL/api/v1/code-review" \
      -H "Content-Type: application/json" \
      -d '{"content":"console.log(\"Hello World\");","filePath":"test.js"}' | jq '.success'
    echo ""

    # Test 4: Access protected endpoint with authentication
    echo "4. Testing Protected Endpoint (With Auth)..."
    curl -s -X POST "$BASE_URL/api/v1/code-review" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"content":"console.log(\"Hello World\");","filePath":"test.js"}' | jq '.success'
    echo ""

    # Test 5: Get user profile
    echo "5. Testing User Profile..."
    curl -s -H "Authorization: Bearer $TOKEN" \
      "$BASE_URL/api/v1/auth/profile" | jq '.success'
    echo ""

    # Test 6: Create API key
    echo "6. Testing API Key Creation..."
    API_KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/api-keys" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"name":"Test API Key","permissions":["read","write"]}')

    echo "API Key Response:"
    echo $API_KEY_RESPONSE | jq .
    echo ""

    # Extract API key
    API_KEY=$(echo $API_KEY_RESPONSE | jq -r '.apiKey // empty')
    if [ -n "$API_KEY" ]; then
        echo "✅ API Key created successfully"

        # Test 7: Use API key to access protected endpoint
        echo "7. Testing API Key Authentication..."
        curl -s -X POST "$BASE_URL/api/v1/code-review" \
          -H "Content-Type: application/json" \
          -H "X-API-Key: $API_KEY" \
          -d '{"content":"console.log(\"Hello API Key\");","filePath":"test.js"}' | jq '.success'
        echo ""
    fi

else
    echo "❌ Login failed"
    echo "Login Error:"
    echo $LOGIN_RESPONSE | jq '.error // empty'
fi

# Test 8: Logout
if [ -n "$TOKEN" ]; then
    echo "8. Testing Logout..."
    curl -s -X POST "$BASE_URL/api/v1/auth/logout" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"accessToken":"'$TOKEN'"}' | jq '.success'
    echo ""
fi

echo "🎉 Authentication System Test Complete!"