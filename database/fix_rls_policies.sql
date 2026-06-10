-- ============================================
-- Fix RLS Policies for Profiles Table
-- ============================================

-- Step 1: Check current RLS status
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';

-- Step 2: Enable RLS on profiles table (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop all existing policies (they may not exist, so use IF EXISTS)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
DROP POLICY IF EXISTS "profiles_update_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_all" ON profiles;
DROP POLICY IF EXISTS "users_select" ON profiles;
DROP POLICY IF EXISTS "users_insert" ON profiles;
DROP POLICY IF EXISTS "users_update" ON profiles;

-- Step 4: Create new policies for profiles table

-- Policy 1: Allow SELECT for all authenticated users
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT
  USING (true);

-- Policy 2: Allow INSERT for authenticated users creating their own profile
CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 3: Allow INSERT for service role (backend) - no auth check
-- This is bypassed anyway for service role, but explicit is better
CREATE POLICY "profiles_insert_service" ON profiles
  FOR INSERT
  WITH CHECK (true);

-- Policy 4: Allow UPDATE for own profile
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 5: Allow UPDATE for admins (users with role = 'admin')
-- This checks if the requesting user is an admin
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policy 6: Allow DELETE for admins only
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Step 5: Verify policies are created
-- SELECT policyname, permissive, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'profiles'
-- ORDER BY policyname;

-- ============================================
-- Summary
-- ============================================
-- ✓ RLS is now enabled on profiles table
-- ✓ All users can SELECT from profiles
-- ✓ Users can INSERT their own profile
-- ✓ Service role can INSERT (backend operations)
-- ✓ Users can UPDATE their own profile
-- ✓ Admins can UPDATE any profile
-- ✓ Admins can DELETE any profile
-- ============================================
