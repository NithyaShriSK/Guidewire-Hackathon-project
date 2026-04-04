import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircleIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
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
      <div className="bg-gradient-to-r from-slate-900 to-sky-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Weekly Premium</h1>
        <p className="mt-2 text-sky-100">
          Pick a weekly FixMyPay plan, accept coverage terms, and keep your payout protection active.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Coverage Status</h3>
            <p className="text-sm text-gray-600">Your current plan, eligibility, and next payment date.</p>
          </div>
          <div className="card-content space-y-5">
            <div className={`rounded-2xl p-5 ${canClaimInsurance ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-wide text-gray-500">Current Plan</p>
                  <p className="text-2xl font-bold text-gray-900">{premiumStatus?.planType || 'basic'}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Weekly premium Rs {premiumStatus?.weeklyAmount || 0} • Weekly coverage limit Rs {premiumStatus?.weeklyCoverageLimit || 0}
                  </p>
                </div>
                <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${canClaimInsurance ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {canClaimInsurance ? 'Coverage Active' : 'Payment Needed'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SummaryTile label="This Week" value={premiumStatus?.currentWeekPaid ? 'Paid' : 'Due'} />
              <SummaryTile label="Next Due" value={premiumStatus?.nextPaymentDue ? new Date(premiumStatus.nextPaymentDue).toLocaleDateString('en-IN') : 'Not set'} />
              <SummaryTile label="Total Paid" value={`Rs ${premiumStatus?.totalPaid || 0}`} />
            </div>

            {!premiumStatus?.currentWeekPaid ? (
              <button onClick={() => setShowPaymentForm(true)} className="btn-primary">
                <CreditCardIcon className="h-5 w-5 mr-2" />
                Choose Plan and Pay
              </button>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Coverage Terms</h3>
          </div>
          <div className="card-content space-y-3 text-sm text-gray-700">
            <div className="rounded-xl bg-green-50 p-4">
              <p className="font-semibold text-green-900">Covered</p>
              <p className="mt-1">Income disruption caused by heavy rain, severe AQI spikes, heat thresholds, and qualifying traffic disruption.</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="font-semibold text-red-900">Not Covered</p>
              <p className="mt-1">War, health insurance, life insurance, personal accidents, and vehicle repair or maintenance costs.</p>
            </div>
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
              className={`rounded-2xl border p-5 text-left transition ${selectedTier === tierKey ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-gray-900">{tier.label}</p>
                {selectedTier === tierKey ? <CheckCircleIcon className="h-5 w-5 text-sky-600" /> : null}
              </div>
              <p className="mt-3 text-3xl font-bold text-gray-900">Rs {tier.weeklyAmount}</p>
              <p className="mt-1 text-sm text-gray-600">per week</p>
              <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                Weekly payout limit: Rs {tier.weeklyCoverageLimit}
              </div>
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
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{chosenTier.label} Plan</p>
              <p className="text-sm text-slate-600 mt-1">
                Pay Rs {chosenTier.weeklyAmount} now for a weekly payout limit of Rs {chosenTier.weeklyCoverageLimit}.
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
                I understand this weekly plan only covers income disruption from approved parametric triggers and does not cover war, health, life, personal accident, or vehicle repair/maintenance losses.
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
