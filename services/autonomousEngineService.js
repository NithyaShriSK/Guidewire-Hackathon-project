const { Worker, Policy } = require('../models');
const monitoringService = require('./monitoringService');

class AutonomousEngineService {
  constructor() {
    this.intervalRef = null;
    this.cycleMs = parseInt(process.env.AUTONOMOUS_CYCLE_MS || '300000', 10); // 5 minutes
  }

  async runCycle() {
    try {
      await this.reconcileCoverageByPremium();
      await this.ensureMonitoringForEligibleWorkers();
    } catch (error) {
      console.error('Autonomous engine cycle error:', error);
    }
  }

  async reconcileCoverageByPremium() {
    const now = new Date();
    const overdueWorkers = await Worker.find({
      'premium.nextPaymentDue': { $lte: now },
      'premium.currentWeekPaid': false,
      'status.subscriptionStatus': { $in: ['active', 'inactive'] }
    });

    for (const worker of overdueWorkers) {
      worker.status.subscriptionStatus = 'expired';
      await worker.save();

      await Policy.updateMany(
        { workerId: worker._id, 'status.current': 'active' },
        {
          $set: {
            'status.current': 'inactive',
            'metadata.updatedAt': new Date()
          }
        }
      );
    }
  }

  async ensureMonitoringForEligibleWorkers() {
    const eligibleWorkers = await Worker.find({
      'status.accountStatus': 'active',
      'status.subscriptionStatus': 'active',
      'premium.currentWeekPaid': true
    }).select('_id');

    for (const worker of eligibleWorkers) {
      await monitoringService.startWorkerMonitoring(worker._id.toString());
    }
  }

  async start() {
    await this.runCycle();
    this.intervalRef = setInterval(() => {
      this.runCycle();
    }, this.cycleMs);
    console.log(`Autonomous engine started. Cycle=${this.cycleMs}ms`);
  }

  stop() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }
}

module.exports = new AutonomousEngineService();
