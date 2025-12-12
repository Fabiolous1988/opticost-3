import React, { useEffect, useState } from 'react';
import Calculator from './components/Calculator';
import Settings from './components/Settings';
import { GlobalVariables, TransportRate, ModelData, BallastData } from './types';
import { fetchGlobalVariables, fetchTransportRates, fetchModelsAndBallasts } from './services/dataService';
import { KeyRound, X, Save, Trash2 } from 'lucide-react';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [globalVars, setGlobalVars] = useState<GlobalVariables | null>(null);
  const [transportRates, setTransportRates] = useState<TransportRate[]>([]);
  const [models, setModels] = useState<ModelData[]>([]);
  const [ballasts, setBallasts] = useState<BallastData[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  
  // Initialize from localStorage if available
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('opticost_api_key') || '');
  const [inputKey, setInputKey] = useState<string>('');
  
  // For the modal edit
  const [editKey, setEditKey] = useState('');

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

  useEffect(() => {
      if (isApiKeyModalOpen) {
          setEditKey(apiKey);
      }
  }, [isApiKeyModalOpen, apiKey]);

  const handleSetKey = () => {
    const cleanKey = inputKey.trim();
    if (cleanKey.length > 10) {
      setApiKey(cleanKey);
      localStorage.setItem('opticost_api_key', cleanKey);
    }
  };

  const handleUpdateKey = () => {
      const cleanKey = editKey.trim();
      if (cleanKey.length > 10) {
          setApiKey(cleanKey);
          localStorage.setItem('opticost_api_key', cleanKey);
          setIsApiKeyModalOpen(false);
      }
  };

  const handleClearKey = () => {
      if(window.confirm("Sei sicuro di voler rimuovere la chiave API? Dovrai reinserirla per usare l'app.")) {
          setApiKey('');
          localStorage.removeItem('opticost_api_key');
          setIsApiKeyModalOpen(false);
          setInputKey('');
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
            <p className="text-xs text-slate-400 mt-4">La chiave viene salvata nel browser per i prossimi accessi.</p>
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
        onOpenApiKeySettings={() => setIsApiKeyModalOpen(true)}
        apiKey={apiKey}
      />
      
      <Settings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        variables={globalVars}
        onUpdate={setGlobalVars}
      />

      {/* API Key Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Gestione API Key</h3>
                    <button onClick={() => setIsApiKeyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                <p className="text-sm text-slate-600 mb-2">Modifica la chiave API salvata:</p>
                <input 
                    type="password" 
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm"
                />

                <div className="flex flex-col gap-2">
                    <button 
                        onClick={handleUpdateKey}
                        className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        <Save size={18} /> Salva Nuova Chiave
                    </button>
                    <button 
                        onClick={handleClearKey}
                        className="w-full bg-white border border-red-200 text-red-600 font-semibold py-2 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2"
                    >
                        <Trash2 size={18} /> Rimuovi Chiave (Logout)
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;