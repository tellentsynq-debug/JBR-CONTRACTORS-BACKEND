const supabase = require('../config/database');
const supabaseAdmin = supabase.admin;

/**
 * Helper function to calculate date range
 */
const getDateRange = (days = null) => {
  const today = new Date();
  let startDate = null;
  
  if (days) {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);
  }
  
  return {
    startDate: startDate?.toISOString(),
    today: today.toISOString()
  };
};

/**
 * Get Industry-wise Candidate Report
 * GET /master-report/industries
 * @query {number} days - Recent additions (7, 30, 90, etc)
 * @query {string} search - Filter by industry name
 * @query {string} sort - Sort by 'count' or 'name'
 * @query {string} order - 'asc' or 'desc'
 */
exports.getIndustryReport = async (req, res) => {
  try {
    const { days, search, sort = 'count', order = 'desc' } = req.query;

    // Fetch all candidates with industry data
    let query = supabaseAdmin
      .from('candidates')
      .select(`
        id,
        job_industry_id,
        job_industries(name),
        verification_status,
        created_at
      `)
      .is('deleted_at', null);

    const { data: candidates, error } = await query;

    if (error) throw error;

    // Group by industry
    const industryMap = {};
    const dateRange = getDateRange(parseInt(days) || null);

    candidates.forEach(candidate => {
      const industryId = candidate.job_industry_id;
      const industryName = candidate.job_industries?.name || 'Unassigned';

      if (!industryMap[industryId]) {
        industryMap[industryId] = {
          id: industryId,
          name: industryName,
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }

      industryMap[industryId].total += 1;
      
      if (candidate.verification_status === 'verified') {
        industryMap[industryId].verified += 1;
      } else {
        industryMap[industryId].unverified += 1;
      }

      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        industryMap[industryId].recentAdditions += 1;
      }
    });

    let reports = Object.values(industryMap);

    // Apply search filter
    if (search) {
      reports = reports.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Apply sorting
    reports.sort((a, b) => {
      let aVal = sort === 'count' ? a.total : a.name.toLowerCase();
      let bVal = sort === 'count' ? b.total : b.name.toLowerCase();
      
      if (sort === 'count') {
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      } else {
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
    });

    res.status(200).json({
      message: 'Industry-wise report retrieved successfully',
      filters: { days: days || 'all', search: search || 'none', sort, order },
      totalIndustries: reports.length,
      data: reports,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error retrieving industry report:', error);
    res.status(500).json({
      error: 'Failed to retrieve industry report',
      details: error.message
    });
  }
};

/**
 * Get Category-wise Candidate Report
 * GET /master-report/categories
 * @query {string} industry_id - Filter by specific industry
 * @query {number} days - Recent additions
 * @query {string} search - Filter by category name
 * @query {string} sort - Sort by 'count' or 'name'
 */
exports.getCategoryReport = async (req, res) => {
  try {
    const { industry_id, days, search, sort = 'count', order = 'desc' } = req.query;

    let query = supabaseAdmin
      .from('candidates')
      .select(`
        id,
        job_category_id,
        job_categories(id, name, job_industry_id, job_industries(name)),
        verification_status,
        created_at
      `)
      .is('deleted_at', null);

    if (industry_id) {
      query = query.eq('job_industries.id', industry_id);
    }

    const { data: candidates, error } = await query;

    if (error) throw error;

    // Group by category
    const categoryMap = {};
    const dateRange = getDateRange(parseInt(days) || null);

    candidates.forEach(candidate => {
      const categoryId = candidate.job_category_id;
      const categoryName = candidate.job_categories?.name || 'Unassigned';
      const industryName = candidate.job_categories?.job_industries?.name || 'Unassigned';

      if (!categoryMap[categoryId]) {
        categoryMap[categoryId] = {
          id: categoryId,
          name: categoryName,
          industry: industryName,
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }

      categoryMap[categoryId].total += 1;
      
      if (candidate.verification_status === 'verified') {
        categoryMap[categoryId].verified += 1;
      } else {
        categoryMap[categoryId].unverified += 1;
      }

      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        categoryMap[categoryId].recentAdditions += 1;
      }
    });

    let reports = Object.values(categoryMap);

    // Apply search filter
    if (search) {
      reports = reports.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Apply sorting
    reports.sort((a, b) => {
      let aVal = sort === 'count' ? a.total : a.name.toLowerCase();
      let bVal = sort === 'count' ? b.total : b.name.toLowerCase();
      
      if (sort === 'count') {
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      } else {
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
    });

    res.status(200).json({
      message: 'Category-wise report retrieved successfully',
      filters: { industry_id: industry_id || 'all', days: days || 'all', search: search || 'none', sort, order },
      totalCategories: reports.length,
      data: reports,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error retrieving category report:', error);
    res.status(500).json({
      error: 'Failed to retrieve category report',
      details: error.message
    });
  }
};

/**
 * Get Province-wise Candidate Report
 * GET /master-report/provinces
 * @query {number} days - Recent additions
 * @query {string} search - Filter by province name
 * @query {string} sort - Sort by 'count' or 'name'
 */
exports.getProvinceReport = async (req, res) => {
  try {
    const { days, search, sort = 'count', order = 'desc' } = req.query;

    const { data: candidates, error } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        province_id,
        provinces(name, code),
        verification_status,
        created_at
      `)
      .is('deleted_at', null);

    if (error) throw error;

    // Group by province
    const provinceMap = {};
    const dateRange = getDateRange(parseInt(days) || null);

    candidates.forEach(candidate => {
      const provinceId = candidate.province_id;
      const provinceName = candidate.provinces?.name || 'Unassigned';
      const code = candidate.provinces?.code || '';

      if (!provinceMap[provinceId]) {
        provinceMap[provinceId] = {
          id: provinceId,
          name: provinceName,
          code,
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }

      provinceMap[provinceId].total += 1;
      
      if (candidate.verification_status === 'verified') {
        provinceMap[provinceId].verified += 1;
      } else {
        provinceMap[provinceId].unverified += 1;
      }

      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        provinceMap[provinceId].recentAdditions += 1;
      }
    });

    let reports = Object.values(provinceMap);

    // Apply search filter
    if (search) {
      reports = reports.filter(r => 
        r.name.toLowerCase().includes(search.toLowerCase()) || 
        r.code.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply sorting
    reports.sort((a, b) => {
      let aVal = sort === 'count' ? a.total : a.name.toLowerCase();
      let bVal = sort === 'count' ? b.total : b.name.toLowerCase();
      
      if (sort === 'count') {
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      } else {
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
    });

    res.status(200).json({
      message: 'Province-wise report retrieved successfully',
      filters: { days: days || 'all', search: search || 'none', sort, order },
      totalProvinces: reports.length,
      data: reports,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error retrieving province report:', error);
    res.status(500).json({
      error: 'Failed to retrieve province report',
      details: error.message
    });
  }
};

/**
 * Get City-wise Candidate Report
 * GET /master-report/cities
 * @query {string} province_id - Filter by specific province
 * @query {number} days - Recent additions
 * @query {string} search - Filter by city name
 * @query {string} sort - Sort by 'count' or 'name'
 */
exports.getCityReport = async (req, res) => {
  try {
    const { province_id, days, search, sort = 'count', order = 'desc' } = req.query;

    let query = supabaseAdmin
      .from('candidates')
      .select(`
        id,
        city_id,
        cities(id, name, province_id, provinces(name, code)),
        verification_status,
        created_at
      `)
      .is('deleted_at', null);

    if (province_id) {
      query = query.eq('cities.province_id', province_id);
    }

    const { data: candidates, error } = await query;

    if (error) throw error;

    // Group by city
    const cityMap = {};
    const dateRange = getDateRange(parseInt(days) || null);

    candidates.forEach(candidate => {
      const cityId = candidate.city_id;
      const cityName = candidate.cities?.name || 'Unassigned';
      const provinceName = candidate.cities?.provinces?.name || 'Unassigned';

      if (!cityMap[cityId]) {
        cityMap[cityId] = {
          id: cityId,
          name: cityName,
          province: provinceName,
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }

      cityMap[cityId].total += 1;
      
      if (candidate.verification_status === 'verified') {
        cityMap[cityId].verified += 1;
      } else {
        cityMap[cityId].unverified += 1;
      }

      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        cityMap[cityId].recentAdditions += 1;
      }
    });

    let reports = Object.values(cityMap);

    // Apply search filter
    if (search) {
      reports = reports.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Apply sorting
    reports.sort((a, b) => {
      let aVal = sort === 'count' ? a.total : a.name.toLowerCase();
      let bVal = sort === 'count' ? b.total : b.name.toLowerCase();
      
      if (sort === 'count') {
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      } else {
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
    });

    res.status(200).json({
      message: 'City-wise report retrieved successfully',
      filters: { province_id: province_id || 'all', days: days || 'all', search: search || 'none', sort, order },
      totalCities: reports.length,
      data: reports,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error retrieving city report:', error);
    res.status(500).json({
      error: 'Failed to retrieve city report',
      details: error.message
    });
  }
};

/**
 * Get Campaign-wise Candidate Report
 * GET /master-report/campaigns
 * @query {number} days - Recent additions
 * @query {string} search - Filter by campaign name
 * @query {string} sort - Sort by 'count' or 'name'
 */
exports.getCampaignReport = async (req, res) => {
  try {
    const { days, search, sort = 'count', order = 'desc' } = req.query;

    const { data: candidates, error } = await supabaseAdmin
      .from('candidates')
      .select(`
        id,
        campaign_id,
        campaigns(id, name, is_active),
        verification_status,
        created_at
      `)
      .is('deleted_at', null);

    if (error) throw error;

    // Group by campaign
    const campaignMap = {};
    const dateRange = getDateRange(parseInt(days) || null);

    candidates.forEach(candidate => {
      const campaignId = candidate.campaign_id;
      const campaignName = candidate.campaigns?.name || 'Unassigned';
      const isActive = candidate.campaigns?.is_active || false;

      if (!campaignMap[campaignId]) {
        campaignMap[campaignId] = {
          id: campaignId,
          name: campaignName,
          isActive,
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }

      campaignMap[campaignId].total += 1;
      
      if (candidate.verification_status === 'verified') {
        campaignMap[campaignId].verified += 1;
      } else {
        campaignMap[campaignId].unverified += 1;
      }

      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        campaignMap[campaignId].recentAdditions += 1;
      }
    });

    let reports = Object.values(campaignMap);

    // Apply search filter
    if (search) {
      reports = reports.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Apply sorting
    reports.sort((a, b) => {
      let aVal = sort === 'count' ? a.total : a.name.toLowerCase();
      let bVal = sort === 'count' ? b.total : b.name.toLowerCase();
      
      if (sort === 'count') {
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      } else {
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
    });

    res.status(200).json({
      message: 'Campaign-wise report retrieved successfully',
      filters: { days: days || 'all', search: search || 'none', sort, order },
      totalCampaigns: reports.length,
      data: reports,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error retrieving campaign report:', error);
    res.status(500).json({
      error: 'Failed to retrieve campaign report',
      details: error.message
    });
  }
};

/**
 * Get Group-wise Member Report
 * GET /master-report/groups
 * @query {number} days - Recent additions
 * @query {string} search - Filter by group name
 * @query {string} sort - Sort by 'count' or 'name'
 */
exports.getGroupReport = async (req, res) => {
  try {
    const { days, search, sort = 'count', order = 'desc' } = req.query;

    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('candidate_groups')
      .select(`
        id,
        name,
        is_active,
        created_at,
        candidate_group_members(id)
      `);

    if (groupsError) throw groupsError;

    let reports = groups.map(group => {
      const members = group.candidate_group_members || [];

      return {
        id: group.id,
        name: group.name,
        isActive: group.is_active,
        total: members.length,
        createdAt: group.created_at
      };
    });

    // Apply search filter
    if (search) {
      reports = reports.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Apply sorting
    reports.sort((a, b) => {
      let aVal = sort === 'count' ? a.total : a.name.toLowerCase();
      let bVal = sort === 'count' ? b.total : b.name.toLowerCase();
      
      if (sort === 'count') {
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      } else {
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
    });

    res.status(200).json({
      message: 'Group-wise report retrieved successfully',
      filters: { days: days || 'all', search: search || 'none', sort, order },
      totalGroups: reports.length,
      data: reports,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error retrieving group report:', error);
    res.status(500).json({
      error: 'Failed to retrieve group report',
      details: error.message
    });
  }
};

/**
 * Get All Master Reports Summary
 * GET /master-report/summary
 * Returns all 6 reports in one call
 */
exports.getMasterReportSummary = async (req, res) => {
  try {
    const { days } = req.query;

    const [
      { data: candidates, error: candidatesError }
    ] = await Promise.all([
      supabaseAdmin
        .from('candidates')
        .select(`
          id,
          job_industry_id,
          job_category_id,
          province_id,
          city_id,
          campaign_id,
          verification_status,
          created_at,
          job_industries(name),
          job_categories(name),
          provinces(name),
          cities(name),
          campaigns(name, is_active)
        `)
        .is('deleted_at', null)
    ]);

    if (candidatesError) throw candidatesError;

    const dateRange = getDateRange(parseInt(days) || null);

    // Build all reports
    const industryMap = {};
    const categoryMap = {};
    const provinceMap = {};
    const cityMap = {};
    const campaignMap = {};

    candidates.forEach(candidate => {
      // Industry
      const industryId = candidate.job_industry_id;
      if (!industryMap[industryId]) {
        industryMap[industryId] = {
          id: industryId,
          name: candidate.job_industries?.name || 'Unassigned',
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }
      industryMap[industryId].total += 1;
      if (candidate.verification_status === 'verified') industryMap[industryId].verified += 1;
      else industryMap[industryId].unverified += 1;
      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        industryMap[industryId].recentAdditions += 1;
      }

      // Category
      const categoryId = candidate.job_category_id;
      if (!categoryMap[categoryId]) {
        categoryMap[categoryId] = {
          id: categoryId,
          name: candidate.job_categories?.name || 'Unassigned',
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }
      categoryMap[categoryId].total += 1;
      if (candidate.verification_status === 'verified') categoryMap[categoryId].verified += 1;
      else categoryMap[categoryId].unverified += 1;
      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        categoryMap[categoryId].recentAdditions += 1;
      }

      // Province
      const provinceId = candidate.province_id;
      if (!provinceMap[provinceId]) {
        provinceMap[provinceId] = {
          id: provinceId,
          name: candidate.provinces?.name || 'Unassigned',
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }
      provinceMap[provinceId].total += 1;
      if (candidate.verification_status === 'verified') provinceMap[provinceId].verified += 1;
      else provinceMap[provinceId].unverified += 1;
      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        provinceMap[provinceId].recentAdditions += 1;
      }

      // City
      const cityId = candidate.city_id;
      if (!cityMap[cityId]) {
        cityMap[cityId] = {
          id: cityId,
          name: candidate.cities?.name || 'Unassigned',
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }
      cityMap[cityId].total += 1;
      if (candidate.verification_status === 'verified') cityMap[cityId].verified += 1;
      else cityMap[cityId].unverified += 1;
      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        cityMap[cityId].recentAdditions += 1;
      }

      // Campaign
      const campaignId = candidate.campaign_id;
      if (!campaignMap[campaignId]) {
        campaignMap[campaignId] = {
          id: campaignId,
          name: candidate.campaigns?.name || 'Unassigned',
          total: 0,
          verified: 0,
          unverified: 0,
          recentAdditions: 0
        };
      }
      campaignMap[campaignId].total += 1;
      if (candidate.verification_status === 'verified') campaignMap[campaignId].verified += 1;
      else campaignMap[campaignId].unverified += 1;
      if (dateRange.startDate && new Date(candidate.created_at) >= new Date(dateRange.startDate)) {
        campaignMap[campaignId].recentAdditions += 1;
      }
    });

    res.status(200).json({
      message: 'Master report summary retrieved successfully',
      filters: { days: days || 'all' },
      summary: {
        totalCandidates: candidates.length,
        byIndustry: Object.values(industryMap),
        byCategory: Object.values(categoryMap),
        byProvince: Object.values(provinceMap),
        byCity: Object.values(cityMap),
        byCampaign: Object.values(campaignMap)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error retrieving master report summary:', error);
    res.status(500).json({
      error: 'Failed to retrieve master report summary',
      details: error.message
    });
  }
};
