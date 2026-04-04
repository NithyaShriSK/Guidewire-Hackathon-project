const bcrypt = require('bcryptjs');
const { Worker, Admin } = require('../models');
const { generateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Worker Registration
const registerWorker = async (req, res) => {
  try {
    const { personalInfo, security, workInfo, financialInfo } = req.body;
    const timestampSeed = Date.now().toString();
    const normalizedPersonalInfo = {
      firstName: personalInfo.firstName.trim(),
      lastName: personalInfo.lastName.trim(),
      email: personalInfo.email.toLowerCase(),
      phone: String(personalInfo.phone),
      dateOfBirth: personalInfo.dateOfBirth,
      aadhaarNumber: String(personalInfo.aadhaarNumber),
      address: {
        street: personalInfo.address?.street,
        city: personalInfo.address?.city,
        state: personalInfo.address?.state,
        pincode: String(personalInfo.address?.pincode),
        coordinates: {
          latitude: Number(personalInfo.address?.coordinates?.latitude),
          longitude: Number(personalInfo.address?.coordinates?.longitude)
        }
      }
    };

    const normalizedWorkInfo = {
      platforms: (workInfo?.platforms || []).map((platform) => ({
        name: platform.name || 'Amazon Flex',
        workerId: platform.workerId,
        startDate: platform.startDate || new Date(),
        averageDailyEarnings: Number(platform.averageDailyEarnings),
        averageWeeklyHours: Number(platform.averageWeeklyHours)
      })),
      preferredWorkingZones: (workInfo?.preferredWorkingZones || []).map((zone) => ({
        name: zone.name,
        coordinates: {
          latitude: Number(zone.coordinates?.latitude),
          longitude: Number(zone.coordinates?.longitude),
          radius: Number(zone.coordinates?.radius || 5)
        }
      })),
      typicalWorkingHours: {
        start: workInfo?.typicalWorkingHours?.start,
        end: workInfo?.typicalWorkingHours?.end
      }
    };

    const normalizedFinancialInfo = {
      upiId: financialInfo?.upiId,
      bankAccount: {
        accountNumber: String(financialInfo?.bankAccount?.accountNumber),
        ifscCode: String(financialInfo?.bankAccount?.ifscCode || '').toUpperCase(),
        accountHolderName: financialInfo?.bankAccount?.accountHolderName
      },
      weeklyIncomeRange: {
        min: Number(financialInfo?.weeklyIncomeRange?.min),
        max: Number(financialInfo?.weeklyIncomeRange?.max)
      }
    };

    // Check if worker already exists
    const existingWorker = await Worker.findOne({
      $or: [
        { 'personalInfo.email': normalizedPersonalInfo.email },
        { 'personalInfo.phone': normalizedPersonalInfo.phone },
        { 'personalInfo.aadhaarNumber': normalizedPersonalInfo.aadhaarNumber }
      ]
    });

    if (existingWorker) {
      return res.status(400).json({
        success: false,
        message: 'Worker already registered with this email, phone, or Aadhaar number'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(security.password, salt);

    // Generate referral code
    const referralCode = `FMP${normalizedPersonalInfo.phone.slice(-4)}${timestampSeed.slice(-4)}`.toUpperCase();

    // Create worker
    const worker = new Worker({
      personalInfo: normalizedPersonalInfo,
      workInfo: normalizedWorkInfo,
      financialInfo: normalizedFinancialInfo,
      security: {
        ...security,
        password: hashedPassword
      },
      status: {
        accountStatus: 'active',
        subscriptionStatus: 'inactive',
        onboardingStep: 'completed'
      },
      metadata: {
        referralCode
      }
    });

    await worker.save();

    // Generate token
    const token = generateToken({ 
      id: worker._id, 
      type: 'worker',
      email: worker.personalInfo.email 
    });

    res.status(201).json({
      success: true,
      message: 'Worker registered successfully',
      data: {
        worker: {
          id: worker._id,
          personalInfo: worker.personalInfo,
          status: worker.status,
          metadata: {
            referralCode: worker.metadata.referralCode,
            registeredAt: worker.metadata.registeredAt
          }
        },
        token
      }
    });
  } catch (error) {
    console.error('Worker registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

// Worker Login
const loginWorker = async (req, res) => {
  try {
    const { email, password, deviceFingerprint, ipAddress } = req.body;

    // Find worker by email
    const worker = await Worker.findOne({ 'personalInfo.email': email.toLowerCase() });
    if (!worker) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (worker.security.lockUntil && worker.security.lockUntil > Date.now()) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to multiple failed attempts. Please try again later.'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, worker.security.password);
    if (!isPasswordValid) {
      // Increment login attempts
      worker.security.loginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (worker.security.loginAttempts >= 5) {
        worker.security.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }
      
      await worker.save();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Reset login attempts on successful login
    worker.security.loginAttempts = 0;
    worker.security.lockUntil = undefined;
    worker.security.lastLogin = new Date();
    
    // Update device fingerprint and IP address if provided
    if (deviceFingerprint && !worker.security.deviceFingerprints.includes(deviceFingerprint)) {
      worker.security.deviceFingerprints.push(deviceFingerprint);
    }
    
    if (ipAddress && !worker.security.ipAddresses.includes(ipAddress)) {
      worker.security.ipAddresses.push(ipAddress);
    }
    
    worker.metadata.lastActiveAt = new Date();
    await worker.save();

    // Generate token
    const token = generateToken({ 
      id: worker._id, 
      type: 'worker',
      email: worker.personalInfo.email 
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        worker: {
          id: worker._id,
          personalInfo: worker.personalInfo,
          status: worker.status,
          onboardingStep: worker.status.onboardingStep
        },
        token
      }
    });
  } catch (error) {
    console.error('Worker login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

// Update Worker Work Info
const updateWorkInfo = async (req, res) => {
  try {
    const { workInfo } = req.body;
    const workerId = req.worker._id;

    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Update work info
    worker.workInfo = workInfo;
    worker.status.onboardingStep = 'financial';
    worker.metadata.updatedAt = new Date();

    await worker.save();

    res.json({
      success: true,
      message: 'Work information updated successfully',
      data: {
        workInfo: worker.workInfo,
        onboardingStep: worker.status.onboardingStep
      }
    });
  } catch (error) {
    console.error('Update work info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update work information'
    });
  }
};

// Update Worker Financial Info
const updateFinancialInfo = async (req, res) => {
  try {
    const { financialInfo } = req.body;
    const workerId = req.worker._id;

    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Update financial info
    worker.financialInfo = financialInfo;
    worker.status.onboardingStep = 'verification';
    worker.metadata.updatedAt = new Date();

    await worker.save();

    res.json({
      success: true,
      message: 'Financial information updated successfully',
      data: {
        financialInfo: worker.financialInfo,
        onboardingStep: worker.status.onboardingStep
      }
    });
  } catch (error) {
    console.error('Update financial info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update financial information'
    });
  }
};

// Complete Onboarding
const completeOnboarding = async (req, res) => {
  try {
    const workerId = req.worker._id;

    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Update onboarding status
    worker.status.onboardingStep = 'completed';
    worker.status.accountStatus = 'pending'; // Will be activated after verification
    worker.metadata.updatedAt = new Date();

    await worker.save();

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        onboardingStep: worker.status.onboardingStep,
        accountStatus: worker.status.accountStatus
      }
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding'
    });
  }
};

// Admin Registration
const registerAdmin = async (req, res) => {
  try {
    const { personalInfo, role, security } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [
        { 'personalInfo.email': personalInfo.email },
        { 'personalInfo.employeeId': personalInfo.employeeId }
      ]
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin already registered with this email or employee ID'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(security.password, salt);

    // Create admin
    const admin = new Admin({
      personalInfo,
      role,
      security: {
        password: hashedPassword,
        ...security
      }
    });

    await admin.save();

    // Generate token
    const token = generateToken({ 
      id: admin._id, 
      type: 'admin',
      email: admin.personalInfo.email 
    });

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        admin: {
          id: admin._id,
          personalInfo: admin.personalInfo,
          role: admin.role,
          status: admin.status
        },
        token
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin registration failed. Please try again.'
    });
  }
};

// Admin Login
const loginAdmin = async (req, res) => {
  try {
    const { email, password, deviceFingerprint, ipAddress } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ 'personalInfo.email': email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (admin.security.lockUntil && admin.security.lockUntil > Date.now()) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to multiple failed attempts. Please try again later.'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, admin.security.password);
    if (!isPasswordValid) {
      // Increment login attempts
      admin.security.loginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (admin.security.loginAttempts >= 5) {
        admin.security.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }
      
      await admin.save();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Reset login attempts on successful login
    admin.security.loginAttempts = 0;
    admin.security.lockUntil = undefined;
    admin.security.lastLogin = new Date();
    admin.activity.totalLogins += 1;
    
    // Update device fingerprint and IP address if provided
    if (deviceFingerprint && !admin.security.deviceFingerprints.includes(deviceFingerprint)) {
      admin.security.deviceFingerprints.push(deviceFingerprint);
    }
    
    if (ipAddress && !admin.security.ipWhitelist.includes(ipAddress)) {
      admin.security.ipWhitelist.push(ipAddress);
    }
    
    admin.status.lastSeen = new Date();
    admin.status.isOnline = true;
    await admin.save();

    // Generate token
    const token = generateToken({ 
      id: admin._id, 
      type: 'admin',
      email: admin.personalInfo.email 
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        admin: {
          id: admin._id,
          personalInfo: admin.personalInfo,
          role: admin.role,
          status: admin.status
        },
        token
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

// Get Current User Profile
const getCurrentProfile = async (req, res) => {
  try {
    let user;
    
    if (req.worker) {
      user = {
        type: 'worker',
        data: req.worker
      };
    } else if (req.admin) {
      user = {
        type: 'admin',
        data: req.admin
      };
    } else {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};

module.exports = {
  registerWorker,
  loginWorker,
  updateWorkInfo,
  updateFinancialInfo,
  completeOnboarding,
  registerAdmin,
  loginAdmin,
  getCurrentProfile
};
