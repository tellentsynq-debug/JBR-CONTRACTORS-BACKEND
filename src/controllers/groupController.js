const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;

/**
 * Create a new candidate group
 * POST /groups
 * @body {string} name - Group name (required)
 * @body {string} description - Group description (optional)
 * @body {boolean} is_active - Active status (default: true)
 */
exports.createGroup = async (req, res) => {
  try {
    const { name, description, is_active = true } = req.body;
    const userId = req.userId; // From JWT middleware

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Group name is required' 
      });
    }

    // Check if group name already exists (case-insensitive)
    const { data: existingGroup } = await supabaseAdmin
      .from('candidate_groups')
      .select('id')
      .ilike('name', name)
      .single();

    if (existingGroup) {
      return res.status(400).json({ 
        error: 'Group name already exists' 
      });
    }

    // Create new group
    const { data: newGroup, error: insertError } = await supabaseAdmin
      .from('candidate_groups')
      .insert([{
        name: name.trim(),
        description: description?.trim() || null,
        is_active,
        created_by: userId
      }])
      .select();

    if (insertError) {
      console.error('Error creating group:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create group',
        details: insertError.message 
      });
    }

    res.status(201).json({
      message: 'Group created successfully',
      data: newGroup[0]
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ 
      error: 'Failed to create group',
      details: error.message 
    });
  }
};

/**
 * Get all candidate groups
 * GET /groups
 * @query {string} search - Filter by name or description
 * @query {boolean} active_only - Show only active groups
 */
exports.getAllGroups = async (req, res) => {
  try {
    const { search, active_only } = req.query;

    let query = supabaseAdmin
      .from('candidate_groups')
      .select(`
        id,
        name,
        description,
        is_active,
        created_by,
        created_at,
        updated_at,
        candidate_group_members(count)
      `)
      .order('created_at', { ascending: false });

    // Filter by active status if requested
    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    const { data: groups, error } = await query;

    if (error) {
      console.error('Error retrieving groups:', error);
      return res.status(500).json({ 
        error: 'Failed to retrieve groups',
        details: error.message 
      });
    }

    // Filter by search term if provided
    let filteredGroups = groups;
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase();
      filteredGroups = groups.filter(grp => 
        grp.name.toLowerCase().includes(searchLower) ||
        (grp.description && grp.description.toLowerCase().includes(searchLower))
      );
    }

    // Map member counts
    const groupsWithCounts = filteredGroups.map(grp => ({
      ...grp,
      member_count: grp.candidate_group_members?.[0]?.count || 0
    }));

    res.status(200).json({
      message: 'Groups retrieved successfully',
      count: groupsWithCounts.length,
      data: groupsWithCounts
    });
  } catch (error) {
    console.error('Error retrieving groups:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve groups',
      details: error.message 
    });
  }
};

/**
 * Get group by ID with members
 * GET /groups/:id
 * @query {number} limit - Pagination limit (default: 50)
 * @query {number} offset - Pagination offset (default: 0)
 */
exports.getGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!id) {
      return res.status(400).json({ 
        error: 'Group ID is required' 
      });
    }

    // Get group details
    const { data: group, error: groupError } = await supabaseAdmin
      .from('candidate_groups')
      .select(`
        *,
        candidate_group_members(count)
      `)
      .eq('id', id)
      .single();

    if (groupError) {
      if (groupError.code === 'PGRST116') {
        return res.status(404).json({ 
          error: 'Group not found' 
        });
      }
      console.error('Error retrieving group:', groupError);
      return res.status(500).json({ 
        error: 'Failed to retrieve group',
        details: groupError.message 
      });
    }

    // Get members with pagination
    const { data: members, error: membersError } = await supabaseAdmin
      .from('candidate_group_members')
      .select(`
        id,
        candidate_id,
        assigned_by,
        assigned_at,
        candidates(id, first_name, last_name, email, phone_number)
      `)
      .eq('group_id', id)
      .range(offset, offset + limit - 1)
      .order('assigned_at', { ascending: false });

    if (membersError) {
      console.error('Error retrieving members:', membersError);
      return res.status(500).json({ 
        error: 'Failed to retrieve group members',
        details: membersError.message 
      });
    }

    res.status(200).json({
      message: 'Group retrieved successfully',
      data: {
        ...group,
        member_count: group.candidate_group_members?.[0]?.count || 0,
        members
      }
    });
  } catch (error) {
    console.error('Error retrieving group:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve group',
      details: error.message 
    });
  }
};

/**
 * Update group
 * PATCH /groups/:id
 */
exports.updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    if (!id) {
      return res.status(400).json({ 
        error: 'Group ID is required' 
      });
    }

    // Validation - at least one field must be provided
    if (name === undefined && description === undefined && is_active === undefined) {
      return res.status(400).json({ 
        error: 'At least one field (name, description, or is_active) must be provided' 
      });
    }

    // Check if group exists
    const { data: existingGroup, error: checkError } = await supabaseAdmin
      .from('candidate_groups')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existingGroup) {
      return res.status(404).json({ 
        error: 'Group not found' 
      });
    }

    // Check if new name already exists (if name is being updated)
    if (name) {
      const { data: duplicateName } = await supabaseAdmin
        .from('candidate_groups')
        .select('id')
        .ilike('name', name)
        .neq('id', id)
        .single();

      if (duplicateName) {
        return res.status(400).json({ 
          error: 'Group name already exists' 
        });
      }
    }

    // Build update object
    const updateObj = {};
    if (name !== undefined) updateObj.name = name.trim();
    if (description !== undefined) updateObj.description = description?.trim() || null;
    if (is_active !== undefined) updateObj.is_active = is_active;

    // Update group
    const { data: updatedGroup, error: updateError } = await supabaseAdmin
      .from('candidate_groups')
      .update(updateObj)
      .eq('id', id)
      .select();

    if (updateError) {
      console.error('Error updating group:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update group',
        details: updateError.message 
      });
    }

    res.status(200).json({
      message: 'Group updated successfully',
      data: updatedGroup[0]
    });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ 
      error: 'Failed to update group',
      details: error.message 
    });
  }
};

/**
 * Delete group
 * DELETE /groups/:id
 */
exports.deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'Group ID is required' 
      });
    }

    // Check if group exists
    const { data: existingGroup, error: checkError } = await supabaseAdmin
      .from('candidate_groups')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingGroup) {
      return res.status(404).json({ 
        error: 'Group not found' 
      });
    }

    // Delete all members first
    const { error: deletemembersError } = await supabaseAdmin
      .from('candidate_group_members')
      .delete()
      .eq('group_id', id);

    if (deletemembersError) {
      console.error('Error deleting group members:', deletemembersError);
      return res.status(500).json({ 
        error: 'Failed to delete group members',
        details: deletemembersError.message 
      });
    }

    // Delete group
    const { error: deleteError } = await supabaseAdmin
      .from('candidate_groups')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting group:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete group',
        details: deleteError.message 
      });
    }

    res.status(200).json({
      message: 'Group deleted successfully',
      data: {
        id: existingGroup.id,
        name: existingGroup.name
      }
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ 
      error: 'Failed to delete group',
      details: error.message 
    });
  }
};

/**
 * Add candidates to group (Bulk)
 * POST /groups/:id/add-members
 * @body {array} candidate_ids - Array of candidate UUIDs
 */
exports.addCandidatesToGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { candidate_ids } = req.body;
    const userId = req.userId; // From JWT middleware

    if (!id) {
      return res.status(400).json({ 
        error: 'Group ID is required' 
      });
    }

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return res.status(400).json({ 
        error: 'candidate_ids array is required and must not be empty' 
      });
    }

    // Check if group exists
    const { data: group, error: groupError } = await supabaseAdmin
      .from('candidate_groups')
      .select('id')
      .eq('id', id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ 
        error: 'Group not found' 
      });
    }

    // Verify all candidates exist
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .in('id', candidate_ids);

    if (candidatesError) {
      console.error('Error verifying candidates:', candidatesError);
      return res.status(500).json({ 
        error: 'Failed to verify candidates',
        details: candidatesError.message 
      });
    }

    if (candidates.length !== candidate_ids.length) {
      return res.status(400).json({ 
        error: 'Some candidate IDs do not exist' 
      });
    }

    // Check for existing memberships
    const { data: existingMembers } = await supabaseAdmin
      .from('candidate_group_members')
      .select('candidate_id')
      .eq('group_id', id)
      .in('candidate_id', candidate_ids);

    const existingCandidateIds = existingMembers?.map(m => m.candidate_id) || [];
    const newCandidateIds = candidate_ids.filter(cid => !existingCandidateIds.includes(cid));

    if (newCandidateIds.length === 0) {
      return res.status(400).json({ 
        error: 'All candidates are already members of this group' 
      });
    }

    // Insert new memberships
    const memberships = newCandidateIds.map(candidateId => ({
      group_id: id,
      candidate_id: candidateId,
      assigned_by: userId,
      assigned_at: new Date().toISOString()
    }));

    const { data: newMembers, error: insertError } = await supabaseAdmin
      .from('candidate_group_members')
      .insert(memberships)
      .select();

    if (insertError) {
      console.error('Error adding candidates to group:', insertError);
      return res.status(500).json({ 
        error: 'Failed to add candidates to group',
        details: insertError.message 
      });
    }

    res.status(201).json({
      message: 'Candidates added to group successfully',
      added_count: newMembers.length,
      skipped_count: candidate_ids.length - newMembers.length,
      data: newMembers
    });
  } catch (error) {
    console.error('Error adding candidates to group:', error);
    res.status(500).json({ 
      error: 'Failed to add candidates to group',
      details: error.message 
    });
  }
};

/**
 * Remove candidates from group (Bulk)
 * POST /groups/:id/remove-members
 * @body {array} candidate_ids - Array of candidate UUIDs
 */
exports.removeCandidatesFromGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { candidate_ids } = req.body;

    if (!id) {
      return res.status(400).json({ 
        error: 'Group ID is required' 
      });
    }

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return res.status(400).json({ 
        error: 'candidate_ids array is required and must not be empty' 
      });
    }

    // Check if group exists
    const { data: group, error: groupError } = await supabaseAdmin
      .from('candidate_groups')
      .select('id')
      .eq('id', id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ 
        error: 'Group not found' 
      });
    }

    // Delete memberships
    const { error: deleteError, count } = await supabaseAdmin
      .from('candidate_group_members')
      .delete()
      .eq('group_id', id)
      .in('candidate_id', candidate_ids);

    if (deleteError) {
      console.error('Error removing candidates from group:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to remove candidates from group',
        details: deleteError.message 
      });
    }

    res.status(200).json({
      message: 'Candidates removed from group successfully',
      removed_count: count || 0
    });
  } catch (error) {
    console.error('Error removing candidates from group:', error);
    res.status(500).json({ 
      error: 'Failed to remove candidates from group',
      details: error.message 
    });
  }
};

/**
 * Get candidates by group
 * GET /groups/:id/members
 * @query {number} limit - Pagination limit (default: 50)
 * @query {number} offset - Pagination offset (default: 0)
 */
exports.getGroupMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!id) {
      return res.status(400).json({ 
        error: 'Group ID is required' 
      });
    }

    // Check if group exists
    const { data: group, error: groupError } = await supabaseAdmin
      .from('candidate_groups')
      .select('id, name')
      .eq('id', id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ 
        error: 'Group not found' 
      });
    }

    // Get members
    const { data: members, error: membersError, count } = await supabaseAdmin
      .from('candidate_group_members')
      .select(`
        id,
        candidate_id,
        assigned_by,
        assigned_at,
        candidates(
          id,
          first_name,
          last_name,
          email,
          phone_number,
          job_category_id,
          job_industry_id
        )
      `, { count: 'exact' })
      .eq('group_id', id)
      .range(offset, offset + parseInt(limit) - 1)
      .order('assigned_at', { ascending: false });

    if (membersError) {
      console.error('Error retrieving members:', membersError);
      return res.status(500).json({ 
        error: 'Failed to retrieve members',
        details: membersError.message 
      });
    }

    res.status(200).json({
      message: 'Group members retrieved successfully',
      group: {
        id: group.id,
        name: group.name
      },
      total_count: count,
      members_count: members.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      },
      data: members
    });
  } catch (error) {
    console.error('Error retrieving group members:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve group members',
      details: error.message 
    });
  }
};

/**
 * Get all groups for a candidate
 * GET /candidates/:candidateId/groups
 */
exports.getCandidateGroups = async (req, res) => {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      return res.status(400).json({ 
        error: 'Candidate ID is required' 
      });
    }

    // Verify candidate exists
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      return res.status(404).json({ 
        error: 'Candidate not found' 
      });
    }

    // Get candidate's groups
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('candidate_group_members')
      .select(`
        id,
        assigned_at,
        candidate_groups(
          id,
          name,
          description,
          is_active
        )
      `)
      .eq('candidate_id', candidateId)
      .order('assigned_at', { ascending: false });

    if (groupsError) {
      console.error('Error retrieving candidate groups:', groupsError);
      return res.status(500).json({ 
        error: 'Failed to retrieve candidate groups',
        details: groupsError.message 
      });
    }

    const mappedGroups = groups.map(item => ({
      ...item.candidate_groups,
      membership_id: item.id,
      assigned_at: item.assigned_at
    }));

    res.status(200).json({
      message: 'Candidate groups retrieved successfully',
      candidate_id: candidateId,
      count: mappedGroups.length,
      data: mappedGroups
    });
  } catch (error) {
    console.error('Error retrieving candidate groups:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve candidate groups',
      details: error.message 
    });
  }
};
