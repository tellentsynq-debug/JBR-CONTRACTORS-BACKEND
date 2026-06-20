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

module.exports = {
  generateRegistrationNumber,
  formatEmployeeWithRegistration,
  formatEmployeesWithRegistration
};
