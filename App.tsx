import React, { useEffect, useState } from 'react';
import Calculator from './components/Calculator';
import Settings from './components/Settings';
import { GlobalVariables, TransportRate, ModelData, BallastData } from './types';
import { fetchGlobalVariables, fetchTransportRates, fetchModelsAndBallasts } from './services/dataService';
import { KeyRound } from 'lucide-react';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [globalVars, setGlobalVars] = useState<GlobalVariables | null>(null);
  const [transportRates, setTransportRates] = useState<TransportRate[]>([]);
  const [models, setModels] = useState<ModelData[]>([]);
  const [ballasts, setBallasts] = useState<BallastData[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [inputKey, setInputKey] = useState<string>('');

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

  const handleSetKey = () => {
    if (inputKey.trim().length > 10) {
      setApiKey(inputKey.trim());
    }
  };

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <KeyRound className="text-blue-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Pergosolar OptiCost</h1>
            <p className="text-slate-500 mb-6">Inserisci la tua Gemini API Key per accedere al preventivatore.</p>
            
            <input 
              type="password" 
              placeholder="Incolla qui la tua API Key..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            
            <button 
              onClick={handleSetKey}
              disabled={inputKey.length < 10}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
            >
              Accedi al Software
            </button>
            <p className="text-xs text-slate-400 mt-4">La chiave non viene salvata permanentemente per sicurezza.</p>
        </div>
      </div>
    );
  }

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
        apiKey={apiKey}
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