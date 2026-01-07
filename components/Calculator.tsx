
import React, { useState, useEffect } from 'react';
import { Settings, Calculator as CalcIcon, Truck, Users, Hammer, FileDown, Search, MapPin, TrainFront, Plane, CreditCard, Clock, Eye, Loader2, Info, Sun, Lightbulb, Layers, HardHat, ExternalLink, Navigation, Trash2, Plus, HelpCircle, RotateCcw, CheckCircle2, Box } from 'lucide-react';
import { GlobalVariables, TransportRate, QuoteInputs, ServiceType, ModelData, BallastData, CalculationResult } from '../types';
import { calculateQuote } from '../services/calculationService';
import { fetchLogisticsFromAI } from '../services/aiService';
import Chatbot from './Chatbot';

interface Props {
  globalVars: GlobalVariables;
  transportRates: TransportRate[];
  onOpenSettings: () => void;
  models: ModelData[];
  ballasts: BallastData[];
  onHardReset: () => void;
}

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="group relative inline-block ml-2 align-middle">
      <HelpCircle size={15} className="text-slate-400 hover:text-blue-500 cursor-help transition-colors" />
      <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-2 text-xs text-slate-100 bg-slate-800 rounded-md shadow-xl -left-1/2 transform -translate-x-1/3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-pre-line">
        {text}
        <div className="absolute w-2 h-2 bg-slate-800 transform rotate-45 -top-1 left-1/2 -ml-1"></div>
      </div>
    </div>
  );
};

const Calculator: React.FC<Props> = ({ globalVars, transportRates, onOpenSettings, models, ballasts, onHardReset }) => {
  
  const getInitialState = (): QuoteInputs => {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 15);
      return {
        serviceType: ServiceType.INSTALLAZIONE_COMPLETA,
        startDate: defaultDate.toISOString().split('T')[0],
        indirizzoCompleto: '',
        logistics: { distanceKm: 0, driveDurationMinutes: 0, avgHotelPrice: 0, trainPrice: 0, trainDurationMinutes: 0, planePrice: 0, planeDurationMinutes: 0, lastMilePrice: 0, lastMileDurationMinutes: 30, ferryCostVan: 0, ferryCostTruck: 0, isIsland: false, recommendedMode: 'none', fetched: false },
        extraCosts: [],
        modello: models.length > 0 ? models[0].nome : '',
        postiAuto: 2,
        useInternalTechs: true,
        numInternalTechs: 2,
        useExternalTechs: false,
        numExternalTechs: 2,
        externalIsLocal: true,
        assistenzaGiorni: 1,
        assistenzaTecniciCount: 1,
        manualInternalWorkDays: null,
        optInstallazioneTelo: false,
        optPannelliFotovoltaici: false,
        optGuarnizioni: false,
        optIlluminazioneLED: false,
        optPannelliCoibentati: false,
        clientHasForklift: true, 
        usePublicTransport: false,
        publicTransportMode: 'train',
        optZavorre: false,
        tipoZavorraNome: ballasts.length > 0 ? ballasts[0].nome : ''
      };
  };

  const [inputs, setInputs] = useState<QuoteInputs>(getInitialState());
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const selectedModel = models.find(m => m.nome === inputs.modello) || models[0];
    const selectedBallast = ballasts.find(b => b.nome === inputs.tipoZavorraNome) || ballasts[0];
    if (selectedModel) {
      setResult(calculateQuote(inputs, globalVars, transportRates, selectedModel, selectedBallast));
    }
  }, [inputs, globalVars, transportRates, models, ballasts]);

  const handleInputChange = (field: keyof QuoteInputs, value: any) => {
    setInputs(prev => {
        let newInputs = { ...prev, [field]: value };
        if (field === 'optPannelliFotovoltaici' && value === false) {
            newInputs.optGuarnizioni = false;
        }
        if (field === 'optPannelliCoibentati' && value === true) {
            newInputs.optGuarnizioni = false;
        }
        return newInputs;
    });
  };

  const handleAnalyzeAddress = async () => {
    if (!inputs.indirizzoCompleto) return;
    setAnalyzing(true);
    try {
        const logistics = await fetchLogisticsFromAI(inputs.indirizzoCompleto, inputs.startDate);
        setInputs(prev => ({ 
            ...prev, 
            logistics: { ...logistics, fetched: true }, 
            publicTransportMode: logistics.recommendedMode === 'plane' ? 'plane' : 'train',
            usePublicTransport: logistics.recommendedMode !== 'none'
        }));
    } catch (e: any) { alert(e.message); } finally { setAnalyzing(false); }
  };

  const selectedModelData = models.find(m => m.nome === inputs.modello) || models[0];
  const selectedBallastData = ballasts.find(b => b.nome === inputs.tipoZavorraNome) || ballasts[0];

  // Logica ore: Somma tutto se presente
  const getFvHoursDisplay = () => {
    let base = selectedModelData.ore_pv_per_posto;
    if (inputs.optGuarnizioni) base += selectedModelData.ore_pv_guarnizioni_per_posto;
    return base;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-lg text-white"><HardHat size={32}/></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">OptiCost Pergosolar</h1>
            <p className="text-slate-500 text-sm">Software Professionale Quotazione Logistica & Posa</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={onHardReset} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold"><RotateCcw size={18} /> Azzera</button>
            <button onClick={onOpenSettings} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold"><Settings size={18} /> Config</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
        <div className="lg:col-span-7 space-y-6 no-print">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <MapPin size={20} className="text-blue-500"/>
              Indirizzo e Logistica
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex gap-2 col-span-1 md:col-span-2">
                    <input type="text" value={inputs.indirizzoCompleto} onChange={(e) => handleInputChange('indirizzoCompleto', e.target.value)} placeholder="Indirizzo completo cantiere..." className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                    <button onClick={handleAnalyzeAddress} disabled={analyzing || !inputs.indirizzoCompleto} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 flex items-center gap-2 font-bold shadow-lg shadow-blue-200">
                        {analyzing ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>} Analizza Sito
                    </button>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Inizio Lavori</label>
                    <input type="date" value={inputs.startDate} onChange={(e) => handleInputChange('startDate', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
                </div>
            </div>

            {inputs.logistics.fetched && (
                <div className="space-y-6 pt-6 border-t animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between p-1 bg-slate-100 rounded-xl max-w-sm mx-auto shadow-inner">
                        <button onClick={() => handleInputChange('usePublicTransport', false)} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${!inputs.usePublicTransport ? 'bg-white text-blue-700 shadow-md' : 'text-slate-500'}`}>Mezzo Aziendale</button>
                        <button onClick={() => handleInputChange('usePublicTransport', true)} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${inputs.usePublicTransport ? 'bg-white text-blue-700 shadow-md' : 'text-slate-500'}`}>Mezzi Pubblici</button>
                    </div>

                    {!inputs.usePublicTransport ? (
                        <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-2xl flex items-center gap-6">
                            <div className="bg-white p-4 rounded-full shadow-sm text-blue-600"><Truck size={32}/></div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Furgone Pergosolar</h3>
                                <p className="text-slate-600">Partenza ore 07:00 da HQ Verona</p>
                                <div className="flex gap-4 mt-2">
                                    <span className="text-sm font-bold bg-blue-600 text-white px-2 py-0.5 rounded">{inputs.logistics.distanceKm} km</span>
                                    <span className="text-sm font-bold text-blue-700">~{Math.round(inputs.logistics.driveDurationMinutes/60)}h guida</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button onClick={() => handleInputChange('publicTransportMode', 'train')} className={`p-6 rounded-2xl border-2 text-left transition-all ${inputs.publicTransportMode === 'train' ? 'border-blue-600 bg-blue-50 shadow-lg' : 'border-slate-100 bg-white'}`}>
                                <div className="flex justify-between items-start mb-4">
                                  <div className={`p-3 rounded-xl ${inputs.publicTransportMode === 'train' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}><TrainFront size={24}/></div>
                                  {inputs.publicTransportMode === 'train' && <CheckCircle2 size={20} className="text-green-500" />}
                                </div>
                                <h4 className="font-bold text-slate-800">Treno Reale</h4>
                                <div className="mt-2 space-y-1">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{inputs.logistics.departureStation} → {inputs.logistics.arrivalStation}</p>
                                    <p className="text-sm font-black text-blue-700">Partenza ore {inputs.logistics.trainDepartureTime}</p>
                                    {/* Visualizzazione Prezzo Biglietti Treno */}
                                    <div className="mt-3 p-2 bg-blue-100/50 rounded-lg flex items-center gap-2 border border-blue-200">
                                      <CreditCard size={14} className="text-blue-600"/>
                                      <span className="text-xs font-black text-blue-800">Biglietti: €{(inputs.logistics.trainPrice * inputs.numInternalTechs * 2).toLocaleString('it-IT')}</span>
                                    </div>
                                </div>
                            </button>
                            
                            {inputs.logistics.planePrice > 0 && (
                                <button onClick={() => handleInputChange('publicTransportMode', 'plane')} className={`p-6 rounded-2xl border-2 text-left transition-all ${inputs.publicTransportMode === 'plane' ? 'border-blue-600 bg-blue-50 shadow-lg' : 'border-slate-100 bg-white'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                      <div className={`p-3 rounded-xl ${inputs.publicTransportMode === 'plane' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Plane size={24}/></div>
                                      {inputs.publicTransportMode === 'plane' && <CheckCircle2 size={20} className="text-green-500" />}
                                    </div>
                                    <h4 className="font-bold text-slate-800">Aereo Reale</h4>
                                    <div className="mt-2 space-y-1">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{inputs.logistics.departureAirport} → {inputs.logistics.arrivalAirport}</p>
                                        <p className="text-sm font-black text-blue-700">Partenza ore {inputs.logistics.planeDepartureTime}</p>
                                        {/* Visualizzazione Prezzo Biglietti Aereo */}
                                        <div className="mt-3 p-2 bg-blue-100/50 rounded-lg flex items-center gap-2 border border-blue-200">
                                          <CreditCard size={14} className="text-blue-600"/>
                                          <span className="text-xs font-black text-blue-800">Biglietti: €{(inputs.logistics.planePrice * inputs.numInternalTechs * 2).toLocaleString('it-IT')}</span>
                                        </div>
                                    </div>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Hammer size={20} className="text-slate-500"/>
                  Struttura & Posti Auto
                </h2>
                <div className="text-[10px] bg-slate-100 px-2 py-1 rounded font-bold uppercase text-slate-500">Base: {selectedModelData.ore_struttura_per_posto} h/PA</div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modello</label>
                    <select value={inputs.modello} onChange={(e) => handleInputChange('modello', e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 font-medium">
                        {models.map(m => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Posti Auto</label>
                    <input type="number" min="1" value={inputs.postiAuto} onChange={(e) => handleInputChange('postiAuto', Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-4 py-2 font-bold" />
                </div>
                
                <div className="col-span-1 md:col-span-2 space-y-2 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-slate-700"><Layers size={20}/> Uso Zavorre Cemento? <InfoTooltip text="Calcola numero e peso totale zavorre in base al modello scelto."/></div>
                        <input type="checkbox" checked={inputs.optZavorre} onChange={(e) => handleInputChange('optZavorre', e.target.checked)} className="w-6 h-6 rounded border-slate-300 text-blue-600" />
                    </div>
                    {inputs.optZavorre && (
                        <div className="flex gap-4 items-center animate-in slide-in-from-left-2 mt-2">
                            <select value={inputs.tipoZavorraNome} onChange={(e) => handleInputChange('tipoZavorraNome', e.target.value)} className="flex-1 border rounded-lg px-2 py-2 text-sm bg-white shadow-sm font-bold">
                                {ballasts.map(b => <option key={b.nome} value={b.nome}>{b.nome} ({b.peso_kg}kg)</option>)}
                            </select>
                            {result && (
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase">Dettaglio Zavorre</p>
                                    <p className="text-xs font-black text-slate-800">
                                      {result.numZavorre} pz ({result.weightZavorre} kg) 
                                      <span className="text-blue-600 ml-2">+{selectedModelData.ore_zavorre_per_posto} h/PA</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                    { key: 'optPannelliFotovoltaici', label: 'Moduli FV', icon: <Sun size={18}/>, hours: selectedModelData.ore_pv_per_posto, tooltip: "Include posa moduli e cablaggio standard." },
                    { key: 'optIlluminazioneLED', label: 'Luci LED', icon: <Lightbulb size={18}/>, hours: selectedModelData.ore_led_per_posto, tooltip: "Installazione kit barre LED sottotetto." },
                    { key: 'optInstallazioneTelo', label: 'Telo PVC', icon: <Layers size={18}/>, hours: selectedModelData.ore_telo_per_posto, tooltip: "Tensionamento telo su perimetro." },
                    { key: 'optPannelliCoibentati', label: 'Coibentato', icon: <Layers size={18}/>, hours: selectedModelData.ore_coibentati_per_posto, tooltip: "Posa pannelli sandwich coibentati." }
                ].map(opt => (
                    <div key={opt.key} className="space-y-2">
                      <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${inputs[opt.key as keyof QuoteInputs] ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white hover:border-slate-200 text-slate-600'}`}>
                          <div className="flex flex-col">
                              <div className="flex items-center gap-3 font-bold text-sm">
                                  {opt.icon} {opt.label}
                                  <InfoTooltip text={opt.tooltip}/>
                              </div>
                              <span className="text-[9px] opacity-60 font-black ml-7 mt-1">+{opt.hours.toFixed(1)} h/PA</span>
                          </div>
                          <input type="checkbox" checked={!!inputs[opt.key as keyof QuoteInputs]} onChange={(e) => handleInputChange(opt.key as keyof QuoteInputs, e.target.checked)} className="hidden" />
                      </label>
                      
                      {/* Sub-opzione Guarnizioni (Additiva) */}
                      {opt.key === 'optPannelliFotovoltaici' && inputs.optPannelliFotovoltaici && (
                        <div className="ml-4 p-3 bg-white border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
                           <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700">Guarnizioni su FV?</span>
                              <span className="text-[9px] text-blue-500 font-bold uppercase">+{selectedModelData.ore_pv_guarnizioni_per_posto} h/PA (In aggiunta al modulo)</span>
                           </div>
                           <input 
                              type="checkbox" 
                              disabled={inputs.optPannelliCoibentati}
                              checked={inputs.optGuarnizioni} 
                              onChange={(e) => handleInputChange('optGuarnizioni', e.target.checked)}
                              className="w-5 h-5 rounded border-slate-300 text-blue-600 disabled:opacity-30" 
                           />
                        </div>
                      )}
                    </div>
                ))}
            </div>

            {result && (
              <div className="p-4 bg-slate-900 rounded-xl text-white flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-[10px] uppercase font-black text-blue-400">Riepilogo Pesi Sezione</p>
                  <div className="flex gap-4 text-xs font-bold mt-1">
                    <span>Struttura: {result.structureWeight} kg</span>
                    {inputs.optZavorre && <span>Zavorre: {result.weightZavorre} kg</span>}
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] uppercase font-black text-blue-400">Peso Totale</p>
                   <p className="text-xl font-black">{result.totalWeight} kg</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Users size={20}/> Squadre Posa
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-4 rounded-xl border-2 transition-all ${inputs.useInternalTechs ? 'border-blue-600 bg-blue-50' : 'border-slate-100 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <label className="flex items-center gap-3 font-black text-slate-800 cursor-pointer"><input type="checkbox" checked={inputs.useInternalTechs} onChange={(e) => handleInputChange('useInternalTechs', e.target.checked)} className="w-5 h-5"/> INTERNA</label>
                        <input type="number" min="1" value={inputs.numInternalTechs} onChange={(e) => handleInputChange('numInternalTechs', Number(e.target.value))} className="w-16 border-2 border-slate-300 rounded-lg p-1 text-center font-black" />
                    </div>
                </div>
                <div className={`p-4 rounded-xl border-2 transition-all ${inputs.useExternalTechs ? 'border-orange-500 bg-orange-50' : 'border-slate-100 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-3 font-black text-slate-800 cursor-pointer"><input type="checkbox" checked={inputs.useExternalTechs} onChange={(e) => handleInputChange('useExternalTechs', e.target.checked)} className="w-5 h-5"/> ESTERNA</label>
                        <input type="number" min="1" value={inputs.numExternalTechs} onChange={(e) => handleInputChange('numExternalTechs', Number(e.target.value))} className="w-16 border-2 border-slate-300 rounded-lg p-1 text-center font-black" />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-orange-600 uppercase">
                      <input type="checkbox" checked={inputs.externalIsLocal} onChange={(e) => handleInputChange('externalIsLocal', e.target.checked)} /> 
                      Squadra Locale (No Trasferte)
                    </div>
                </div>
            </div>
          </div>
        </div>

        {/* REPORT FINALE */}
        <div className="lg:col-span-5 space-y-6">
          {result && (
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden sticky top-6">
              <div className="bg-slate-900 text-white p-8">
                <div className="flex justify-between items-start">
                    <div>
                      <p className="text-blue-400 text-[10px] uppercase font-black tracking-widest mb-1 flex items-center">
                        Quota Installazione Suggerita
                        <InfoTooltip text="Prezzo comprensivo di materiali e posa, con margine aziendale del 25%."/>
                      </p>
                      <div className="text-5xl font-black text-white">€{result.sellPrice.toLocaleString('it-IT', {minimumFractionDigits:2})}</div>
                    </div>
                    <button 
                      onClick={()=>setShowDebug(!showDebug)} 
                      className={`p-3 rounded-xl transition-all shadow-lg ${showDebug ? 'bg-blue-600 text-white scale-110' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
                      title="Mostra Formule Dettagliate"
                    >
                      <Eye size={24}/>
                    </button>
                </div>
                <div className="mt-6 flex gap-3 text-xs opacity-70 border-t border-slate-800 pt-4 font-black">
                    <span className="flex items-center gap-1 uppercase tracking-tighter"><HardHat size={14}/> {inputs.modello}</span>
                    <span className="flex items-center gap-1 uppercase tracking-tighter"><Box size={14}/> {inputs.postiAuto} Posti</span>
                    <span className="flex items-center gap-1 uppercase tracking-tighter"><Clock size={14}/> {result.totalHours.toFixed(1)} ore</span>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] uppercase text-slate-400 font-black mb-1">Pesi Totali</p>
                      <p className="text-2xl font-black text-slate-900">{(result.totalWeight / 1000).toFixed(2)} t</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm text-right">
                      <p className="text-[10px] uppercase text-slate-400 font-black mb-1">Mezzo Suggerito</p>
                      <p className="text-lg font-black text-blue-700 leading-tight uppercase">{result.transportMethod}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {[
                        { label: 'A. Noleggi e Mezzi Sollevamento', items: result.generalLogisticsCosts.filter(c => c.label.includes('Muletto')), color: 'border-slate-800 text-slate-800' },
                        { label: 'B. Trasporto e Trasferte', items: [...result.generalLogisticsCosts.filter(c => !c.label.includes('Muletto')), ...result.internalTeamCosts.filter(c => !c.label.includes('Manodopera'))], color: 'border-blue-600 text-blue-700' },
                        { label: 'C. Manodopera Installazione', items: [...result.internalTeamCosts.filter(c => c.label.includes('Manodopera')), ...result.externalTeamCosts], color: 'border-green-600 text-green-700' }
                    ].map(group => group.items.length > 0 && (
                        <div key={group.label} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <h4 className={`text-[11px] font-black uppercase mb-3 pb-2 border-b border-slate-200 flex justify-between items-center ${group.color}`}>
                              <span>{group.label}</span>
                            </h4>
                            {group.items.map((it: any, i: number) => (
                                <div key={i} className="mb-4 last:mb-0">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-600 flex items-center font-bold">
                                        {it.label} 
                                        {it.tooltip && <InfoTooltip text={it.tooltip}/>}
                                      </span>
                                      <span className="font-black text-slate-800">€{it.value.toLocaleString('it-IT')}</span>
                                    </div>
                                    {showDebug && it.formula && (
                                      <div className="text-[10px] text-blue-600 font-mono bg-blue-50 p-2 rounded-lg mt-1.5 border border-blue-100 animate-in slide-in-from-top-1">
                                        CALCOLO: {it.formula}
                                      </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-slate-900 rounded-2xl text-white space-y-4 shadow-2xl border border-blue-500/30">
                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                      <Clock size={16}/> Cronoprogramma Reale
                      <InfoTooltip text="Orari basati su ricerca reale o standard aziendale."/>
                    </h4>
                    <div className="space-y-3 text-[11px] font-medium leading-relaxed">
                      {result.workSchedule.map((line, idx) => (
                        <div key={idx} className="flex gap-3 text-slate-300">
                          <span className="text-blue-500 font-black">•</span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                </div>

                <button onClick={() => window.print()} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl active:scale-95">
                  <FileDown size={24}/> SCARICA PREVENTIVO PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Chatbot inputs={inputs} vars={globalVars} result={result} />
    </div>
  );
};

export default Calculator;
