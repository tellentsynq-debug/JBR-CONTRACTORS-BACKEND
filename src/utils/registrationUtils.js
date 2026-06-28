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

async function resolveEmployeeDocumentUserIds(employee) {
  if (!employee) return [];

  const candidateIds = [];
  if (employee.id) candidateIds.push(employee.id);

  if (employee.email) {
    try {
      const { data, error } = await supabaseAdmin
        .from('candidates')
        .select('id')
        .eq('email', employee.email)
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0 && data[0].id) {
        candidateIds.push(data[0].id);
      }
    } catch (err) {
      console.warn('Could not resolve candidate document id from email:', err && err.message ? err.message : err);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', employee.email)
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0 && data[0].id) {
        candidateIds.push(data[0].id);
      }
    } catch (err) {
      console.warn('Could not resolve profile document id from email:', err && err.message ? err.message : err);
    }
  }

  return [...new Set(candidateIds.filter(Boolean))];
}

async function enrichEmployeeWithDocuments(employee) {
  if (!employee || !employee.id) return employee;

  try {
    const candidateUserIds = await resolveEmployeeDocumentUserIds(employee);
    const documentUserIds = candidateUserIds.length > 0 ? candidateUserIds : [employee.id];

    const [bankRes, sinRes] = await Promise.all([
      Promise.all(documentUserIds.map(userId =>
        supabaseAdmin
          .from('user_documents')
          .select('*')
          .eq('user_id', userId)
          .eq('doc_type', 'bank_account')
          .order('created_at', { ascending: false })
          .limit(1)
      )),
      Promise.all(documentUserIds.map(userId =>
        supabaseAdmin
          .from('user_documents')
          .select('*')
          .eq('user_id', userId)
          .eq('doc_type', 'sin')
          .order('created_at', { ascending: false })
          .limit(1)
      ))
    ]);

    const bankDoc = bankRes
      .flatMap(res => (!res.error && Array.isArray(res.data) && res.data.length > 0 ? res.data : []))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;

    const sinDoc = sinRes
      .flatMap(res => (!res.error && Array.isArray(res.data) && res.data.length > 0 ? res.data : []))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;

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
