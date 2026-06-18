#!/bin/bash

# Employee Chat API - Test Script
# This script tests all endpoints of the chat application
# Update the BASE_URL, JWT_TOKEN, and test data as needed

BASE_URL="http://localhost:3000/api"
JWT_TOKEN="your-jwt-token-here"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test data
EMPLOYEE_ID="123e4567-e89b-12d3-a456-426614174000"
MOBILE_NUMBER="+92-300-1234567"
CAMPAIGN_ID=1
JOB_CATEGORY_ID=1
JOB_INDUSTRY_ID=1

echo -e "${BLUE}=== Employee Chat API Test Suite ===${NC}\n"

# Test 1: Register Mobile Number
echo -e "${YELLOW}TEST 1: Register Mobile Number${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/employee-job-mobile/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"employee_id\": \"$EMPLOYEE_ID\",
    \"candidate_id\": 123,
    \"mobile_number\": \"$MOBILE_NUMBER\",
    \"job_category_id\": $JOB_CATEGORY_ID,
    \"job_industry_id\": $JOB_INDUSTRY_ID
  }")

if echo "$RESPONSE" | grep -q "Mobile number registered"; then
  echo -e "${GREEN}✓ PASSED${NC}"
  MAPPING_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Mobile mapping created: $MAPPING_ID"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 2: Send OTP
echo -e "${YELLOW}TEST 2: Send OTP${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/employee-job-mobile/send-otp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"employee_id\": \"$EMPLOYEE_ID\",
    \"mobile_number\": \"$MOBILE_NUMBER\"
  }")

if echo "$RESPONSE" | grep -q "OTP sent successfully"; then
  echo -e "${GREEN}✓ PASSED${NC}"
  OTP=$(echo "$RESPONSE" | grep -o '"otp":"[^"]*"' | cut -d'"' -f4)
  echo "OTP sent: $OTP"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 3: Verify OTP (requires OTP from Test 2)
if [ ! -z "$OTP" ]; then
  echo -e "${YELLOW}TEST 3: Verify OTP${NC}"
  RESPONSE=$(curl -s -X POST "$BASE_URL/employee-job-mobile/verify-otp" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d "{
      \"employee_id\": \"$EMPLOYEE_ID\",
      \"mobile_number\": \"$MOBILE_NUMBER\",
      \"otp\": \"$OTP\"
    }")

  if echo "$RESPONSE" | grep -q "Mobile number verified"; then
    echo -e "${GREEN}✓ PASSED${NC}"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $RESPONSE"
  fi
  echo ""
fi

# Test 4: Register Device Token
echo -e "${YELLOW}TEST 4: Register Device Token${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/employee-job-mobile/register-device-token" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"employee_id\": \"$EMPLOYEE_ID\",
    \"mobile_number\": \"$MOBILE_NUMBER\",
    \"device_token\": \"ExponentPushToken[test-token-12345]\",
    \"device_type\": \"android\"
  }")

if echo "$RESPONSE" | grep -q "Device token registered"; then
  echo -e "${GREEN}✓ PASSED${NC}"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 5: Get Employee Mobile Mappings
echo -e "${YELLOW}TEST 5: Get Employee Mobile Mappings${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/employee-job-mobile/$EMPLOYEE_ID?limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN")

if echo "$RESPONSE" | grep -q "pagination"; then
  echo -e "${GREEN}✓ PASSED${NC}"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 6: Get Active Employees by Job Category
echo -e "${YELLOW}TEST 6: Get Active Employees by Job Category${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/employee-job-mobile/job-category/$JOB_CATEGORY_ID/active?limit=50" \
  -H "Authorization: Bearer $JWT_TOKEN")

if echo "$RESPONSE" | grep -q "pagination"; then
  echo -e "${GREEN}✓ PASSED${NC}"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 7: Get Chat Statistics
echo -e "${YELLOW}TEST 7: Get Chat Statistics${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/employee-job-mobile/stats/chat-statistics?job_category_id=$JOB_CATEGORY_ID" \
  -H "Authorization: Bearer $JWT_TOKEN")

if echo "$RESPONSE" | grep -q "total_employees"; then
  echo -e "${GREEN}✓ PASSED${NC}"
  echo "Response: $RESPONSE" | head -50
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 8: Start Chat Session
echo -e "${YELLOW}TEST 8: Start Chat Session${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/chat/sessions/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"employee_id\": \"$EMPLOYEE_ID\",
    \"mobile_number\": \"$MOBILE_NUMBER\",
    \"campaign_id\": $CAMPAIGN_ID,
    \"job_category_id\": $JOB_CATEGORY_ID
  }")

if echo "$RESPONSE" | grep -q "Chat session created"; then
  echo -e "${GREEN}✓ PASSED${NC}"
  SESSION_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Session created: $SESSION_ID"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 9: Send Message (requires SESSION_ID from Test 8)
if [ ! -z "$SESSION_ID" ]; then
  echo -e "${YELLOW}TEST 9: Send Message${NC}"
  RESPONSE=$(curl -s -X POST "$BASE_URL/chat/messages/send" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d "{
      \"session_id\": \"$SESSION_ID\",
      \"employee_id\": \"$EMPLOYEE_ID\",
      \"message_text\": \"Hello, I want to apply for this job\",
      \"message_type\": \"text\",
      \"sender_type\": \"employee\"
    }")

  if echo "$RESPONSE" | grep -q "Message sent"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    MESSAGE_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "Message sent: $MESSAGE_ID"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $RESPONSE"
  fi
  echo ""

  # Test 10: Get Session Messages
  echo -e "${YELLOW}TEST 10: Get Session Messages${NC}"
  RESPONSE=$(curl -s -X GET "$BASE_URL/chat/messages/$SESSION_ID?limit=50&employee_id=$EMPLOYEE_ID" \
    -H "Authorization: Bearer $JWT_TOKEN")

  if echo "$RESPONSE" | grep -q "data"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    MESSAGE_COUNT=$(echo "$RESPONSE" | grep -o '"message_text"' | wc -l)
    echo "Messages retrieved: $MESSAGE_COUNT"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $RESPONSE"
  fi
  echo ""

  # Test 11: Get Unread Count for Session
  echo -e "${YELLOW}TEST 11: Get Unread Count for Session${NC}"
  RESPONSE=$(curl -s -X GET "$BASE_URL/chat/messages/$SESSION_ID/unread?employee_id=$EMPLOYEE_ID" \
    -H "Authorization: Bearer $JWT_TOKEN")

  if echo "$RESPONSE" | grep -q "unread_count"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    UNREAD=$(echo "$RESPONSE" | grep -o '"unread_count":[0-9]*' | cut -d':' -f2)
    echo "Unread count: $UNREAD"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $RESPONSE"
  fi
  echo ""

  # Test 12: Get Employee's Active Sessions
  echo -e "${YELLOW}TEST 12: Get Employee's Active Sessions${NC}"
  RESPONSE=$(curl -s -X GET "$BASE_URL/chat/sessions/$EMPLOYEE_ID?limit=20" \
    -H "Authorization: Bearer $JWT_TOKEN")

  if echo "$RESPONSE" | grep -q "data"; then
    echo -e "${GREEN}✓ PASSED${NC}"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $RESPONSE"
  fi
  echo ""

  # Test 13: Get Total Unread Messages
  echo -e "${YELLOW}TEST 13: Get Total Unread Messages${NC}"
  RESPONSE=$(curl -s -X GET "$BASE_URL/chat/unread/$EMPLOYEE_ID/total" \
    -H "Authorization: Bearer $JWT_TOKEN")

  if echo "$RESPONSE" | grep -q "total_unread"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    TOTAL_UNREAD=$(echo "$RESPONSE" | grep -o '"total_unread":[0-9]*' | cut -d':' -f2)
    echo "Total unread: $TOTAL_UNREAD"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $RESPONSE"
  fi
  echo ""

  # Test 14: Get Employee by Mobile Number
  echo -e "${YELLOW}TEST 14: Get Employee by Mobile Number${NC}"
  RESPONSE=$(curl -s -X GET "$BASE_URL/chat/employee/$MOBILE_NUMBER" \
    -H "Authorization: Bearer $JWT_TOKEN")

  if echo "$RESPONSE" | grep -q "employee_id"; then
    echo -e "${GREEN}✓ PASSED${NC}"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $RESPONSE"
  fi
  echo ""

  # Test 15: Close Chat Session
  echo -e "${YELLOW}TEST 15: Close Chat Session${NC}"
  RESPONSE=$(curl -s -X PATCH "$BASE_URL/chat/sessions/$SESSION_ID/close" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN")

  if echo "$RESPONSE" | grep -q "Chat session closed"; then
    echo -e "${GREEN}✓ PASSED${NC}"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $RESPONSE"
  fi
  echo ""
fi

# Test 16: Update Last Active Time
echo -e "${YELLOW}TEST 16: Update Last Active Time${NC}"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/employee-job-mobile/update-active" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"employee_id\": \"$EMPLOYEE_ID\",
    \"mobile_number\": \"$MOBILE_NUMBER\"
  }")

if echo "$RESPONSE" | grep -q "Last active time updated"; then
  echo -e "${GREEN}✓ PASSED${NC}"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Response: $RESPONSE"
fi
echo ""

echo -e "${BLUE}=== Test Suite Complete ===${NC}\n"
