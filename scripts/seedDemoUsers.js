const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Worker, Admin } = require('../models');

async function seedDemoUsers() {
  await mongoose.connect(process.env.MONGODB_URI);

  const workerEmail = 'worker@gigshield.com';
  const adminEmail = 'admin@gigshield.com';

  const workerHash = await bcrypt.hash('password123', 12);
  const adminHash = await bcrypt.hash('admin123', 12);

  const existingWorker = await Worker.findOne({ 'personalInfo.email': workerEmail });
  if (!existingWorker) {
    await Worker.create({
      personalInfo: {
        firstName: 'Demo',
        lastName: 'Worker',
        email: workerEmail,
        phone: '9999990001',
        dateOfBirth: new Date('1998-01-15'),
        aadhaarNumber: '123412341234',
        address: {
          street: 'Demo Street 1',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          coordinates: { latitude: 12.9716, longitude: 77.5946 }
        }
      },
      workInfo: {
        platforms: [{
          name: 'Swiggy',
          workerId: 'SWG-DEMO-001',
          startDate: new Date('2023-01-01'),
          averageDailyEarnings: 1200,
          averageWeeklyHours: 48
        }],
        preferredWorkingZones: [{
          name: 'Central Bengaluru',
          coordinates: { latitude: 12.9716, longitude: 77.5946, radius: 8 }
        }],
        typicalWorkingHours: { start: '09:00', end: '18:00' }
      },
      financialInfo: {
        upiId: 'demo.worker@upi',
        bankAccount: {
          accountNumber: '123456789012',
          ifscCode: 'HDFC0001234',
          accountHolderName: 'Demo Worker'
        },
        weeklyIncomeRange: { min: 6000, max: 12000 }
      },
      security: {
        password: workerHash,
        deviceFingerprints: [],
        ipAddresses: []
      },
      status: {
        accountStatus: 'active',
        subscriptionStatus: 'active',
        onboardingStep: 'completed'
      },
      verification: {
        isEmailVerified: true,
        isPhoneVerified: true,
        isAadhaarVerified: true,
        isBankVerified: true
      },
      metadata: {
        referralCode: 'GSDEMO01'
      }
    });
    console.log('Created demo worker');
  } else {
    existingWorker.security.password = workerHash;
    existingWorker.security.loginAttempts = 0;
    existingWorker.security.lockUntil = undefined;
    await existingWorker.save();
    console.log('Updated demo worker password');
  }

  const existingAdmin = await Admin.findOne({ 'personalInfo.email': adminEmail });
  if (!existingAdmin) {
    await Admin.create({
      personalInfo: {
        firstName: 'Demo',
        lastName: 'Admin',
        email: adminEmail,
        phone: '9999990002',
        employeeId: 'ADM-DEMO-001'
      },
      role: {
        type: 'super_admin',
        permissions: [
          'view_workers', 'edit_workers', 'view_policies', 'edit_policies',
          'view_claims', 'approve_claims', 'reject_claims', 'investigate_claims',
          'view_analytics', 'export_reports', 'manage_system',
          'view_admins', 'edit_admins', 'delete_admins'
        ],
        department: 'operations'
      },
      security: {
        password: adminHash,
        deviceFingerprints: [],
        ipWhitelist: [],
        loginAttempts: 0
      },
      status: {
        isActive: true,
        isOnline: false
      }
    });
    console.log('Created demo admin');
  } else {
    existingAdmin.security.password = adminHash;
    existingAdmin.security.loginAttempts = 0;
    existingAdmin.security.lockUntil = undefined;
    await existingAdmin.save();
    console.log('Updated demo admin password');
  }

  console.log('Demo credentials are ready');
}

seedDemoUsers()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Failed to seed demo users:', error);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });
