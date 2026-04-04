import React from 'react';
import { Link } from 'react-router-dom';

const planTiers = [
  { name: 'Basic', premium: 'Rs 20/week', limit: 'Rs 2,000/week', fit: 'For light weekly delivery activity and entry-level protection.' },
  { name: 'Medium', premium: 'Rs 35/week', limit: 'Rs 3,500/week', fit: 'For regular delivery partners working multiple blocks each week.' },
  { name: 'High', premium: 'Rs 50/week', limit: 'Rs 5,000/week', fit: 'For high-frequency gig workers who want stronger income continuity.' },
];

const coveredEvents = [
  'Extreme weather including heavy rain, flooding indicators, and unsafe delivery rainfall thresholds.',
  'Environmental risk including severe AQI spikes and pollution levels that make work unsafe.',
  'Extreme heat conditions above configured working-safety thresholds.',
  'Traffic disruption where congestion and route slowdown cross configured parametric limits.',
];

const exclusions = [
  'War, civil war, invasion, terrorism, riots, curfews, and politically driven unrest unless explicitly added in future products.',
  'Health insurance, hospital bills, medical treatment, disability coverage, life insurance, and personal accident benefits.',
  'Vehicle repair, servicing, fuel, tyre damage, battery replacement, towing, and maintenance expenses.',
  'Losses caused by fraud, fake GPS, manipulated location data, fabricated scans, or tampered transaction records.',
  'General business slowdown, low order volume, voluntary time off, account suspension unrelated to insured triggers, or app downtime.',
];

const workflowSteps = [
  'Worker pays the weekly premium and accepts the policy terms.',
  'FixMyPay monitors weather, AQI, heat, and traffic signals for the worker’s active location.',
  'When a configured threshold is crossed, the system validates the event against policy rules and anti-fraud checks.',
  'If the worker qualifies, the claim is created automatically and payout moves to instant settlement.',
];

const PolicyTermsContent = ({ mode = 'worker' }) => {
  const isAdmin = mode === 'admin';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-primary-800 via-primary-700 to-success-600 p-6 text-white shadow-[0_24px_50px_-30px_rgba(20,71,177,0.95)]">
        <h1 className="text-2xl font-bold">{isAdmin ? 'Policy and Terms Console' : 'Policy and Terms'}</h1>
        <p className="mt-2 max-w-3xl text-primary-50/90">
          FixMyPay is a parametric income protection product for gig workers. This page is the full reference for coverage, exclusions, weekly plans, and trigger rules.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">How FixMyPay Works</h2>
          </div>
          <div className="card-content space-y-3">
            {workflowSteps.map((step) => (
              <div key={step} className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
                {step}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Before Payment</h2>
          </div>
          <div className="card-content space-y-3 text-sm text-gray-700">
            <p>
              Review this page before confirming any weekly premium payment. Payment should only be made after the worker understands what is covered and what is excluded.
            </p>
            {!isAdmin ? (
              <Link to="/weekly-premium" className="btn-primary w-full text-center">
                Go To Weekly Payment
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Weekly Plans</h2>
          <p className="text-sm text-gray-600">Each weekly premium keeps the worker eligible for automated parametric payout during the paid period.</p>
        </div>
        <div className="card-content grid grid-cols-1 gap-4 md:grid-cols-3">
          {planTiers.map((tier) => (
            <div key={tier.name} className="rounded-3xl border border-gray-200 bg-white p-5">
              <p className="text-lg font-semibold text-gray-900">{tier.name}</p>
              <p className="mt-2 text-2xl font-bold text-primary-700">{tier.premium}</p>
              <p className="mt-2 text-sm font-medium text-success-700">{tier.limit}</p>
              <p className="mt-3 text-sm text-gray-600">{tier.fit}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Covered Trigger Categories</h2>
          </div>
          <div className="card-content space-y-3">
            {coveredEvents.map((item) => (
              <div key={item} className="rounded-2xl bg-success-50 p-4 text-sm text-success-900">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Major Exclusions</h2>
          </div>
          <div className="card-content space-y-3">
            {exclusions.map((item) => (
              <div key={item} className="rounded-2xl bg-red-50 p-4 text-sm text-red-900">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Policy Conditions</h2>
        </div>
        <div className="card-content space-y-4 text-sm text-gray-700">
          <p>
            Coverage applies only during an active paid week and only while the worker account and subscription remain active. Parametric decisions are based on threshold data, validated location, and anti-fraud checks.
          </p>
          <p>
            GPS is not treated as sole proof. FixMyPay can use delivery scans, recent activity, network validation, and environmental data matching to approve, hold, or reject a claim.
          </p>
          <p>
            Payout amount is always subject to the weekly plan limit, per-claim cap, and the calculated loss estimate from the disruption severity. A trigger event does not automatically override fraud or eligibility rules unless the platform is intentionally in admin simulation mode.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PolicyTermsContent;
