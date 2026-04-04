import React, { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  MapPinIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const WorkerDetailsModal = ({ worker, onClose }) => {
  const [fullDetails, setFullDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkerDetails = async () => {
      try {
        if (!worker?.id) return;
        const response = await adminAPI.getWorkerDetails(worker.id);
        setFullDetails(response.data.data);
      } catch (error) {
        console.error('Error fetching worker details:', error);
        toast.error('Failed to load worker details');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkerDetails();
  }, [worker?.id]);

  if (!worker) return null;

  const details = fullDetails?.worker;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Worker Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <XMarkIcon className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : fullDetails ? (
            <>
              <Section title="Personal Information">
                <DetailGrid
                  items={[
                    ['Name', details?.name],
                    ['Email', details?.email],
                    ['Phone', details?.phone],
                    ['Date of Birth', formatDate(details?.personalInfo?.dateOfBirth)],
                    ['Aadhaar', details?.personalInfo?.aadhaarNumber],
                    ['Account Status', details?.status],
                    ['Subscription', details?.subscriptionStatus],
                    ['Last Active', formatDateTime(details?.lastActive)],
                  ]}
                />
                <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                  Address: {formatAddress(details?.personalInfo?.address)}
                </div>
              </Section>

              <Section title="Live Location and Weather">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-lg bg-blue-50 p-4">
                    <div className="flex items-start">
                      <MapPinIcon className="h-5 w-5 text-blue-600 mr-3 mt-1" />
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-gray-900">{details?.location?.currentLocation?.address || 'Live location not available'}</p>
                        <p className="text-gray-600">
                          {details?.location?.currentLocation?.city || 'Unknown city'}, {details?.location?.currentLocation?.state || 'Unknown state'}
                        </p>
                        <p className="text-gray-500">
                          Region: {details?.location?.workingRegion || 'Not specified'}
                        </p>
                        <p className="text-gray-500">
                          Coordinates: {formatCoordinates(details?.location?.currentLocation)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-yellow-50 p-4">
                    <DetailGrid
                      items={[
                        ['Condition', fullDetails?.currentWeather?.weather?.conditions || 'No recent weather data'],
                        ['Rainfall', `${fullDetails?.currentWeather?.weather?.rainfall ?? 0} mm/hr`],
                        ['Temperature', `${fullDetails?.currentWeather?.weather?.temperature ?? 'N/A'} C`],
                        ['Wind Speed', `${fullDetails?.currentWeather?.weather?.windSpeed ?? 0} km/hr`],
                      ]}
                    />
                  </div>
                </div>
              </Section>

              <Section title="Work and Financial Information">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Work Profile</h4>
                    <DetailGrid
                      items={[
                        ['Working Hours', `${details?.workInfo?.typicalWorkingHours?.start || 'N/A'} - ${details?.workInfo?.typicalWorkingHours?.end || 'N/A'}`],
                        ['Preferred Zones', (details?.workInfo?.preferredWorkingZones || []).map((zone) => zone.name).join(', ') || 'None'],
                        ['Platforms', (details?.workInfo?.platforms || []).map((platform) => platform.name).join(', ') || 'None'],
                      ]}
                    />
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Financial Profile</h4>
                    <DetailGrid
                      items={[
                        ['UPI ID', details?.financialInfo?.upiId],
                        ['Bank Account', details?.financialInfo?.bankAccount?.accountNumber],
                        ['IFSC', details?.financialInfo?.bankAccount?.ifscCode],
                        ['Income Range', `Rs ${details?.financialInfo?.weeklyIncomeRange?.min || 0} - Rs ${details?.financialInfo?.weeklyIncomeRange?.max || 0}`],
                      ]}
                    />
                  </div>
                </div>
              </Section>

              <Section title="Verification and Premium Status">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Verification</h4>
                    <VerificationRow label="Email Verified" value={details?.verification?.isEmailVerified} />
                    <VerificationRow label="Phone Verified" value={details?.verification?.isPhoneVerified} />
                    <VerificationRow label="Aadhaar Verified" value={details?.verification?.isAadhaarVerified} />
                    <VerificationRow label="Bank Verified" value={details?.verification?.isBankVerified} />
                  </div>
                  <div className={`rounded-lg p-4 ${fullDetails?.premiumStatus?.currentWeekPaid ? 'bg-green-50' : 'bg-red-50'}`}>
                    <h4 className="font-medium text-gray-900 mb-3">Premium</h4>
                    <DetailGrid
                      items={[
                        ['Weekly Amount', `Rs ${fullDetails?.premiumStatus?.weeklyAmount || 0}`],
                        ['Current Week', fullDetails?.premiumStatus?.currentWeekPaid ? 'Paid' : 'Due'],
                        ['Last Payment', formatDate(fullDetails?.premiumStatus?.lastPaymentDate)],
                        ['Next Due', formatDate(fullDetails?.premiumStatus?.nextPaymentDue)],
                        ['Total Paid', `Rs ${fullDetails?.premiumStatus?.totalPaid || 0}`],
                        ['Missed Payments', fullDetails?.premiumStatus?.missedPayments || 0],
                      ]}
                    />
                  </div>
                </div>
              </Section>

              <Section title="Coverage">
                {fullDetails?.currentPolicy ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{fullDetails.currentPolicy.policyNumber}</p>
                          <p className="text-sm text-gray-600">Current weekly coverage</p>
                        </div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${fullDetails.currentPolicy.status.current === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {fullDetails.currentPolicy.status.current}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-gray-600">
                        Risks: {(fullDetails.currentPolicy.coverage?.coveredRisks || []).map((risk) => risk.type).join(', ')}
                      </div>
                    </div>
                    <DetailGrid
                      items={[
                        ['Total Policies', fullDetails?.policySummary?.totalPolicies || 0],
                        ['Active Policies', fullDetails?.policySummary?.activePolicies || 0],
                        ['Inactive Policies', fullDetails?.policySummary?.inactivePolicies || 0]
                      ]}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No coverage found.</p>
                )}
              </Section>

              <Section title="Recent Claims">
                {fullDetails?.recentClaims?.length ? (
                  <div className="space-y-3">
                    {fullDetails.recentClaims.map((claim) => (
                      <div key={claim._id} className="rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900">{claim.claimNumber}</p>
                            <p className="text-sm text-gray-600">
                              {claim.trigger?.type} • {formatDateTime(claim.trigger?.timestamp)}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-gray-700">{claim.status.current}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          Policy: {claim.policyId?.policyNumber || 'N/A'} • Payout: Rs {claim.financial?.payoutAmount || 0}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No recent claims found.</p>
                )}
              </Section>
            </>
          ) : (
            <div className="text-center text-gray-500">Failed to load worker details</div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 p-6 border-t bg-white">
          <button onClick={onClose} className="btn-outline">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div>
    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
    {children}
  </div>
);

const DetailGrid = ({ items }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {items.map(([label, value]) => (
      <div key={label}>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="font-medium text-gray-900 break-words">{value || 'N/A'}</p>
      </div>
    ))}
  </div>
);

const VerificationRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="flex items-center text-sm font-medium">
      {value ? (
        <>
          <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
          <span className="text-green-600">Yes</span>
        </>
      ) : (
        <>
          <XCircleIcon className="h-4 w-4 text-red-600 mr-2" />
          <span className="text-red-600">No</span>
        </>
      )}
    </span>
  </div>
);

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'N/A');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : 'N/A');

const formatCoordinates = (location) => {
  if (typeof location?.latitude !== 'number' || typeof location?.longitude !== 'number') {
    return 'N/A';
  }
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
};

const formatAddress = (address) => {
  if (!address) return 'N/A';
  return [address.street, address.city, address.state, address.pincode].filter(Boolean).join(', ');
};

export default WorkerDetailsModal;
