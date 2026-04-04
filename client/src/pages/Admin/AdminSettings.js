import React from 'react';

const settingRows = [
  {
    title: 'Monitoring Mode',
    value: 'Live weather, pollution, heat, and traffic monitoring enabled for configured workers.',
  },
  {
    title: 'Payout Model',
    value: 'Zero-touch parametric claim creation with simulation overrides for demo scenarios.',
  },
  {
    title: 'Fraud Controls',
    value: 'Behavioral validation, location checks, and cluster-based review remain active outside simulation mode.',
  },
  {
    title: 'Weekly Plans',
    value: 'Basic, Medium, and High plans are active with separate payout limits and shared exclusions.',
  },
];

const AdminSettings = () => {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-primary-800 via-primary-700 to-success-600 p-6 text-white shadow-[0_24px_50px_-30px_rgba(20,71,177,0.95)]">
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="mt-2 max-w-3xl text-primary-50/90">
          A quick admin reference for the key platform behaviors currently configured in FixMyPay.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">System Snapshot</h2>
        </div>
        <div className="card-content space-y-4">
          {settingRows.map((row) => (
            <div key={row.title} className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">{row.title}</p>
              <p className="mt-1 text-sm text-gray-600">{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
