#!/bin/bash

# Security Testing API Integration Test Script
# Tests all the security testing endpoints

echo "🚀 Starting Security Testing API Integration Tests"

# Base URL - adjust if needed
API_BASE="http://localhost:8787/api/v1"

# Function to make API calls and display results
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4

    echo -e "\n🔍 Testing $method $endpoint"
    echo "Description: $description"

    if [ -n "$data" ]; then
        response=$(curl -s -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\nHTTP_STATUS:%{http_code}" \
            "$API_BASE$endpoint")
    else
        response=$(curl -s -X $method \
            -H "Content-Type: application/json" \
            -w "\nHTTP_STATUS:%{http_code}" \
            "$API_BASE$endpoint")
    fi

    # Extract HTTP status code
    http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
    response_body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')

    echo "Status: $http_status"
    echo "Response:"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"

    return $http_status
}

# Test 1: Health check
make_request "GET" "/security-test/health" "" "Check security testing service health"

# Test 2: Get available scan types
make_request "GET" "/security-test/types" "" "Get available scan types"

# Test 3: Get compliance frameworks
make_request "GET" "/security-test/compliance-frameworks" "" "Get compliance frameworks"

# Test 4: Get statistics (initial state)
make_request "GET" "/security-test/stats" "" "Get initial statistics"

# Test 5: Quick scan with vulnerable code
make_request "POST" "/security-test/quick" "{
    \"target\": \"inline-code\",
    \"content\": \"$(echo -n "$testCode" | base64 -w 0)\"
}" "Quick scan with vulnerable code (base64 encoded)"

# Test 6: Full security scan with vulnerable code
make_request "POST" "/security-test" "{
    \"target\": \"inline-code\",
    \"targetType\": \"code\",
    \"content\": \"$(echo -n "$testCode" | base64 -w 0)\",
    \"options\": {
        \"enableSAST\": true,
        \"enableSCA\": false,
        \"enableDAST\": false,
        \"enableCompliance\": false,
        \"severityThreshold\": \"medium\"
    }
}" "Full security scan with vulnerable code"

# Test 7: Scan with package.json (simulated)
make_request "POST" "/security-test" "{
    \"target\": \"package.json\",
    \"targetType\": \"dependency\",
    \"options\": {
        \"enableSAST\": false,
        \"enableSCA\": true,
        \"enableDAST\": false,
        \"enableCompliance\": false,
        \"includeDevDependencies\": true,
        \"includeTransitiveDependencies\": true
    }
}" "Dependency scan simulation"

# Test 8: Compliance scan
make_request "POST" "/security-test" "{
    \"target\": \"./src\",
    \"targetType\": \"code\",
    \"options\": {
        \"enableSAST\": false,
        \"enableSCA\": false,
        \"enableDAST\": false,
        \"enableCompliance\": true,
        \"frameworks\": [\"SOC_2\", \"ISO_27001\"],
        \"severityThreshold\": \"high\"
    }
}" "Compliance scan with SOC 2 and ISO 27001"

# Test 9: Scan with multiple frameworks
make_request "POST" "/security-test" "{
    \"target\": \"./src\",
    \"targetType\": \"code\",
    \"options\": {
        \"enableSAST\": true,
        \"enableSCA\": true,
        \"enableDAST\": false,
        \"enableCompliance\": true,
        \"frameworks\": [\"PCI_DSS\", \"GDPR\", \"HIPAA\"],
        \"severityThreshold\": \"medium\"
    }
}" "Comprehensive scan with multiple frameworks"

# Test 10: DAST scan simulation
make_request "POST" "/security-test" "{
    \"target\": \"https://example.com\",
    \"targetType\": \"url\",
    \"options\": {
        \"enableSAST\": false,
        \"enableSCA\": false,
        \"enableDAST\": true,
        \"enableCompliance\": false
    }
}" "DAST scan simulation"

# Test 11: Get statistics after scans
make_request "GET" "/security-test/stats" "" "Get statistics after running scans"

# Test 12: Test error handling - missing target
make_request "POST" "/security-test" "{
    \"options\": {
        \"enableSAST\": true
    }
}" "Test error handling - missing target"

# Test 13: Test error handling - invalid scan ID
make_request "GET" "/security-test/status/invalid-scan-id" "" "Test error handling - invalid scan ID"

# Test 14: Vulnerability lookup
make_request "GET" "/security-test/vulnerability/npm/express/4.18.0" "" "Vulnerability lookup"

echo -e "\n✅ All tests completed!"
echo ""
echo "📋 Summary of available endpoints:"
echo "  - POST /api/v1/security-test - Main security scan endpoint"
echo "  - POST /api/v1/security-test/quick - Quick security scan"
echo "  - GET /api/v1/security-test/types - Get scan types"
echo "  - GET /api/v1/security-test/compliance-frameworks - Get compliance frameworks"
echo "  - GET /api/v1/security-test/stats - Get statistics"
echo "  - GET /api/v1/security-test/status/:scanId - Get scan status"
echo "  - GET /api/v1/security-test/health - Health check"
echo "  - GET /api/v1/security-test/vulnerability/:ecosystem/:package/:version - Vulnerability lookup"