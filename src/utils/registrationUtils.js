const supabaseModule = require('../config/database');
const supabaseAdmin = supabaseModule.admin;

/**
 * Generate registration number in format: JBR-XXXXX
 * where XXXXX are the last 5 digits of phone number
 * @param {string} phoneNumber - Phone number
 * @returns {string} Registration number in format JBR-XXXXX
 */
function generateRegistrationNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Extract only digits from phone number
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Get last 5 digits, or pad with zeros if less than 5 digits
  const lastFiveDigits = digits.slice(-5).padStart(5, '0');
  
  return `JBR-${lastFiveDigits}`;
}

/**
 * Format registration number from phone
 * @param {object} employee - Employee object with phone_number
 * @returns {object} Employee object with registration_number added
 */
function formatEmployeeWithRegistration(employee) {
  if (!employee) return employee;
  
  if (!employee.registration_number && employee.phone_number) {
    employee.registration_number = generateRegistrationNumber(employee.phone_number);
  }
  
  return employee;
}

/**
 * Format array of employees with registration numbers
 * @param {array} employees - Array of employee objects
 * @returns {array} Array of employees with registration_number added
 */
function formatEmployeesWithRegistration(employees) {
  if (!Array.isArray(employees)) return employees;
  
  return employees.map(emp => formatEmployeeWithRegistration(emp));
}

async function enrichEmployeeWithDocuments(employee) {
  if (!employee || !employee.id) return employee;

  try {
    const [bankRes, sinRes] = await Promise.all([
      supabaseAdmin
        .from('user_documents')
        .select('*')
        .eq('user_id', employee.id)
        .eq('doc_type', 'bank_account')
        .order('created_at', { ascending: false })
        .limit(1),
      supabaseAdmin
        .from('user_documents')
        .select('*')
        .eq('user_id', employee.id)
        .eq('doc_type', 'sin')
        .order('created_at', { ascending: false })
        .limit(1)
    ]);

    const bankDoc = !bankRes.error && Array.isArray(bankRes.data) && bankRes.data.length > 0 ? bankRes.data[0] : null;
    const sinDoc = !sinRes.error && Array.isArray(sinRes.data) && sinRes.data.length > 0 ? sinRes.data[0] : null;

    return {
      ...employee,
      bank_account: bankDoc ? {
        account_number: bankDoc.account_number || null,
        document_url: bankDoc.document_url || null,
        storage_path: bankDoc.storage_path || null,
        created_at: bankDoc.created_at || null
      } : null,
      sin: sinDoc ? {
        sin_number: sinDoc.sin_number || null,
        document_url: sinDoc.document_url || null,
        storage_path: sinDoc.storage_path || null,
        created_at: sinDoc.created_at || null
      } : null
    };
  } catch (err) {
    console.warn('Could not enrich employee documents:', err && err.message ? err.message : err);
    return employee;
  }
}

async function formatEmployeesWithRegistrationAndDocuments(employees) {
  if (!Array.isArray(employees)) return employees;

  const enriched = await Promise.all(employees.map(emp => enrichEmployeeWithDocuments(emp)));
  return enriched.map(emp => formatEmployeeWithRegistration(emp));
}

async function formatEmployeeWithRegistrationAndDocuments(employee) {
  const formatted = formatEmployeeWithRegistration(employee);
  return enrichEmployeeWithDocuments(formatted);
}

module.exports = {
  generateRegistrationNumber,
  formatEmployeeWithRegistration,
  formatEmployeesWithRegistration,
  enrichEmployeeWithDocuments,
  formatEmployeesWithRegistrationAndDocuments,
  formatEmployeeWithRegistrationAndDocuments
};
