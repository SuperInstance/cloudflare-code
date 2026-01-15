#!/bin/bash

# Basic authentication test using curl

echo "🔐 Testing ClaudeFlare Authentication System"
echo "============================================"

BASE_URL="http://localhost:8787"

# Test 1: Health Check
echo "1. Testing Health Endpoint..."
curl -s "$BASE_URL/health"
echo -e "\n\n"

# Test 2: Login with demo credentials
echo "2. Testing User Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@claudeflare.com","password":"admin123!"}')

echo "Login Response:"
echo $LOGIN_RESPONSE
echo ""

# Extract token from login response (simple check)
echo $LOGIN_RESPONSE | grep -q "accessToken"
if [ $? -eq 0 ]; then
    echo "✅ Login successful"

    # Test 3: Access protected endpoint without authentication
    echo "3. Testing Protected Endpoint (No Auth)..."
    curl -s -X POST "$BASE_URL/api/v1/code-review" \
      -H "Content-Type: application/json" \
      -d '{"content":"console.log("Hello World");","filePath":"test.js"}'
    echo -e "\n\n"

    # Test 4: Access protected endpoint with authentication
    echo "4. Testing Protected Endpoint (With Auth)..."
    # Extract token more precisely
    TOKEN=$(echo $LOGIN_RESPONSE | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
    if [ -n "$TOKEN" ]; then
        curl -s -X POST "$BASE_URL/api/v1/code-review" \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $TOKEN" \
          -d '{"content":"console.log("Hello World");","filePath":"test.js"}'
        echo -e "\n\n"
    fi

    # Test 5: Get user profile
    echo "5. Testing User Profile..."
    curl -s -H "Authorization: Bearer $TOKEN" \
      "$BASE_URL/api/v1/auth/profile"
    echo -e "\n\n"

    # Test 6: Create API key
    echo "6. Testing API Key Creation..."
    API_KEY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/api-keys" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"name":"Test API Key","permissions":["read","write"]}')

    echo "API Key Response:"
    echo $API_KEY_RESPONSE
    echo ""

    # Extract API key
    echo $API_KEY_RESPONSE | grep -q "apiKey"
    if [ $? -eq 0 ]; then
        echo "✅ API Key created successfully"

        # Test 7: Use API key to access protected endpoint
        echo "7. Testing API Key Authentication..."
        API_KEY=$(echo $API_KEY_RESPONSE | sed -n 's/.*"apiKey":"\([^"]*\)".*/\1/p')
        if [ -n "$API_KEY" ]; then
            curl -s -X POST "$BASE_URL/api/v1/code-review" \
              -H "Content-Type: application/json" \
              -H "X-API-Key: $API_KEY" \
              -d '{"content":"console.log("Hello API Key");","filePath":"test.js"}'
            echo -e "\n\n"
        fi
    fi

else
    echo "❌ Login failed"
    echo "Login Error:"
    echo $LOGIN_RESPONSE
fi

# Test 8: Logout
if [ -n "$TOKEN" ]; then
    echo "8. Testing Logout..."
    curl -s -X POST "$BASE_URL/api/v1/auth/logout" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"accessToken":"'$TOKEN'"}'
    echo -e "\n\n"
fi

echo "🎉 Authentication System Test Complete!"