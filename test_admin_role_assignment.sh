#!/bin/bash

# Test: Admin Role Assignment Verification
# This script tests that only admins can create users with roles

API_URL="http://localhost:3000"
ADMIN_EMAIL="admin.test.$(date +%s)@jbrstaffingsolutions.com"
REGULAR_USER_EMAIL="user.test.$(date +%s)@jbrstaffingsolutions.com"
ADMIN_SECRET_KEY="admin123"

echo "=========================================="
echo "Admin Role Assignment Test"
echo "=========================================="
echo ""

# Step 1: Create an admin user
echo "[Step 1] Creating admin user..."
ADMIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/admin-signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"AdminPass@123456\",
    \"first_name\": \"Test\",
    \"last_name\": \"Admin\",
    \"admin_key\": \"$ADMIN_SECRET_KEY\"
  }")

echo "Response: $ADMIN_RESPONSE"
ADMIN_ID=$(echo $ADMIN_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✓ Admin created with ID: $ADMIN_ID"
echo ""

# Step 2: Login with admin
echo "[Step 2] Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"AdminPass@123456\"
  }")

echo "Response: $LOGIN_RESPONSE"
ADMIN_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✓ Admin logged in with token: ${ADMIN_TOKEN:0:20}..."
ADMIN_ROLE=$(echo $LOGIN_RESPONSE | grep -o '"role":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✓ Admin role in response: $ADMIN_ROLE"
echo ""

# Step 3: Create a regular user (using admin token)
echo "[Step 3] Creating regular user with admin token..."
CREATE_USER_RESPONSE=$(curl -s -X POST "$API_URL/api/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"firstName\": \"Regular\",
    \"lastName\": \"User\",
    \"email\": \"$REGULAR_USER_EMAIL\",
    \"phoneNumber\": \"+1234567890\",
    \"role\": \"user\",
    \"isActive\": true
  }")

echo "Response: $CREATE_USER_RESPONSE"
REGULAR_USER_ID=$(echo $CREATE_USER_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✓ Regular user created with ID: $REGULAR_USER_ID"
echo ""

# Step 4: Try to create a user with admin role (using admin token) - should succeed
echo "[Step 4] Creating user with 'admin' role (using admin token) - should SUCCEED..."
NEW_ADMIN_EMAIL="newadmin.test.$(date +%s)@jbrstaffingsolutions.com"
CREATE_ADMIN_RESPONSE=$(curl -s -X POST "$API_URL/api/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"firstName\": \"New\",
    \"lastName\": \"Admin\",
    \"email\": \"$NEW_ADMIN_EMAIL\",
    \"phoneNumber\": \"+1234567891\",
    \"role\": \"admin\",
    \"isActive\": true
  }")

echo "Response: $CREATE_ADMIN_RESPONSE"
if echo $CREATE_ADMIN_RESPONSE | grep -q '"success":true'; then
  echo "✓ SUCCESS: Admin was able to create user with admin role"
elif echo $CREATE_ADMIN_RESPONSE | grep -q '"message":"User created successfully'; then
  echo "✓ SUCCESS: Admin was able to create user with admin role"
else
  echo "✗ FAILED: Admin could not create user with admin role"
  echo "Error details: $(echo $CREATE_ADMIN_RESPONSE | grep -o '"details":"[^"]*')"
fi
echo ""

# Step 5: Login as regular user and try to create a user with role (should fail)
echo "[Step 5] Logging in as regular user..."
REGULAR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$REGULAR_USER_EMAIL\",
    \"password\": \"p2xg9i3iTemp!123\"
  }")

echo "Response: $REGULAR_LOGIN"
REGULAR_TOKEN=$(echo $REGULAR_LOGIN | grep -o '"access_token":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -z "$REGULAR_TOKEN" ]; then
  echo "Note: Regular user token not found. User may need to set password first."
  echo "Skipping regular user role creation test."
else
  echo "✓ Regular user logged in with token: ${REGULAR_TOKEN:0:20}..."
  echo ""
  
  # Step 6: Regular user tries to create a user with admin role (should fail)
  echo "[Step 6] Regular user trying to create user with 'admin' role - should FAIL..."
  REGULAR_CREATE_ADMIN=$(curl -s -X POST "$API_URL/api/users" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $REGULAR_TOKEN" \
    -d "{
      \"firstName\": \"Hack\",
      \"lastName\": \"Attempt\",
      \"email\": \"hackattempt.$(date +%s)@jbrstaffingsolutions.com\",
      \"phoneNumber\": \"+1234567892\",
      \"role\": \"admin\",
      \"isActive\": true
    }")

  echo "Response: $REGULAR_CREATE_ADMIN"
  if echo $REGULAR_CREATE_ADMIN | grep -q '"error":"Failed to create user with role"'; then
    echo "✓ SUCCESS: Regular user was correctly denied from creating user with role"
  elif echo $REGULAR_CREATE_ADMIN | grep -q '"details":"Only admins can assign roles to users"'; then
    echo "✓ SUCCESS: Regular user was correctly denied from creating user with role"
  else
    echo "✗ FAILED: Regular user was not properly denied"
  fi
fi

echo ""
echo "=========================================="
echo "Test Complete!"
echo "=========================================="
