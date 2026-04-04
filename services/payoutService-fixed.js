const axios = require('axios');
const { Claim, Worker } = require('../models');

class PayoutService {
  constructor() {
    this.upiConfig = {
      merchantId: process.env.UPI_MERCHANT_ID,
      apiKey: process.env.UPI_API_KEY,
      baseUrl: 'https://api.upi-provider.com/v1', // Mock UPI provider
      processingFee: parseFloat(process.env.PAYOUT_PROCESSING_FEE) || 5,
      // Add fake mode flag
      fakeMode: process.env.UPI_FAKE_MODE === 'true' || true // Default to fake mode for demo
    };
  }

  // Process UPI payout (now with fake/simulation support)
  async processUPIPayout(payoutData) {
    try {
      const { upiId, amount, claimId, description } = payoutData;

      // Validate UPI ID format
      if (!this.validateUPIId(upiId)) {
        return {
          success: false,
          error: 'Invalid UPI ID format',
          transactionId: null
        };
      }

      // Check minimum and maximum payout limits
      if (amount < 50) {
        return {
          success: false,
          error: 'Minimum payout amount is ₹50',
          transactionId: null
        };
      }

      if (amount > 5000) {
        return {
          success: false,
          error: 'Maximum payout amount is ₹5,000',
          transactionId: null
        };
      }

      // Generate transaction ID
      const transactionId = `GS-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

      // Use fake/simulation mode or real UPI provider
      let payoutResult;
      if (this.upiConfig.fakeMode) {
        payoutResult = await this.simulateUPIPayout({
          merchantId: this.upiConfig.merchantId,
          upiId,
          amount: amount - this.upiConfig.processingFee, // Deduct processing fee
          transactionId,
          description: description || 'GigShield Claim Payout'
        });
      } else {
        // Real UPI provider integration (commented out for demo)
        payoutResult = await this.callRealUPIProvider({
          merchantId: this.upiConfig.merchantId,
          upiId,
          amount: amount - this.upiConfig.processingFee,
          transactionId,
          description: description || 'GigShield Claim Payout'
        });
      }

      if (payoutResult.success) {
        // Log successful payout
        console.log(`UPI payout successful: ${transactionId} - ₹${amount} to ${upiId}`);
        
        return {
          success: true,
          transactionId,
          amount: amount - this.upiConfig.processingFee,
          processingFee: this.upiConfig.processingFee,
          status: 'completed',
          processedAt: new Date(),
          // Add fake UTR for demonstration
          utr: payoutResult.utr || `FAKEUTR${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          mode: this.upiConfig.fakeMode ? 'SIMULATION' : 'LIVE'
        };
      } else {
        return {
          success: false,
          error: payoutResult.error || 'Payout processing failed',
          transactionId
        };
      }
    } catch (error) {
      console.error('Error processing UPI payout:', error);
      return {
        success: false,
        error: 'Internal error during payout processing',
        transactionId: null
      };
    }
  }

  // Simulate UPI payout (for demo purposes)
  async simulateUPIPayout(payoutData) {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate 95% success rate
      const isSuccess = Math.random() > 0.05;
      
      // Simulate different scenarios based on amount
      let scenario = 'normal';
      if (payoutData.amount > 3000) {
        scenario = Math.random() > 0.3 ? 'success' : 'manual_review';
      }
      if (payoutData.amount > 4000) {
        scenario = Math.random() > 0.5 ? 'manual_review' : 'success';
      }

      if (isSuccess && scenario === 'success') {
        return {
          success: true,
          transactionId: payoutData.transactionId,
          utr: `UTR${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          status: 'SUCCESS',
          message: 'Payout processed successfully (SIMULATION MODE)',
          processingTimeMs: Math.floor(Math.random() * 3000) + 1000,
          fakeDetails: {
            mode: 'SIMULATION',
            scenario: 'auto_success',
            simulatedAt: new Date().toISOString()
          }
        };
      } else if (scenario === 'manual_review') {
        return {
          success: false,
          error: 'Transaction requires manual review (SIMULATION MODE)',
          transactionId: payoutData.transactionId,
          fakeDetails: {
            mode: 'SIMULATION',
            scenario: 'manual_review',
            reason: 'High amount transaction flagged for review',
            simulatedAt: new Date().toISOString()
          }
        };
      } else {
        // Random failure scenarios
        const errors = [
          'Beneficiary account not found (SIMULATION)',
          'Insufficient balance (SIMULATION)',
          'UPI service temporarily unavailable (SIMULATION)',
          'Transaction limit exceeded (SIMULATION)',
          'Invalid UPI PIN (SIMULATION)',
          'Bank server error (SIMULATION)'
        ];
        
        return {
          success: false,
          error: errors[Math.floor(Math.random() * errors.length)],
          transactionId: payoutData.transactionId,
          fakeDetails: {
            mode: 'SIMULATION',
            scenario: 'random_failure',
            simulatedAt: new Date().toISOString()
          }
        };
      }
    } catch (error) {
      console.error('Error simulating UPI payout:', error);
      return {
        success: false,
        error: 'Simulation error',
        transactionId: payoutData.transactionId
      };
    }
  }

  // Real UPI provider integration (for production)
  async callRealUPIProvider(payoutData) {
    try {
      const response = await axios.post(
        `${this.upiConfig.baseUrl}/payout`,
        payoutData,
        {
          headers: {
            'Authorization': `Bearer ${this.upiConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error calling real UPI provider:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Validate UPI ID format
  validateUPIId(upiId) {
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;
    return upiRegex.test(upiId);
  }

  // Process batch payouts (for multiple claims)
  async processBatchPayouts(claimIds) {
    try {
      const results = [];
      
      for (const claimId of claimIds) {
        const claim = await Claim.findById(claimId).populate('workerId');
        if (!claim) {
          results.push({
            claimId,
            success: false,
            error: 'Claim not found'
          });
          continue;
        }

        if (claim.financial.payoutStatus !== 'pending') {
          results.push({
            claimId,
            success: false,
            error: 'Claim already processed'
          });
          continue;
        }

        const payoutResult = await this.processUPIPayout({
          upiId: claim.workerId.financialInfo.upiId,
          amount: claim.financial.payoutAmount,
          claimId: claim.claimNumber,
          description: `GigShield Claim Payout - ${claim.trigger.type}`
        });

        // Update claim with payout result
        if (payoutResult.success) {
          claim.financial.payoutStatus = 'completed';
          claim.financial.payoutTransactionId = payoutResult.transactionId;
          claim.financial.payoutProcessedAt = new Date();
          claim.status.current = 'paid';
          claim.status.paidAt = new Date();
        } else {
          claim.financial.payoutStatus = 'failed';
          claim.financial.payoutFailureReason = payoutResult.error;
        }

        await claim.save();

        results.push({
          claimId,
          success: payoutResult.success,
          transactionId: payoutResult.transactionId,
          error: payoutResult.error,
          amount: payoutResult.amount,
          mode: payoutResult.mode
        });
      }

      return results;
    } catch (error) {
      console.error('Error processing batch payouts:', error);
      throw error;
    }
  }

  // Retry failed payout
  async retryFailedPayout(claimId) {
    try {
      const claim = await Claim.findById(claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.financial.payoutStatus !== 'failed') {
        throw new Error('Payout is not in failed status');
      }

      // Reset payout status
      claim.financial.payoutStatus = 'pending';
      claim.financial.payoutFailureReason = null;
      await claim.save();

      // Process payout again
      const payoutResult = await this.processUPIPayout({
        upiId: claim.workerId.financialInfo.upiId,
        amount: claim.financial.payoutAmount,
        claimId: claim.claimNumber,
        description: `GigShield Claim Payout (Retry) - ${claim.trigger.type}`
      });

      if (payoutResult.success) {
        claim.financial.payoutStatus = 'completed';
        claim.financial.payoutTransactionId = payoutResult.transactionId;
        claim.financial.payoutProcessedAt = new Date();
        claim.status.current = 'paid';
        claim.status.paidAt = new Date();
      } else {
        claim.financial.payoutStatus = 'failed';
        claim.financial.payoutFailureReason = payoutResult.error;
      }

      await claim.save();

      return payoutResult;
    } catch (error) {
      console.error('Error retrying failed payout:', error);
      throw error;
    }
  }

  // Get payout statistics
  async getPayoutStatistics(timeRange = '30d') {
    try {
      let startDate;
      const now = new Date();

      switch (timeRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const totalPayouts = await Claim.countDocuments({
        'financial.payoutProcessedAt': { $gte: startDate }
      });

      const successfulPayouts = await Claim.countDocuments({
        'financial.payoutProcessedAt': { $gte: startDate },
        'financial.payoutStatus': 'completed'
      });

      const failedPayouts = await Claim.countDocuments({
        'financial.payoutProcessedAt': { $gte: startDate },
        'financial.payoutStatus': 'failed'
      });

      const totalAmount = await Claim.aggregate([
        {
          $match: {
            'financial.payoutProcessedAt': { $gte: startDate },
            'financial.payoutStatus': 'completed'
          }
        },
        {
          $group: { _id: null, total: { $sum: '$financial.payoutAmount' } }
        }
      ]);

      const averagePayoutAmount = await Claim.aggregate([
        {
          $match: {
            'financial.payoutProcessedAt': { $gte: startDate },
            'financial.payoutStatus': 'completed'
          }
        },
        {
          $group: { _id: null, average: { $avg: '$financial.payoutAmount' } }
        }
      ]);

      const payoutByType = await Claim.aggregate([
        {
          $match: {
            'financial.payoutProcessedAt': { $gte: startDate },
            'financial.payoutStatus': 'completed'
          }
        },
        {
          $group: {
            _id: '$trigger.type',
            count: { $sum: 1 },
            totalAmount: { $sum: '$financial.payoutAmount' }
          }
        }
      ]);

      return {
        totalPayouts,
        successfulPayouts,
        failedPayouts,
        successRate: totalPayouts > 0 ? ((successfulPayouts / totalPayouts) * 100).toFixed(2) : '0',
        totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
        averagePayoutAmount: averagePayoutAmount.length > 0 ? Math.round(averagePayoutAmount[0].average) : 0,
        payoutByType: payoutByType.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount
          };
          return acc;
        }, {}),
        mode: this.upiConfig.fakeMode ? 'SIMULATION' : 'LIVE'
      };
    } catch (error) {
      console.error('Error getting payout statistics:', error);
      return {
        totalPayouts: 0,
        successfulPayouts: 0,
        failedPayouts: 0,
        successRate: '0',
        totalAmount: 0,
        averagePayoutAmount: 0,
        payoutByType: {}
      };
    }
  }

  // Get payout status
  async getPayoutStatus(transactionId) {
    try {
      const claim = await Claim.findOne({ 'financial.payoutTransactionId': transactionId });
      
      if (!claim) {
        return {
          found: false,
          message: 'Transaction not found'
        };
      }

      return {
        found: true,
        status: claim.financial.payoutStatus,
        amount: claim.financial.payoutAmount,
        processedAt: claim.financial.payoutProcessedAt,
        claimId: claim.claimNumber,
        failureReason: claim.financial.payoutFailureReason,
        mode: this.upiConfig.fakeMode ? 'SIMULATION' : 'LIVE',
        // Add fake UTR for simulation mode
        utr: this.upiConfig.fakeMode ? `FAKEUTR${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}` : null
      };
    } catch (error) {
      console.error('Error getting payout status:', error);
      return {
        found: false,
        message: 'Error retrieving payout status'
      };
    }
  }

  // Process refund (for disputed claims)
  async processRefund(claimId, reason) {
    try {
      const claim = await Claim.findById(claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.financial.payoutStatus !== 'completed') {
        throw new Error('Cannot refund: payout not completed');
      }

      // In production, this would call UPI provider's refund API
      // For simulation, we'll simulate the refund
      const refundResult = await this.simulateRefund({
        originalTransactionId: claim.financial.payoutTransactionId,
        amount: claim.financial.payoutAmount,
        reason: reason || 'Claim dispute resolution'
      });

      if (refundResult.success) {
        // Update claim status
        claim.financial.payoutStatus = 'refunded';
        claim.status.current = 'refunded';
        claim.metadata.updatedAt = new Date();
        
        await claim.save();

        return {
          success: true,
          refundTransactionId: refundResult.refundTransactionId,
          amount: claim.financial.payoutAmount,
          processedAt: new Date(),
          mode: this.upiConfig.fakeMode ? 'SIMULATION' : 'LIVE'
        };
      } else {
        return {
          success: false,
          error: refundResult.error
        };
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }

  // Simulate refund (for demo purposes)
  async simulateRefund(refundData) {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulate 90% success rate for refunds
      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        return {
          success: true,
          refundTransactionId: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
          status: 'SUCCESS',
          message: 'Refund processed successfully (SIMULATION MODE)',
          fakeDetails: {
            mode: 'SIMULATION',
            scenario: 'auto_success',
            simulatedAt: new Date().toISOString()
          }
        };
      } else {
        return {
          success: false,
          error: 'Refund failed: Original transaction expired (SIMULATION MODE)',
          fakeDetails: {
            mode: 'SIMULATION',
            scenario: 'refund_failure',
            simulatedAt: new Date().toISOString()
          }
        };
      }
    } catch (error) {
      console.error('Error simulating refund:', error);
      return {
        success: false,
        error: 'Refund simulation error'
      };
    }
  }
}

module.exports = new PayoutService();
