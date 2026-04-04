const { body, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Worker registration validation
const validateWorkerRegistration = [
  body('personalInfo.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
    
  body('personalInfo.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
    
  body('personalInfo.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('personalInfo.phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit Indian mobile number'),
    
  body('personalInfo.dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
    .custom((value) => {
      const age = new Date().getFullYear() - new Date(value).getFullYear();
      if (age < 18 || age > 65) {
        throw new Error('Age must be between 18 and 65 years');
      }
      return true;
    }),
    
  body('personalInfo.aadhaarNumber')
    .matches(/^\d{12}$/)
    .withMessage('Aadhaar number must be exactly 12 digits'),
    
  body('personalInfo.address.street')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Street address must be between 5 and 200 characters'),
    
  body('personalInfo.address.city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
    
  body('personalInfo.address.state')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
    
  body('personalInfo.address.pincode')
    .matches(/^\d{6}$/)
    .withMessage('Pincode must be exactly 6 digits'),
    
  body('personalInfo.address.coordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
    
  body('personalInfo.address.coordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
    
  body('security.password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
  handleValidationErrors
];

// Worker login validation
const validateWorkerLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
    
  handleValidationErrors
];

// Work info validation
const validateWorkInfo = [
  body('platforms')
    .isArray({ min: 1 })
    .withMessage('At least one platform must be specified'),
    
  body('platforms.*.name')
    .isIn(['Amazon Flex', 'Swiggy', 'Zomato', 'Uber Eats', 'Dunzo'])
    .withMessage('Invalid platform name'),
    
  body('platforms.*.workerId')
    .trim()
    .notEmpty()
    .withMessage('Platform worker ID is required'),
    
  body('platforms.*.averageDailyEarnings')
    .isFloat({ min: 100, max: 10000 })
    .withMessage('Daily earnings must be between ₹100 and ₹10,000'),
    
  body('platforms.*.averageWeeklyHours')
    .isFloat({ min: 1, max: 80 })
    .withMessage('Weekly hours must be between 1 and 80'),
    
  body('preferredWorkingZones')
    .isArray({ min: 1 })
    .withMessage('At least one working zone must be specified'),
    
  body('preferredWorkingZones.*.coordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
    
  body('preferredWorkingZones.*.coordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
    
  body('typicalWorkingHours.start')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
    
  body('typicalWorkingHours.end')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
    
  handleValidationErrors
];

// Financial info validation
const validateFinancialInfo = [
  body('upiId')
    .matches(/^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/)
    .withMessage('Please provide a valid UPI ID'),
    
  body('bankAccount.accountNumber')
    .matches(/^\d{9,18}$/)
    .withMessage('Account number must be between 9 and 18 digits'),
    
  body('bankAccount.ifscCode')
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Please provide a valid IFSC code'),
    
  body('bankAccount.accountHolderName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Account holder name must be between 2 and 100 characters'),
    
  body('weeklyIncomeRange.min')
    .isFloat({ min: 500, max: 50000 })
    .withMessage('Minimum weekly income must be between ₹500 and ₹50,000'),
    
  body('weeklyIncomeRange.max')
    .isFloat({ min: 500, max: 50000 })
    .withMessage('Maximum weekly income must be between ₹500 and ₹50,000'),
    
  body('weeklyIncomeRange.max')
    .custom((value, { req }) => {
      if (value < req.body.weeklyIncomeRange.min) {
        throw new Error('Maximum income must be greater than minimum income');
      }
      return true;
    }),
    
  handleValidationErrors
];

// Admin registration validation
const validateAdminRegistration = [
  body('personalInfo.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
    
  body('personalInfo.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
    
  body('personalInfo.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('personalInfo.phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit Indian mobile number'),
    
  body('personalInfo.employeeId')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Employee ID must be between 3 and 20 characters'),
    
  body('role.type')
    .isIn(['super_admin', 'claims_manager', 'risk_analyst', 'support_agent', 'auditor'])
    .withMessage('Invalid role type'),
    
  body('role.department')
    .isIn(['operations', 'risk', 'finance', 'technology', 'compliance'])
    .withMessage('Invalid department'),
    
  body('security.password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
  handleValidationErrors
];

// Admin login validation
const validateAdminLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
    
  handleValidationErrors
];

// Policy creation validation
const validatePolicyCreation = [
  body('coverage.coveredRisks')
    .isArray({ min: 1 })
    .withMessage('At least one covered risk must be specified'),
    
  body('coverage.maxPayoutPerClaim')
    .isFloat({ min: 50, max: 5000 })
    .withMessage('Max payout per claim must be between ₹50 and ₹5,000'),
    
  body('coverage.maxPayoutPerWeek')
    .isFloat({ min: 100, max: 10000 })
    .withMessage('Max payout per week must be between ₹100 and ₹10,000'),
    
  body('premium.baseAmount')
    .isFloat({ min: 10, max: 1000 })
    .withMessage('Base premium must be between ₹10 and ₹1,000'),
    
  handleValidationErrors
];

module.exports = {
  validateWorkerRegistration,
  validateWorkerLogin,
  validateWorkInfo,
  validateFinancialInfo,
  validateAdminRegistration,
  validateAdminLogin,
  validatePolicyCreation,
  handleValidationErrors
};
