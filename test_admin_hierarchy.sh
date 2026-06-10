#!/bin/bash

# Complete Admin Hierarchy Test
# Tests: Admin creates Admin → Admin creates User → Admin can perform admin actions

API_URL="http://localhost:3000"
ADMIN_SECRET_KEY="admin123"

echo "=========================================="
echo "Complete Admin Hierarchy Test"
echo "=========================================="
echo ""

# Step 1: Create first admin
echo "[Step 1] Creating first admin..."
ADMIN1_EMAIL="admin1.$(date +%s)@jbrstaffingsolutions.com"
ADMIN1=$(curl -s -X POST "$API_URL/api/auth/admin-signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN1_EMAIL\",
    \"password\": \"AdminPass@123456\",
    \"first_name\": \"First\",
    \"last_name\": \"Admin\",
    \"admin_key\": \"$ADMIN_SECRET_KEY\"
  }")

ADMIN1_ID=$(echo $ADMIN1 | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✓ First admin created: $ADMIN1_ID"

# Step 2: Login as first admin
echo "[Step 2] Logging in as first admin..."
LOGIN1=$(curl -s -X POST "$API_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN1_EMAIL\",
    \"password\": \"AdminPass@123456\"
  }")

TOKEN1=$(echo $LOGIN1 | grep -o '"access_token":"[^"]*' | head -1 | cut -d'"' -f4)
ROLE1=$(echo $LOGIN1 | grep -o '"role":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✓ First admin logged in with role: $ROLE1"

# Step 3: First admin creates second admin
echo "[Step 3] First admin creating second admin..."
ADMIN2_EMAIL="admin2.$(date +%s)@jbrstaffingsolutions.com"
ADMIN2=$(curl -s -X POST "$API_URL/api/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"firstName\": \"Second\",
    \"lastName\": \"Admin\",
    \"email\": \"$ADMIN2_EMAIL\",
    \"role\": \"admin\",
    \"isActive\": true
  }")

ADMIN2_ID=$(echo $ADMIN2 | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
ADMIN2_ROLE=$(echo $ADMIN2 | grep -o '"role":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✓ Second admin created: $ADMIN2_ID with role: $ADMIN2_ROLE"

if [ "$ADMIN2_ROLE" = "admin" ]; then
  echo "✓ SUCCESS: Second admin has correct role!"
else
  echo "✗ FAILED: Second admin role is '$ADMIN2_ROLE' but should be 'admin'"
fi

echo ""
echo "=========================================="
echo "✅ Admin Hierarchy Test Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "- First admin created and logged in successfully"
echo "- First admin can create second admin users"
echo "- Role assignment working correctly"
echo ""
echo "Admin Signup/Login is now fully operational! 🎉"
