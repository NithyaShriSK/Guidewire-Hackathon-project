const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  platform: { type: String, required: true },
  eventType: { type: String, enum: ['scan', 'heartbeat', 'delivery_update'], default: 'scan' },
  isWorking: { type: Boolean, default: true },
  location: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  metadata: {
    source: { type: String, default: 'worker_app' },
    capturedAt: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

activityLogSchema.index({ workerId: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
