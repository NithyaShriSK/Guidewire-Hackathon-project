import React, { useEffect, useState } from 'react';
import { CloudIcon, ExclamationTriangleIcon, PlayIcon, TruckIcon } from '@heroicons/react/24/outline';
import { adminAPI, simulationAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AdminSimulation = () => {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [resultHistory, setResultHistory] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [scenariosRes, workersRes] = await Promise.all([
        simulationAPI.getScenarios(),
        adminAPI.getAllWorkers({ limit: 100 }),
      ]);

      setScenarios(scenariosRes.data.data);
      const workerList = workersRes.data.data.workers || [];
      setWorkers(workerList);
      if (workerList.length > 0) {
        setSelectedWorker(workerList[0]._id);
      }
    } catch (error) {
      toast.error('Failed to fetch simulation data');
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async (scenarioId) => {
    try {
      if (!selectedWorker) {
        toast.error('Select a worker first');
        return;
      }

      setSimulationRunning(true);
      const response = await simulationAPI.runSimulation({ scenarioId, workerId: selectedWorker });
      setLastResult(response.data.data);
      setResultHistory((prev) => [response.data.data, ...prev.filter((item) => item.scenario !== response.data.data.scenario)].slice(0, 2));
      toast.success('Simulation completed successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to run simulation');
    } finally {
      setSimulationRunning(false);
    }
  };

  const clearSimulationData = async () => {
    try {
      await simulationAPI.clearSimulationData();
      setLastResult(null);
      setResultHistory([]);
      toast.success('Simulation data cleared');
    } catch (error) {
      toast.error('Failed to clear simulation data');
    }
  };

  const getScenarioIcon = (id) => {
    switch (id) {
      case 'heavy_rain':
        return <CloudIcon className="h-8 w-8 text-blue-600" />;
      case 'extreme_pollution':
        return <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600" />;
      case 'severe_traffic':
        return <TruckIcon className="h-8 w-8 text-red-600" />;
      default:
        return <PlayIcon className="h-8 w-8 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Simulation Center</h1>
        <p className="text-gray-600">Show exactly how a trigger becomes a claim and then a payout.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Select Worker for Simulation</h3>
        </div>
        <div className="card-content">
          {workers.length === 0 ? (
            <p className="text-gray-600">No workers available. Please create a worker first.</p>
          ) : (
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.personalInfo.firstName} {worker.personalInfo.lastName} ({worker.personalInfo.email})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="card">
            <div className="card-header">
              <div className="flex items-center">
                {getScenarioIcon(scenario.id)}
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">{scenario.name}</h3>
                  <p className="text-sm text-gray-600">{scenario.description}</p>
                </div>
              </div>
            </div>
            <div className="card-content space-y-4">
              <p className="text-sm text-gray-600">{scenario.narrative}</p>
              <div className="text-sm">
                <span className="font-medium">Scenario values</span>
                <ul className="mt-1 space-y-1 text-gray-600">
                  {scenario.weather ? <li>Rainfall: {scenario.weather.rainfall} mm/hr</li> : null}
                  {scenario.pollution ? <li>AQI: {scenario.pollution.aqi}</li> : null}
                  {scenario.traffic ? <li>Congestion: {scenario.traffic.congestionLevel}/10</li> : null}
                </ul>
              </div>
              <div className="text-sm">
                <span className="font-medium">Thresholds crossed</span>
                <ul className="mt-1 space-y-1 text-gray-600">
                  {Object.entries(scenario.thresholds || {}).map(([key, value]) => (
                    <li key={key}>{key}: {value}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="card-footer">
              <button
                onClick={() => runSimulation(scenario.id)}
                disabled={simulationRunning}
                className="btn-primary w-full"
              >
                {simulationRunning ? 'Running...' : 'Run Simulation'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="card-title">Latest Simulation Story</h3>
          <button onClick={clearSimulationData} className="btn-outline">
            Clear Simulation Data
          </button>
        </div>
        <div className="card-content">
          {!lastResult ? (
            <p className="text-sm text-gray-500">Run any scenario to generate a trigger-to-payout walkthrough.</p>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="font-medium text-slate-900">
                  {lastResult.worker.name} • {lastResult.policy.policyNumber}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {lastResult.triggerSummary.metric}: {lastResult.triggerSummary.observed} {lastResult.triggerSummary.unit}
                  {' '}against threshold {lastResult.triggerSummary.threshold ?? 'N/A'} {lastResult.triggerSummary.unit}
                </p>
              </div>
              <div className="grid gap-3">
                {lastResult.timeline.map((item) => (
                  <div key={item.title} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTimelinePill(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{item.detail}</p>
                  </div>
                ))}
              </div>
              {lastResult.claim ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="font-medium text-green-900">
                    Claim {lastResult.claim.claimNumber} is now {lastResult.claim.status.current}
                  </p>
                  <p className="text-sm text-green-800 mt-1">
                    Payout amount: Rs {lastResult.claim.financial.payoutAmount} • Payout status: {lastResult.claim.financial.payoutStatus}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                  The simulation did not generate a claim for this worker.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Compare Outcomes</h3>
        </div>
        <div className="card-content">
          {resultHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Run both a no-payout simulation and a payout simulation to compare them here.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resultHistory.map((result) => (
                <div key={result.scenario} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-900">{result.scenario.replaceAll('_', ' ')}</p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getOutcomePill(result.outcome?.label)}`}>
                      {result.outcome?.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {result.triggerSummary.metric}: {result.triggerSummary.observed} {result.triggerSummary.unit}
                  </p>
                  <p className="text-sm text-gray-600">
                    Threshold: {result.triggerSummary.threshold ?? 'N/A'} {result.triggerSummary.unit}
                  </p>
                  <p className="text-sm text-gray-600">
                    Worker: {result.worker.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const getTimelinePill = (status) => {
  if (status === 'completed') return 'bg-green-100 text-green-800';
  if (status === 'in_progress') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-800';
};

const getOutcomePill = (label) => {
  if (label === 'Payout Occurred') return 'bg-green-100 text-green-800';
  if (label === 'No Payout') return 'bg-slate-100 text-slate-800';
  return 'bg-yellow-100 text-yellow-800';
};

export default AdminSimulation;
