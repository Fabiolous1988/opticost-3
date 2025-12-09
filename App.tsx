import React, { useEffect, useState } from 'react';
import Calculator from './components/Calculator';
import Settings from './components/Settings';
import { GlobalVariables, TransportRate, ModelData, BallastData } from './types';
import { fetchGlobalVariables, fetchTransportRates, fetchModelsAndBallasts } from './services/dataService';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [globalVars, setGlobalVars] = useState<GlobalVariables | null>(null);
  const [transportRates, setTransportRates] = useState<TransportRate[]>([]);
  const [models, setModels] = useState<ModelData[]>([]);
  const [ballasts, setBallasts] = useState<BallastData[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const initData = async () => {
      const [vars, rates, modelData] = await Promise.all([
        fetchGlobalVariables(),
        fetchTransportRates(),
        fetchModelsAndBallasts()
      ]);
      setGlobalVars(vars);
      setTransportRates(rates);
      setModels(modelData.models);
      setBallasts(modelData.ballasts);
      setLoading(false);
    };
    initData();
  }, []);

  if (loading || !globalVars) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
           <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
           <p className="text-slate-600 font-medium">Caricamento dati OptiCost...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Calculator 
        globalVars={globalVars} 
        transportRates={transportRates}
        models={models}
        ballasts={ballasts}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      <Settings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        variables={globalVars}
        onUpdate={setGlobalVars}
      />
    </div>
  );
};

export default App;