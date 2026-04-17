import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  ShieldExclamationIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { adminAPI, simulationAPI } from '../../services/api';
import toast from 'react-hot-toast';

const scenarioOptions = [
  {
    value: 'gps_spoofing',
    title: 'GPS Spoofing',
    description: 'Worker location jumps unrealistically and speed becomes impossible.',
  },
  {
    value: 'fake_weather_claim',
    title: 'Fake Weather Claim',
    description: 'Claim reason says heavy rain, but weather conditions do not match.',
  },
  {
    value: 'frequent_claim_abuse',
    title: 'Frequent Claim Abuse',
    description: 'Repeated claims are filed in a short time window.',
  },
  {
    value: 'normal_case',
    title: 'Normal Case',
    description: 'Control scenario with legitimate movement and consistent data.',
  },
];

const AdminFraudSimulation = () => {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('gps_spoofing');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const response = await adminAPI.getAllWorkers({ limit: 100 });
      const workerList = response.data.data.workers || [];
      setWorkers(workerList);
      if (workerList.length > 0) {
        setSelectedWorker(workerList[0]._id);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast.error('Failed to fetch workers');
    } finally {
      setLoading(false);
    }
  };

  const runFraudSimulation = async () => {
    if (!selectedWorker) {
      toast.error('Please select a worker first');
      return;
    }

    try {
      setRunning(true);
      const response = await simulationAPI.simulateFraud({
        scenario: selectedScenario,
        workerId: selectedWorker,
      });
      setResult(response.data.data);
      toast.success('Fraud simulation completed');
    } catch (error) {
      console.error('Fraud simulation error:', error);
      toast.error(error.response?.data?.message || 'Failed to run fraud simulation');
    } finally {
      setRunning(false);
    }
  };

  const selectedScenarioDetails = useMemo(
    () => scenarioOptions.find((item) => item.value === selectedScenario) || scenarioOptions[0],
    [selectedScenario]
  );

  const fraudRiskClass = result?.modelOutput?.riskLevel === 'HIGH'
    ? 'bg-red-50 text-red-700 border-red-200'
    : result?.modelOutput?.riskLevel === 'MEDIUM'
      ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
      : 'bg-green-50 text-green-700 border-green-200';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-800 p-6 text-white shadow-[0_28px_70px_-35px_rgba(15,23,42,0.9)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
              <SparklesIcon className="mr-2 h-4 w-4" />
              AI Fraud Lab
            </div>
            <h1 className="mt-4 text-3xl font-bold">Fraud Simulation Center</h1>
            <p className="mt-2 max-w-3xl text-slate-200">
              Run scenario-driven fraud detection and inspect the ML decision path, feature inputs, and final risk classification.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-cyan-50">
            <p className="font-semibold">Model outputs</p>
            <p className="mt-1">Fraud Score • Risk Level • Confidence • Explainability</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1">
          <div className="card-header">
            <h3 className="card-title">Simulation Inputs</h3>
          </div>
          <div className="card-content space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Worker</label>
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="input"
              >
                {workers.map((worker) => (
                  <option key={worker._id} value={worker._id}>
                    {worker.personalInfo.firstName} {worker.personalInfo.lastName} ({worker.personalInfo.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Scenario</label>
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="input"
              >
                {scenarioOptions.map((scenario) => (
                  <option key={scenario.value} value={scenario.value}>
                    {scenario.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-900">
                <ShieldExclamationIcon className="h-5 w-5 text-cyan-700" />
                <p className="font-semibold">{selectedScenarioDetails.title}</p>
              </div>
              <p className="mt-2 text-sm text-slate-600">{selectedScenarioDetails.description}</p>
            </div>

            <button onClick={runFraudSimulation} disabled={running} className="btn-primary w-full">
              {running ? (
                <>
                  <ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayIcon className="mr-2 h-5 w-5" />
                  Run Simulation
                </>
              )}
            </button>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="card-header flex items-center justify-between">
            <div>
              <h3 className="card-title">AI Decision Output</h3>
              <p className="text-sm text-gray-600">The result updates after the scenario is evaluated by the ML fraud service.</p>
            </div>
            {result?.modelOutput?.riskLevel ? (
              <span className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${fraudRiskClass}`}>
                {result.modelOutput.riskLevel} RISK
              </span>
            ) : null}
          </div>
          <div className="card-content space-y-5">
            {!result ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                Select a scenario and run the simulation to see the fraud score, explanation, and step-by-step decision flow.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricCard label="Fraud Score" value={result.modelOutput.fraudScore} tone={result.modelOutput.riskLevel} />
                  <MetricCard label="Risk Level" value={result.modelOutput.riskLevel} tone={result.modelOutput.riskLevel} />
                  <MetricCard label="Confidence" value={`${Math.round((result.modelOutput.confidence || 0) * 100)}%`} tone="neutral" />
                  <MetricCard label="Model Source" value={result.modelOutput.modelSource} tone="neutral" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                      <h4 className="font-semibold text-slate-900">Input Data</h4>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {Object.entries(result.inputData || {}).map(([key, value]) => (
                        <div key={key} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                          <dt className="text-slate-500">{formatLabel(key)}</dt>
                          <dd className="mt-1 font-medium text-slate-900">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                      <h4 className="font-semibold text-slate-900">AI Decision Explanation</h4>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(result.explanation || []).map((item, index) => (
                        <div key={item} className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-red-100 text-red-700' : 'bg-cyan-100 text-cyan-700'}`}>
                            {index + 1}
                          </span>
                          <p className="text-sm text-slate-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2">
                    <PlayIcon className="h-5 w-5 text-cyan-700" />
                    <h4 className="font-semibold text-slate-900">Decision Flow</h4>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(result.decisionFlow || []).map((step, index) => (
                      <div key={`${step}-${index}`} className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${index === (result.decisionFlow?.length || 1) - 1 ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 rounded-xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-sm font-medium text-slate-800">{step}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="font-semibold text-slate-900">Triggered Feature Contributions</h4>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(result.triggeredFeatures || {}).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                        <p className="text-sm text-slate-500">{formatLabel(key)}</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, tone }) => {
  const classes = {
    HIGH: 'border-red-200 bg-red-50 text-red-700',
    MEDIUM: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    LOW: 'border-green-200 bg-green-50 text-green-700',
    neutral: 'border-slate-200 bg-white text-slate-900',
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes[tone] || classes.neutral}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
};

const formatLabel = (value) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());

export default AdminFraudSimulation;
