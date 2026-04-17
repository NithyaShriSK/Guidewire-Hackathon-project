import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircleIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { workerAPI } from '../services/api';
import toast from 'react-hot-toast';

const WeeklyPremium = () => {
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [transactionId, setTransactionId] = useState('');
  const [selectedTier, setSelectedTier] = useState('basic');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    fetchPremiumStatus();
    const interval = setInterval(fetchPremiumStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchPremiumStatus = async () => {
    try {
      const response = await workerAPI.getPremiumStatus();
      setPremiumStatus(response.data.data);
      setSelectedTier(response.data.data.planType || 'basic');
    } catch (error) {
      console.error('Error fetching premium status:', error);
      toast.error('Failed to fetch premium status');
    } finally {
      setLoading(false);
    }
  };

  const tierEntries = useMemo(() => Object.entries(premiumStatus?.availableTiers || {}), [premiumStatus]);
  const chosenTier = premiumStatus?.availableTiers?.[selectedTier];
  const dynamicPricing = premiumStatus?.dynamicPricing;

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();

    if (!acceptedTerms) {
      toast.error('Please accept the coverage terms');
      return;
    }

    if (!transactionId.trim()) {
      toast.error('Please enter transaction ID');
      return;
    }

    try {
      setPaymentLoading(true);

      const response = await workerAPI.payWeeklyPremium({
        paymentMethod,
        transactionId,
        amount: chosenTier.weeklyAmount,
        planType: selectedTier,
        acceptedTerms
      });

      if (response.data.success) {
        toast.success('Weekly premium paid successfully');
        setShowPaymentForm(false);
        setTransactionId('');
        setAcceptedTerms(false);
        fetchPremiumStatus();
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.response?.data?.message || 'Payment failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const canClaimInsurance = premiumStatus?.canClaimInsurance;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-primary-800 via-primary-700 to-success-600 p-6 text-white shadow-[0_24px_50px_-30px_rgba(20,71,177,0.95)]">
        <h1 className="text-2xl font-bold">Weekly Premium</h1>
        <p className="mt-2 text-primary-50/90">
          Pick a weekly FixMyPay plan with dynamic pricing based on your location, work pattern, and risk exposure.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-3">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Coverage Status</h3>
            <p className="text-sm text-gray-600">Your current plan, eligibility, and next payment date.</p>
          </div>
          <div className="card-content space-y-5">
            <div className={`rounded-3xl p-5 ${canClaimInsurance ? 'bg-success-50 border border-success-200' : 'bg-warning-50 border border-warning-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-wide text-gray-500">Current Plan</p>
                  <p className="text-2xl font-bold text-gray-900">{premiumStatus?.planType || 'basic'}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Weekly premium Rs {premiumStatus?.weeklyAmount || 0} • Weekly coverage limit Rs {premiumStatus?.weeklyCoverageLimit || 0}
                  </p>
                </div>
                <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${canClaimInsurance ? 'bg-success-100 text-success-800' : 'bg-warning-100 text-warning-800'}`}>
                  {canClaimInsurance ? 'Coverage Active' : 'Payment Needed'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SummaryTile label="This Week" value={premiumStatus?.currentWeekPaid ? 'Paid' : 'Due'} />
              <SummaryTile label="Next Due" value={premiumStatus?.nextPaymentDue ? new Date(premiumStatus.nextPaymentDue).toLocaleDateString('en-IN') : 'Not set'} />
              <SummaryTile label="Total Paid" value={`Rs ${premiumStatus?.totalPaid || 0}`} />
            </div>

            {dynamicPricing ? (
              <div className="rounded-3xl border border-primary-200 bg-primary-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-wide text-primary-700">Dynamic pricing engine</p>
                    <p className="mt-1 text-lg font-semibold text-primary-950">
                      Risk multiplier {dynamicPricing.riskMultiplier}x for {dynamicPricing.city}
                    </p>
                    <p className="mt-1 text-sm text-primary-900">
                      Your quote updates using weather exposure, pollution, traffic, work hours, earnings, and zone spread.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-primary-900 shadow-sm">
                    Total risk load: {dynamicPricing.riskLoadPercent}%
                  </div>
                </div>
                {dynamicPricing.drivers?.length ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dynamicPricing.drivers.map((driver) => (
                      <div key={driver.label} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                        {driver.label}: +{driver.impactPercent}%
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {premiumStatus?.riskPrediction ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-wide text-slate-500">ML risk forecast</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      Risk score {premiumStatus.riskPrediction.riskScore} • {premiumStatus.riskPrediction.riskLevel}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Predicted claims next week: {premiumStatus.riskPrediction.predictedClaimsNextWeek}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Confidence level: {Math.round((premiumStatus.riskPrediction.confidence || 0) * 100)}%
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
                    Premium forecast: {premiumStatus.forecastMultiplier || 1}x
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                    {premiumStatus.premiumRecommendation || 'Maintain current premium'}
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm ${premiumStatus.riskPrediction.riskLevel === 'HIGH' ? 'bg-red-50 text-red-700' : premiumStatus.riskPrediction.riskLevel === 'MEDIUM' ? 'bg-yellow-50 text-yellow-800' : 'bg-green-50 text-green-700'}`}>
                    AI reason: {premiumStatus.riskPrediction.reason}
                  </div>
                </div>
              </div>
            ) : null}

            {!premiumStatus?.currentWeekPaid ? (
              <button onClick={() => setShowPaymentForm(true)} className="btn-primary">
                <CreditCardIcon className="h-5 w-5 mr-2" />
                Choose Plan and Pay
              </button>
            ) : null}
          </div>
        </div>

      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Weekly Plans</h3>
          <p className="text-sm text-gray-600">Pick the plan that fits your working pattern.</p>
        </div>
        <div className="card-content grid grid-cols-1 md:grid-cols-3 gap-4">
          {tierEntries.map(([tierKey, tier]) => (
            <button
              key={tierKey}
              type="button"
              onClick={() => setSelectedTier(tierKey)}
              className={`rounded-3xl border p-5 text-left transition ${selectedTier === tierKey ? 'border-primary-300 bg-primary-50 shadow-sm ring-1 ring-primary-100' : 'border-gray-200 bg-white hover:border-primary-200'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-gray-900">{tier.label}</p>
                {selectedTier === tierKey ? <CheckCircleIcon className="h-5 w-5 text-success-600" /> : null}
              </div>
              <p className="mt-3 text-3xl font-bold text-gray-900">Rs {tier.weeklyAmount}</p>
              <p className="mt-1 text-sm text-gray-600">per week</p>
              <p className="mt-1 text-xs text-gray-500">
                Base Rs {tier.baseWeeklyAmount} • Dynamic factor {tier.pricingModel?.riskMultiplier}x
              </p>
              <div className="mt-4 rounded-2xl bg-gray-50 p-3 text-sm text-gray-700">
                Weekly payout limit: Rs {tier.weeklyCoverageLimit}
              </div>
              {tier.pricingModel?.drivers?.length ? (
                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  {tier.pricingModel.drivers.map((driver) => (
                    <p key={`${tierKey}-${driver.label}`}>{driver.label}: +{driver.impactPercent}%</p>
                  ))}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {showPaymentForm && chosenTier ? (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Confirm Weekly Payment</h3>
          </div>
          <form onSubmit={handlePaymentSubmit} className="card-content space-y-5">
            <div className="rounded-2xl border border-primary-200 bg-primary-50 p-4">
              <p className="font-semibold text-primary-900">Review full policy terms before payment</p>
              <p className="mt-1 text-sm text-primary-800">
                Read the separate Policy and Terms tab before confirming any weekly premium payment.
              </p>
              <Link to="/policies" className="btn-secondary mt-4">
                Open Policy and Terms
              </Link>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{chosenTier.label} Plan</p>
              <p className="text-sm text-slate-600 mt-1">
                Pay Rs {chosenTier.weeklyAmount} now for a weekly payout limit of Rs {chosenTier.weeklyCoverageLimit}.
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Base premium Rs {chosenTier.baseWeeklyAmount} • Dynamic multiplier {chosenTier.pricingModel?.riskMultiplier}x
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input"
              >
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Debit Card</option>
                <option value="wallet">Wallet</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transaction ID</label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Enter payment reference"
                className="input"
                required
              />
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-amber-900">
                I confirm that I reviewed the full Policy and Terms page and accept the coverage conditions, exclusions, and weekly payout limits before making this payment.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentForm(false);
                  setAcceptedTerms(false);
                  setTransactionId('');
                }}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button type="submit" disabled={paymentLoading} className="btn-primary flex-1">
                {paymentLoading ? 'Processing...' : `Pay Rs ${chosenTier.weeklyAmount}`}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Recent Payments</h3>
        </div>
        <div className="card-content">
          {premiumStatus?.paymentHistory?.length ? (
            <div className="space-y-3">
              {premiumStatus.paymentHistory.map((payment, index) => (
                <div key={index} className="flex items-center justify-between rounded-2xl bg-gray-50 p-4">
                  <div>
                    <p className="font-medium text-gray-900">{payment.weekNumber}</p>
                    <p className="text-sm text-gray-600">
                      {payment.planType || premiumStatus.planType} • {new Date(payment.paymentDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">Rs {payment.amount}</p>
                    <p className="text-sm text-gray-600">{payment.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No payment history yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryTile = ({ label, value }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="mt-2 text-lg font-semibold text-gray-900">{value}</p>
  </div>
);

export default WeeklyPremium;
