const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;

/**
 * Get Dashboard Stats and Charts Data
 * GET /dashboard
 * @protected - Requires authentication
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Parallel queries for all dashboard data
    const [
      totalCandidatesResult,
      activeCampaignsResult,
      verifiedCandidatesResult,
      licenseExpiringResult,
      campaignChartResult,
      recentActivityResult,
      candidatesByJobResult,
      verificationChartResult
    ] = await Promise.all([
      // 1. Total Candidates (excluding deleted)
      supabaseAdmin
        .from('candidates')
        .select('id', { count: 'exact' })
        .is('deleted_at', null),

      // 2. Active Campaigns
      supabaseAdmin
        .from('campaigns')
        .select('id', { count: 'exact' })
        .eq('is_active', true)
        .is('deleted_at', null),

      // 3. Verified Candidates
      supabaseAdmin
        .from('candidates')
        .select('id', { count: 'exact' })
        .eq('verification_status', 'verified')
        .is('deleted_at', null),

      // 4. License Expiring (Current Month/Year)
      supabaseAdmin
        .from('candidates')
        .select('id, license_expiry_month, license_expiry_year', { count: 'exact' })
        .is('deleted_at', null),

      // 5. Campaign Chart Data (Registrations per Campaign)
      supabaseAdmin
        .from('campaigns')
        .select(`
          id,
          name,
          candidates(count)
        `)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10),

      // 6. Recent Activities (Latest 5)
      supabaseAdmin
        .from('candidates')
        .select(`
          id,
          first_name,
          last_name,
          job_category_id,
          job_categories(name),
          verification_status,
          created_at
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5),

      // 7. Candidates by Job Category
      supabaseAdmin
        .from('candidates')
        .select(`
          job_category_id,
          job_categories(name)
        `)
        .is('deleted_at', null),

      // 8. Verified vs Unverified
      supabaseAdmin
        .from('candidates')
        .select('verification_status', { count: 'exact' })
        .is('deleted_at', null)
    ]);

    // Check for errors
    if (totalCandidatesResult.error) throw totalCandidatesResult.error;
    if (activeCampaignsResult.error) throw activeCampaignsResult.error;
    if (verifiedCandidatesResult.error) throw verifiedCandidatesResult.error;
    if (licenseExpiringResult.error) throw licenseExpiringResult.error;
    if (campaignChartResult.error) throw campaignChartResult.error;
    if (recentActivityResult.error) throw recentActivityResult.error;
    if (candidatesByJobResult.error) throw candidatesByJobResult.error;
    if (verificationChartResult.error) throw verificationChartResult.error;

    // Calculate derived metrics
    const totalCandidates = totalCandidatesResult.count || 0;
    const verifiedCandidates = verifiedCandidatesResult.count || 0;
    const activeCampaigns = activeCampaignsResult.count || 0;
    const conversionRate = totalCandidates > 0 ? ((verifiedCandidates / totalCandidates) * 100).toFixed(2) : 0;

    // Calculate license expiring this month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();
    const licenseExpiringCount = licenseExpiringResult.data?.filter(candidate => {
      return candidate.license_expiry_month === currentMonth && 
             candidate.license_expiry_year === currentYear;
    }).length || 0;

    // Process Campaign Chart Data
    const campaignChartData = campaignChartResult.data?.map(campaign => ({
      name: campaign.name,
      registrations: campaign.candidates?.[0]?.count || 0
    })) || [];

    // Process Recent Activity
    const recentActivityData = recentActivityResult.data?.map(activity => {
      const createdAt = new Date(activity.created_at);
      const now = new Date();
      const diffMs = now - createdAt;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo = 'Just now';
      if (diffMins > 0) timeAgo = `${diffMins}m ago`;
      if (diffHours > 0) timeAgo = `${diffHours}h ago`;
      if (diffDays > 0) timeAgo = `${diffDays}d ago`;

      return {
        id: activity.id,
        type: 'candidate_registered',
        message: `${activity.first_name} ${activity.last_name} registered`,
        jobCategory: activity.job_categories?.name || 'N/A',
        status: activity.verification_status === 'verified' ? 'success' : 'pending',
        timeAgo: timeAgo,
        timestamp: activity.created_at
      };
    }) || [];

    // Process Candidates by Job Category
    const jobCategoryMap = {};
    candidatesByJobResult.data?.forEach(candidate => {
      const categoryName = candidate.job_categories?.name || 'Unassigned';
      jobCategoryMap[categoryName] = (jobCategoryMap[categoryName] || 0) + 1;
    });

    const candidatesByJobData = Object.entries(jobCategoryMap).map(([category, count]) => ({
      category,
      count
    }));

    // Process Verified vs Unverified Chart
    const verificationStats = {
      verified: verifiedCandidates,
      unverified: totalCandidates - verifiedCandidates
    };

    // Build response
    res.status(200).json({
      message: 'Dashboard statistics retrieved successfully',
      stats: {
        totalCandidates,
        activeCampaigns,
        verifiedCandidates,
        licenseExpiring: licenseExpiringCount,
        conversionRate: `${conversionRate}%`
      },
      charts: {
        campaignPerformance: campaignChartData,
        candidatesByJob: candidatesByJobData,
        verificationStatus: verificationStats,
        recentActivity: recentActivityData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error retrieving dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to retrieve dashboard statistics',
      details: error.message
    });
  }
};

/**
 * Get Dashboard Summary (Lightweight version)
 * GET /dashboard/summary
 * @protected - Requires authentication
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const [
      totalCandidatesResult,
      activeCampaignsResult,
      verifiedCandidatesResult,
      licenseExpiringResult
    ] = await Promise.all([
      supabaseAdmin
        .from('candidates')
        .select('id', { count: 'exact' })
        .is('deleted_at', null),

      supabaseAdmin
        .from('campaigns')
        .select('id', { count: 'exact' })
        .eq('is_active', true)
        .is('deleted_at', null),

      supabaseAdmin
        .from('candidates')
        .select('id', { count: 'exact' })
        .eq('verification_status', 'verified')
        .is('deleted_at', null),

      supabaseAdmin
        .from('candidates')
        .select('license_expiry_month, license_expiry_year')
        .is('deleted_at', null)
    ]);

    if (totalCandidatesResult.error) throw totalCandidatesResult.error;
    if (activeCampaignsResult.error) throw activeCampaignsResult.error;
    if (verifiedCandidatesResult.error) throw verifiedCandidatesResult.error;
    if (licenseExpiringResult.error) throw licenseExpiringResult.error;

    const totalCandidates = totalCandidatesResult.count || 0;
    const verifiedCandidates = verifiedCandidatesResult.count || 0;
    const conversionRate = totalCandidates > 0 ? ((verifiedCandidates / totalCandidates) * 100).toFixed(2) : 0;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const licenseExpiringCount = licenseExpiringResult.data?.filter(candidate => {
      return candidate.license_expiry_month === currentMonth && 
             candidate.license_expiry_year === currentYear;
    }).length || 0;

    res.status(200).json({
      message: 'Dashboard summary retrieved successfully',
      summary: {
        totalCandidates,
        activeCampaigns: activeCampaignsResult.count || 0,
        verifiedCandidates,
        licenseExpiring: licenseExpiringCount,
        conversionRate: `${conversionRate}%`
      }
    });

  } catch (error) {
    console.error('Error retrieving dashboard summary:', error);
    res.status(500).json({
      error: 'Failed to retrieve dashboard summary',
      details: error.message
    });
  }
};
