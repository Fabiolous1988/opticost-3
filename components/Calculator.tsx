import React, { useState, useEffect } from 'react';
import { Settings, Calculator as CalcIcon, Truck, Users, Hammer, FileDown, Search, MapPin, Building, TrainFront, Box, Plane, CreditCard, Calendar, Weight, AlertCircle, Anchor, RotateCcw, KeyRound, Plus, Trash2 } from 'lucide-react';
import { GlobalVariables, TransportRate, QuoteInputs, ServiceType, ModelData, BallastData, CustomExtraCost } from '../types';
import { calculateQuote } from '../services/calculationService';
import { fetchLogisticsFromAI } from '../services/aiService';

interface Props {
  globalVars: GlobalVariables;
  transportRates: TransportRate[];
  onOpenSettings: () => void;
  onOpenApiKeySettings: () => void;
  models: ModelData[];
  ballasts: BallastData[];
  apiKey: string;
}

const Calculator: React.FC<Props> = ({ globalVars, transportRates, onOpenSettings, onOpenApiKeySettings, models, ballasts, apiKey }) => {
  
  const getInitialState = (): QuoteInputs => ({
    serviceType: ServiceType.INSTALLAZIONE_COMPLETA,
    startDate: new Date().toISOString().split('T')[0],
    indirizzoCompleto: '',
    logistics: {
        distanceKm: 0,
        durationMinutes: 0,
        avgHotelPrice: 0,
        trainPrice: 0,
        planePrice: 0,
        lastMilePrice: 0,
        recommendedMode: 'none',
        fetched: false
    },
    extraCosts: [],
    modello: models.length > 0 ? models[0].nome : '',
    postiAuto: 2,
    useInternalTechs: true,
    numInternalTechs: 2,
    useExternalTechs: false,
    numExternalTechs: 2,
    assistenzaGiorni: 1,
    assistenzaTecniciCount: 1,
    optInstallazioneTelo: false,
    optPannelliFotovoltaici: false,
    optIlluminazioneLED: false,
    optPannelliCoibentati: false,
    clientHasForklift: true, 
    usePublicTransport: false,
    publicTransportMode: 'train',
    optZavorre: false,
    tipoZavorraNome: ballasts.length > 0 ? ballasts[0].nome : ''
  });

  const [inputs, setInputs] = useState<QuoteInputs>(getInitialState());
  const [result, setResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // New Custom Cost Input State
  const [newExtraLabel, setNewExtraLabel] = useState('');
  const [newExtraValue, setNewExtraValue] = useState('');

  useEffect(() => {
    // Only set defaults on mount if they are empty, but don't overwrite user changes
    if (models.length > 0 && !inputs.modello) {
      setInputs(prev => ({ ...prev, modello: models[0].nome }));
    }
    if (ballasts.length > 0 && !inputs.tipoZavorraNome) {
       setInputs(prev => ({ ...prev, tipoZavorraNome: ballasts[0].nome }));
    }
  }, [models, ballasts]);

  useEffect(() => {
    const selectedModel = models.find(m => m.nome === inputs.modello) || models[0];
    const selectedBallast = ballasts.find(b => b.nome === inputs.tipoZavorraNome) || ballasts[0];
    
    if (selectedModel) {
      const res = calculateQuote(inputs, globalVars, transportRates, selectedModel, selectedBallast);
      setResult(res);
    }
  }, [inputs, globalVars, transportRates, models, ballasts]);

  const handleInputChange = (field: keyof QuoteInputs, value: any) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
      if (window.confirm("Sei sicuro di voler azzerare tutti i campi e iniziare un nuovo preventivo?")) {
        const initialState = getInitialState();
        // Ensure we preserve model/ballast defaults if loaded
        if (models.length > 0) initialState.modello = models[0].nome;
        if (ballasts.length > 0) initialState.tipoZavorraNome = ballasts[0].nome;
        
        setInputs(initialState);
        setResult(null);
        setAnalysisError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const handleAnalyzeAddress = async () => {
    if (!inputs.indirizzoCompleto) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
        // Estimate duration based on current inputs (default 1 day or calculate)
        // We do a rough pass first, calculateQuote will be more accurate later but for AI lookup we need an estimate
        const estimatedDays = inputs.serviceType === ServiceType.ASSISTENZA ? inputs.assistenzaGiorni : 5;
        
        const logistics = await fetchLogisticsFromAI(inputs.indirizzoCompleto, apiKey, inputs.startDate, estimatedDays);
        setInputs(prev => ({ 
            ...prev, 
            logistics,
            publicTransportMode: logistics.recommendedMode === 'plane' ? 'plane' : 'train'
        }));
    } catch (e: any) {
        console.error("Analysis failed", e);
        setAnalysisError(e.message || "Errore sconosciuto durante l'analisi.");
    } finally {
        setAnalyzing(false);
    }
  };

  const addExtraCost = () => {
      if (newExtraLabel && newExtraValue) {
          const val = parseFloat(newExtraValue);
          if (!isNaN(val)) {
              const newItem: CustomExtraCost = {
                  id: Date.now().toString(),
                  label: newExtraLabel,
                  value: val
              };
              setInputs(prev => ({
                  ...prev,
                  extraCosts: [...prev.extraCosts, newItem]
              }));
              setNewExtraLabel('');
              setNewExtraValue('');
          }
      }
  };

  const removeExtraCost = (id: string) => {
      setInputs(prev => ({
          ...prev,
          extraCosts: prev.extraCosts.filter(item => item.id !== id)
      }));
  };

  const handlePrint = () => {
    window.print();
  };

  const currentBallast = ballasts.find(b => b.nome === inputs.tipoZavorraNome);
  const calculatedBallasts = inputs.optZavorre ? (1 + Math.ceil(inputs.postiAuto / 2)) : 0;
  const calculatedBallastWeight = currentBallast ? (calculatedBallasts * currentBallast.peso_kg) : 0;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalcIcon className="text-blue-600" />
            OptiCost Preventivatore
          </h1>
          <p className="text-slate-500">Pergosolar Internal Tool</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 mr-2"
              >
                 <RotateCcw size={20} />
                 Azzera
            </button>
            <button 
              onClick={onOpenApiKeySettings}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              <KeyRound size={20} />
              API Key
            </button>
            <button 
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              <Settings size={20} />
              Impostazioni
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: INPUTS */}
        <div className="lg:col-span-7 space-y-6 no-print">
          
          {/* Service Selection */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Tipo Servizio</h2>
            <div className="flex gap-4">
              <button 
                onClick={() => handleInputChange('serviceType', ServiceType.INSTALLAZIONE_COMPLETA)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                  inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA 
                  ? 'border-blue-600 bg-blue-50 text-blue-700' 
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                Installazione Completa
              </button>
              <button 
                onClick={() => handleInputChange('serviceType', ServiceType.ASSISTENZA)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                  inputs.serviceType === ServiceType.ASSISTENZA 
                  ? 'border-blue-600 bg-blue-50 text-blue-700' 
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                Assistenza Tecnici
              </button>
            </div>
          </div>

          {/* Location & AI Analysis */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <MapPin size={20} className="text-slate-500"/>
                Cantiere & Logistica
            </h2>
            
            {/* Start Date */}
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar size={14} /> Data Inizio Lavori
               </label>
               <input 
                 type="date"
                 value={inputs.startDate}
                 onChange={(e) => handleInputChange('startDate', e.target.value)}
                 className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
               />
            </div>
            
            <div className="flex gap-2">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Indirizzo Completo Cantiere</label>
                    <input 
                      type="text" 
                      value={inputs.indirizzoCompleto}
                      onChange={(e) => handleInputChange('indirizzoCompleto', e.target.value)}
                      placeholder="Es: Corso Milano 15, Padova"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
                <div className="flex items-end">
                    <button 
                        onClick={handleAnalyzeAddress}
                        disabled={analyzing || !inputs.indirizzoCompleto}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors h-[42px] flex items-center gap-2"
                    >
                        {analyzing ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Search size={18} />
                        )}
                        Analizza
                    </button>
                </div>
            </div>

            {/* Analysis Error Message */}
            {analysisError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span className="break-words">{analysisError}</span>
              </div>
            )}

            {/* Transport Mode Toggle */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-sm font-medium text-slate-700">Modalità Viaggio Tecnici:</span>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                    <button 
                        onClick={() => handleInputChange('usePublicTransport', false)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${!inputs.usePublicTransport ? 'bg-slate-100 shadow-inner text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <div className="flex items-center gap-1"><Truck size={14}/> Nostro Mezzo</div>
                    </button>
                    <button 
                        onClick={() => handleInputChange('usePublicTransport', true)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${inputs.usePublicTransport ? 'bg-slate-100 shadow-inner text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <div className="flex items-center gap-1"><TrainFront size={14}/> Mezzi Pubblici</div>
                    </button>
                </div>
            </div>

             {/* Manual Extra Costs (Dynamic) */}
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                  <Anchor size={14} /> Costi Extra (Es. Traghetto, Pedaggi ZTL, etc)
               </label>
               
               {/* List of added extra costs */}
               {inputs.extraCosts.length > 0 && (
                   <div className="mb-3 space-y-2">
                       {inputs.extraCosts.map(item => (
                           <div key={item.id} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded text-sm">
                               <span className="text-slate-700">{item.label}</span>
                               <div className="flex items-center gap-3">
                                   <span className="font-semibold">€ {item.value}</span>
                                   <button onClick={() => removeExtraCost(item.id)} className="text-red-500 hover:text-red-700">
                                       <Trash2 size={16} />
                                   </button>
                               </div>
                           </div>
                       ))}
                   </div>
               )}

               {/* Add new */}
               <div className="flex gap-2">
                   <input 
                     type="text"
                     value={newExtraLabel}
                     onChange={(e) => setNewExtraLabel(e.target.value)}
                     className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                     placeholder="Descrizione (es. Traghetto)"
                   />
                   <div className="relative w-24">
                       <input 
                        type="number"
                        min="0"
                        value={newExtraValue}
                        onChange={(e) => setNewExtraValue(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                        placeholder="€"
                        />
                   </div>
                   <button 
                     onClick={addExtraCost}
                     className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 rounded-lg"
                   >
                       <Plus size={20} />
                   </button>
               </div>
            </div>

            {/* AI Results Display */}
            {inputs.logistics.fetched && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 animate-in fade-in duration-500">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500 block">Distanza (Solo Andata)</span>
                            <span className="font-semibold text-slate-800 text-lg">{inputs.logistics.distanceKm} km</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Viaggio (Solo Andata)</span>
                            <span className="font-semibold text-slate-800 text-lg">{Math.floor(inputs.logistics.durationMinutes / 60)}h {inputs.logistics.durationMinutes % 60}m</span>
                        </div>
                         <div>
                            <span className="text-slate-500 block">Prezzo Hotel 3* (Media)</span>
                            <span className="font-semibold text-slate-800 text-lg">€ {inputs.logistics.avgHotelPrice} /notte</span>
                        </div>
                    </div>

                    {/* Detailed Public Transport - Selectable */}
                    {inputs.usePublicTransport && (
                      <div className="pt-2 border-t border-slate-200">
                         <span className="text-slate-500 block text-xs uppercase font-bold tracking-wider mb-2">Seleziona Opzione Mezzi (A/R per persona)</span>
                         <div className="grid grid-cols-2 gap-2 text-sm">
                             {/* TRAIN OPTION */}
                             <div 
                                onClick={() => handleInputChange('publicTransportMode', 'train')}
                                className={`p-2 rounded border cursor-pointer transition-all ${
                                    inputs.publicTransportMode === 'train' 
                                    ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-500' 
                                    : 'bg-white border-slate-200 hover:border-blue-300'
                                }`}
                             >
                                 <div className="flex items-center gap-1 font-semibold text-slate-700"><TrainFront size={14}/> Treno</div>
                                 <div className="text-slate-500 text-xs">Verona PN ↔ Dest.</div>
                                 <div className="font-bold text-lg mt-1">€ {inputs.logistics.trainPrice || '--'}</div>
                             </div>

                             {/* PLANE OPTION */}
                             <div 
                                onClick={() => handleInputChange('publicTransportMode', 'plane')}
                                className={`p-2 rounded border cursor-pointer transition-all ${
                                    inputs.publicTransportMode === 'plane' 
                                    ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-500' 
                                    : 'bg-white border-slate-200 hover:border-blue-300'
                                }`}
                             >
                                 <div className="flex items-center gap-1 font-semibold text-slate-700"><Plane size={14}/> Aereo</div>
                                 <div className="text-slate-500 text-xs">VRN ↔ Aeroporto</div>
                                 <div className="font-bold text-lg mt-1">€ {inputs.logistics.planePrice || '--'}</div>
                             </div>

                             <div className="col-span-2 text-xs text-slate-500 flex justify-between px-1 mt-1">
                                 <span>+ Last Mile stimato (Taxi/Bus):</span>
                                 <span className="font-semibold">€ {inputs.logistics.lastMilePrice}</span>
                             </div>
                         </div>
                      </div>
                    )}
                </div>
            )}
            
            {/* Assistenza Details */}
            {inputs.serviceType === ServiceType.ASSISTENZA && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numero Giorni</label>
                    <input 
                      type="number"
                      min="1"
                      value={inputs.assistenzaGiorni}
                      onChange={(e) => handleInputChange('assistenzaGiorni', Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numero Tecnici</label>
                    <select
                      value={inputs.assistenzaTecniciCount}
                      onChange={(e) => handleInputChange('assistenzaTecniciCount', Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                        <option value={1}>1 Tecnico</option>
                        <option value={2}>2 Tecnici</option>
                        <option value={3}>3 Tecnici</option>
                        <option value={4}>4 Tecnici</option>
                    </select>
                 </div>
              </div>
            )}

            {inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Modello</label>
                  <select 
                    value={inputs.modello}
                    onChange={(e) => handleInputChange('modello', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {models.map(m => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Numero Posti Auto</label>
                  <input 
                    type="number" 
                    min="1"
                    value={inputs.postiAuto}
                    onChange={(e) => handleInputChange('postiAuto', Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Configuration (Installazione Completa) */}
          {inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
              
              {/* Technicians */}
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Users size={20} className="text-slate-500"/> Squadra
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox"
                        checked={inputs.useInternalTechs}
                        onChange={(e) => handleInputChange('useInternalTechs', e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                      />
                      <span className="font-medium text-slate-700">Personale Azienda (Interno)</span>
                    </div>
                    {inputs.useInternalTechs && (
                      <input 
                        type="number"
                        min="1"
                        value={inputs.numInternalTechs}
                        onChange={(e) => handleInputChange('numInternalTechs', Number(e.target.value))}
                        className="w-20 border border-slate-300 rounded px-2 py-1 text-center"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox"
                        checked={inputs.useExternalTechs}
                        onChange={(e) => handleInputChange('useExternalTechs', e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                      />
                      <span className="font-medium text-slate-700">Personale Esterno</span>
                    </div>
                    {inputs.useExternalTechs && (
                      <input 
                        type="number"
                        min="1"
                        value={inputs.numExternalTechs}
                        onChange={(e) => handleInputChange('numExternalTechs', Number(e.target.value))}
                        className="w-20 border border-slate-300 rounded px-2 py-1 text-center"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="border-t border-slate-100 pt-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Hammer size={20} className="text-slate-500"/> Configurazione Cantiere
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={inputs.optInstallazioneTelo} onChange={(e) => handleInputChange('optInstallazioneTelo', e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/>
                    <span>Inst. Telo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={inputs.optPannelliFotovoltaici} onChange={(e) => handleInputChange('optPannelliFotovoltaici', e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/>
                    <span>Pannelli FV</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={inputs.optIlluminazioneLED} onChange={(e) => handleInputChange('optIlluminazioneLED', e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/>
                    <span>Illuminazione LED</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={inputs.optPannelliCoibentati} onChange={(e) => handleInputChange('optPannelliCoibentati', e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/>
                    <span>Pannelli Coibentati</span>
                  </label>
                </div>
                
                {/* Forklift Toggle */}
                <div className="mt-4 p-3 border border-orange-200 bg-orange-50 rounded-lg flex justify-between items-center">
                   <div className="flex items-center gap-2">
                       <Box size={20} className="text-orange-600"/>
                       <span className="font-medium text-slate-800">Mezzo di Scarico/Muletto in Cantiere</span>
                   </div>
                   <div className="flex items-center gap-2">
                        <span className={`text-sm ${!inputs.clientHasForklift ? 'font-bold text-orange-700' : 'text-slate-500'}`}>NO (Noleggio)</span>
                        <div 
                           className={`w-12 h-6 flex items-center bg-slate-300 rounded-full p-1 cursor-pointer transition-colors duration-300 ${inputs.clientHasForklift ? 'bg-green-500' : 'bg-slate-300'}`}
                           onClick={() => handleInputChange('clientHasForklift', !inputs.clientHasForklift)}
                        >
                           <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${inputs.clientHasForklift ? 'translate-x-6' : ''}`}></div>
                        </div>
                        <span className={`text-sm ${inputs.clientHasForklift ? 'font-bold text-green-700' : 'text-slate-500'}`}>SI (Disponibile)</span>
                   </div>
                </div>
              </div>

              {/* Ballasts (Zavorre) */}
              <div className="border-t border-slate-100 pt-6">
                 <div className="flex items-center gap-3 mb-4">
                    <input 
                      type="checkbox"
                      id="optZavorre"
                      checked={inputs.optZavorre}
                      onChange={(e) => handleInputChange('optZavorre', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                    />
                    <label htmlFor="optZavorre" className="text-lg font-semibold text-slate-800 flex items-center gap-2 cursor-pointer">
                        <Weight size={20} className="text-slate-500"/> Zavorre
                    </label>
                 </div>
                 
                 {inputs.optZavorre && (
                     <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in slide-in-from-top-2 duration-300">
                         <label className="block text-sm font-medium text-slate-700 mb-2">Tipologia Zavorra</label>
                         <select 
                           value={inputs.tipoZavorraNome}
                           onChange={(e) => handleInputChange('tipoZavorraNome', e.target.value)}
                           className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4"
                         >
                            {ballasts.map(b => (
                                <option key={b.nome} value={b.nome}>
                                    {b.nome} ({b.peso_kg} kg)
                                </option>
                            ))}
                         </select>
                         
                         <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-2">
                             <span className="text-slate-600">Quantità Calcolata: <strong>{calculatedBallasts} pz</strong></span>
                             <span className="text-slate-600">Peso Totale Zavorre: <strong>{calculatedBallastWeight} kg</strong></span>
                         </div>
                     </div>
                 )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: RESULTS */}
        <div className="lg:col-span-5 space-y-6">
          {result && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden sticky top-6">
              <div className="bg-slate-900 text-white p-6">
                <div className="flex justify-between items-start">
                   <div>
                       <p className="text-slate-400 text-sm uppercase tracking-wider font-semibold mb-1">Totale Preventivato</p>
                       <h2 className="text-4xl font-bold">€ {result.sellPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                       <p className="text-slate-400 text-sm mt-1">+ IVA</p>
                   </div>
                   <div className="text-right">
                       <div className="inline-block bg-white/10 px-3 py-1 rounded text-sm font-medium">
                          Costo Vivo: € {result.totalCost.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                       </div>
                   </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                
                {/* Transport Method Summary */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-800 rounded-lg">
                    <Truck size={20} />
                    <div>
                        <p className="text-xs font-bold uppercase opacity-70">Logistica Trasporto</p>
                        <p className="font-medium">{result.transportMethod}</p>
                    </div>
                </div>

                {/* DETAILED BREAKDOWN TABLE */}
                <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">
                        Dettaglio Costi
                    </h3>
                    <div className="space-y-4">
                        
                        {/* Internal Team Section */}
                        {result.internalTeamCosts.length > 0 && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <h4 className="font-bold text-blue-700 text-xs uppercase mb-2">Squadra Interna</h4>
                                {result.internalTeamCosts.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-start text-sm mb-1 last:mb-0 text-slate-700">
                                        <div>
                                            <span className={item.isBold ? 'font-semibold' : ''}>{item.label}</span>
                                            {item.details && <span className="block text-xs text-slate-400 font-normal">{item.details}</span>}
                                        </div>
                                        <span className="font-medium">€ {item.value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* External Team Section */}
                        {result.externalTeamCosts.length > 0 && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <h4 className="font-bold text-orange-700 text-xs uppercase mb-2">Squadra Esterna</h4>
                                {result.externalTeamCosts.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-start text-sm mb-1 last:mb-0 text-slate-700">
                                        <div>
                                            <span className={item.isBold ? 'font-semibold' : ''}>{item.label}</span>
                                            {item.details && <span className="block text-xs text-slate-400 font-normal">{item.details}</span>}
                                        </div>
                                        <span className="font-medium">€ {item.value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* General Logistics & Equipment */}
                        {result.generalLogisticsCosts.length > 0 && (
                             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <h4 className="font-bold text-slate-700 text-xs uppercase mb-2">Logistica Materiali & Noleggi</h4>
                                {result.generalLogisticsCosts.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-start text-sm mb-1 last:mb-0 text-slate-700">
                                        <div>
                                            <span className={item.isBold ? 'font-semibold' : ''}>{item.label}</span>
                                            {item.details && <span className="block text-xs text-slate-400 font-normal">{item.details}</span>}
                                        </div>
                                        <span className="font-medium">€ {item.value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Custom Extra Costs */}
                        {inputs.extraCosts.length > 0 && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <h4 className="font-bold text-purple-700 text-xs uppercase mb-2">Costi Extra Personalizzati</h4>
                                {inputs.extraCosts.map((item) => (
                                    <div key={item.id} className="flex justify-between items-start text-sm mb-1 last:mb-0 text-slate-700">
                                        <span>{item.label}</span>
                                        <span className="font-medium">€ {item.value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Summary Totals */}
                    <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
                        <div className="flex justify-between text-slate-700">
                            <span>Totale Installazione (Manodopera + Logistica Tecnici)</span>
                            <span className="font-semibold">€ {result.installationTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                            <span>Totale Trasporto (Materiali)</span>
                            <span className="font-semibold">€ {result.transportTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                        </div>
                         <div className="flex justify-between text-slate-700">
                            <span>Totale Noleggi</span>
                            <span className="font-semibold">€ {result.equipmentTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {result.extraCostsTotal > 0 && (
                            <div className="flex justify-between text-slate-700">
                                <span>Totale Extra</span>
                                <span className="font-semibold">€ {result.extraCostsTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}

                         {result.discountAppliedPerc > 0 && (
                            <div className="flex justify-between text-green-600 font-medium text-sm pt-2">
                                <span>Sconto Qtà Applicato</span>
                                <span>{result.discountAppliedPerc}%</span>
                            </div>
                        )}
                    </div>
                </div>

                <button 
                  onClick={handlePrint}
                  className="w-full py-3 border-2 border-slate-900 text-slate-900 rounded-lg font-bold hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-2 no-print"
                >
                  <FileDown size={20} /> Scarica PDF / Stampa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calculator;