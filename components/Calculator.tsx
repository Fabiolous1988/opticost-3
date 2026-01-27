
import React, { useState, useEffect } from 'react';
import { Settings, Calculator as CalcIcon, Truck, Users, Hammer, FileDown, Search, MapPin, TrainFront, Plane, CreditCard, Clock, Eye, Loader2, Info, Sun, Lightbulb, Layers, HardHat, ExternalLink, Navigation, Trash2, Plus, HelpCircle, RotateCcw, CheckCircle2, Box, HandHelping } from 'lucide-react';
import { GlobalVariables, TransportRate, QuoteInputs, ServiceType, ModelData, BallastData, CalculationResult, DetailedCostBreakdown } from '../types';
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

const InfoTooltip: React.FC<{ text: string; align?: 'left' | 'right' }> = ({ text, align = 'left' }) => {
  return (
    <div className="group relative inline-block ml-2 align-middle no-print">
      <HelpCircle size={15} className="text-slate-400 hover:text-blue-500 cursor-help transition-colors" />
      <div className={`invisible group-hover:visible absolute z-[100] w-80 p-4 mt-2 text-xs leading-relaxed text-slate-100 bg-slate-900 rounded-xl shadow-2xl transition-all duration-200 pointer-events-none whitespace-pre-line border border-slate-700 opacity-0 group-hover:opacity-100 ${align === 'right' ? 'right-0' : '-left-1/2 transform -translate-x-1/3'}`}>
        {text}
        <div className={`absolute w-3 h-3 bg-slate-900 transform rotate-45 -top-1.5 border-l border-t border-slate-700 ${align === 'right' ? 'right-4' : 'left-1/2 -ml-1.5'}`}></div>
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
        logistics: { distanceKm: 0, driveDurationMinutes: 0, avgHotelPrice: 0, trainPrice: 0, trainDurationMinutes: 0, planePrice: 0, planeDurationMinutes: 0, lastMilePrice: 0, lastMileDurationMinutes: 30, lastMileOptions: [], ferryCostVan: 0, ferryCostTruck: 0, isIsland: false, recommendedMode: 'none', fetched: false },
        selectedLastMileIndex: 0,
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
        tipoZavorraNome: ballasts.length > 0 ? ballasts[0].nome : '',
        extraDaysCamionGru: 0
      };
  };

  const [inputs, setInputs] = useState<QuoteInputs>(getInitialState());
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    const selectedModel = models.find(m => m.nome === inputs.modello) || models[0];
    const selectedBallast = ballasts.find(b => b.nome === inputs.tipoZavorraNome) || ballasts[0];
    if (selectedModel) {
      const calc = calculateQuote(inputs, globalVars, transportRates, selectedModel, selectedBallast);
      setResult(calc);
    }
  }, [inputs, globalVars, transportRates, models, ballasts]);

  const handleInputChange = (field: keyof QuoteInputs, value: any) => {
    setInputs(prev => {
        let newInputs = { ...prev, [field]: value };
        if (field === 'optPannelliFotovoltaici' && value === false) newInputs.optGuarnizioni = false;
        if (field === 'optPannelliCoibentati' && value === true) newInputs.optGuarnizioni = false;
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
            selectedLastMileIndex: 0,
            publicTransportMode: logistics.recommendedMode === 'plane' && logistics.planePrice > 0 ? 'plane' : 'train',
            usePublicTransport: logistics.recommendedMode !== 'none'
        }));
    } catch (e: any) { alert(e.message); } finally { setAnalyzing(false); }
  };

  const handleCostOverride = (label: string, value: string) => {
    const num = parseFloat(value);
    setCostOverrides(prev => ({ ...prev, [label]: isNaN(num) ? 0 : num }));
  };

  const resetCostOverride = (label: string) => {
    setCostOverrides(prev => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
  };

  const getCostValue = (it: DetailedCostBreakdown) => costOverrides[it.label] !== undefined ? costOverrides[it.label] : it.value;

  const calculateFinalSellPrice = () => {
    if (!result) return 0;
    const groups = [
        result.internalTeamCosts,
        result.externalTeamCosts,
        result.generalLogisticsCosts
    ];
    let totalCostiVivi = 0;
    groups.forEach(g => g.forEach(it => { totalCostiVivi += getCostValue(it); }));
    inputs.extraCosts.forEach(ec => { totalCostiVivi += ec.value; });
    return totalCostiVivi * (1 + globalVars.margine_percentuale_installazione / 100);
  };

  const selectedModelData = models.find(m => m.nome === inputs.modello) || models[0];
  const isAssistenza = inputs.serviceType === ServiceType.ASSISTENZA;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-lg text-white"><HardHat size={32}/></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">OptiCost Pergosolar</h1>
            <p className="text-slate-500 text-sm font-medium">Gestione Preventivi Logistica & Posa v2.9</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => { setCostOverrides({}); onHardReset(); }} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold"><RotateCcw size={18} /> Azzera</button>
            <button onClick={onOpenSettings} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold"><Settings size={18} /> Config</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20 overflow-visible">
        <div className="lg:col-span-7 space-y-6 no-print overflow-visible">
          <div className="flex p-1 bg-slate-200 rounded-2xl shadow-inner overflow-visible">
            <button onClick={() => handleInputChange('serviceType', ServiceType.INSTALLAZIONE_COMPLETA)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA ? 'bg-white text-blue-700 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}><Truck size={20}/> INSTALLAZIONE COMPLETA</button>
            <button onClick={() => handleInputChange('serviceType', ServiceType.ASSISTENZA)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${inputs.serviceType === ServiceType.ASSISTENZA ? 'bg-white text-blue-700 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}><HandHelping size={20}/> SOLO ASSISTENZA</button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 overflow-visible">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight"><MapPin size={20} className="text-blue-500"/> Località & Viaggio</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex gap-2 col-span-1 md:col-span-2">
                    <input type="text" value={inputs.indirizzoCompleto} onChange={(e) => handleInputChange('indirizzoCompleto', e.target.value)} placeholder="Indirizzo completo cantiere..." className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
                    <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inputs.indirizzoCompleto)}`, '_blank')} className="p-2 text-slate-400 hover:text-blue-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"><ExternalLink size={20} /></button>
                    <button onClick={handleAnalyzeAddress} disabled={analyzing || !inputs.indirizzoCompleto} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 flex items-center gap-2 font-bold shadow-lg transition-all">{analyzing ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>} Analizza</button>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Inizio</label>
                    <input type="date" value={inputs.startDate} onChange={(e) => handleInputChange('startDate', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 font-medium" />
                </div>
            </div>

            {inputs.logistics.fetched && (
                <div className="space-y-4 pt-6 border-t animate-in fade-in slide-in-from-top-2 overflow-visible">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="bg-white p-3 rounded-xl shadow-sm text-blue-600 border border-slate-100"><CreditCard size={24}/></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hotel suggerito (Prezzo pers.)</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-slate-800">€{inputs.logistics.avgHotelPrice}</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">/ notte</span>
                                </div>
                            </div>
                        </div>
                        {inputs.logistics.hotelSource && <a href={inputs.logistics.hotelSource} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-xl border border-blue-100 text-xs font-black shadow-sm hover:bg-blue-50 transition-colors"><ExternalLink size={14}/> BOOKING</a>}
                    </div>

                    <div className="flex items-center justify-between p-1 bg-slate-100 rounded-xl max-w-sm mx-auto shadow-inner border border-slate-200 mt-6">
                        <button onClick={() => handleInputChange('usePublicTransport', false)} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${!inputs.usePublicTransport ? 'bg-white text-blue-700 shadow-md' : 'text-slate-500'}`}>Mezzo Aziendale</button>
                        <button onClick={() => handleInputChange('usePublicTransport', true)} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${inputs.usePublicTransport ? 'bg-white text-blue-700 shadow-md' : 'text-slate-500'}`}>Mezzi Pubblici</button>
                    </div>

                    {inputs.usePublicTransport && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <button onClick={() => handleInputChange('publicTransportMode', 'train')} className={`p-5 rounded-2xl border-2 text-left transition-all ${inputs.publicTransportMode === 'train' ? 'border-blue-600 bg-blue-50 shadow-lg' : 'border-slate-100 bg-white'}`}>
                                  <div className="flex justify-between items-start mb-2"><TrainFront size={24} className={inputs.publicTransportMode === 'train' ? 'text-blue-600' : 'text-slate-300'}/>{inputs.logistics.trainSource && <a href={inputs.logistics.trainSource} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()} className="p-1.5 bg-white rounded border text-blue-600 shadow-sm"><ExternalLink size={14}/></a>}</div>
                                  <h4 className="font-black text-slate-800 text-sm uppercase">Treno A/R</h4>
                                  <div className="mt-2 text-xs font-bold text-blue-700 flex justify-between"><span>€{inputs.logistics.trainPrice}</span><span className="opacity-50 font-black uppercase text-[9px]">{inputs.logistics.arrivalStation}</span></div>
                              </button>
                              <button onClick={() => handleInputChange('publicTransportMode', 'plane')} className={`p-5 rounded-2xl border-2 text-left transition-all ${inputs.publicTransportMode === 'plane' ? 'border-blue-600 bg-blue-50 shadow-lg' : 'border-slate-100 bg-white'}`}>
                                  <div className="flex justify-between items-start mb-2"><Plane size={24} className={inputs.publicTransportMode === 'plane' ? 'text-blue-600' : 'text-slate-300'}/>{inputs.logistics.planeSource && <a href={inputs.logistics.planeSource} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()} className="p-1.5 bg-white rounded border text-blue-600 shadow-sm"><ExternalLink size={14}/></a>}</div>
                                  <h4 className="font-black text-slate-800 text-sm uppercase">Aereo A/R</h4>
                                  <div className="mt-2 text-xs font-bold text-blue-700 flex justify-between"><span>€{inputs.logistics.planePrice > 0 ? inputs.logistics.planePrice : "N.D."}</span><span className="opacity-50 font-black uppercase text-[9px]">{inputs.logistics.arrivalAirport}</span></div>
                              </button>
                          </div>
                          
                          {/* Alternative Last Mile */}
                          <div className="space-y-3">
                             <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1"><Navigation size={14}/> Scegli Tratta Finale (Last Mile)</h5>
                             <div className="grid grid-cols-1 gap-2">
                                {inputs.logistics.lastMileOptions.map((opt, idx) => (
                                  <button 
                                    key={idx}
                                    onClick={() => handleInputChange('selectedLastMileIndex', idx)}
                                    className={`text-left p-4 rounded-2xl border-2 transition-all shadow-sm flex flex-col gap-2 ${inputs.selectedLastMileIndex === idx ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="flex items-center gap-2">
                                        {inputs.selectedLastMileIndex === idx ? <CheckCircle2 size={16} className="text-blue-600"/> : <div className="w-4 h-4 rounded-full border-2 border-slate-200"/>}
                                        <span className="font-black text-slate-800 text-xs uppercase tracking-tight">{opt.type}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-blue-600 font-black text-sm">€{opt.price}</span>
                                        {opt.sourceUrl && (
                                          <a 
                                            href={opt.sourceUrl} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            onClick={(e) => e.stopPropagation()} 
                                            className="p-1.5 bg-white text-blue-500 border border-blue-100 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
                                          >
                                            <ExternalLink size={12}/>
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed pl-6">{opt.details}</p>
                                    <div className="flex items-center gap-2 pl-6 mt-1">
                                      <Clock size={12} className="text-slate-400"/>
                                      <span className="text-[9px] font-black text-slate-400 uppercase">{opt.durationMinutes} min stimati</span>
                                    </div>
                                  </button>
                                ))}
                             </div>
                          </div>
                        </div>
                    )}
                </div>
            )}
          </div>

          {inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA ? (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6 overflow-visible">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight"><Hammer size={20} className="text-slate-500"/> Struttura & Montaggio</h2>
                {result && <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-lg">Totale Lavoro: {result.totalHours.toFixed(1)} Ore</div>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modello</label>
                      <select value={inputs.modello} onChange={(e) => handleInputChange('modello', e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 font-black text-slate-700 bg-white">
                          {models.map(m => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
                      </select>
                      <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-tighter">Peso Struttura: {Math.round(selectedModelData.peso_struttura_per_posto * inputs.postiAuto).toLocaleString('it-IT')} kg</p>
                  </div>
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Posti Auto</label><input type="number" min="1" value={inputs.postiAuto} onChange={(e) => handleInputChange('postiAuto', Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-4 py-2 font-black text-slate-800" /></div>
                  <div className="col-span-1 md:col-span-2 space-y-2 p-5 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-black text-slate-700 text-sm"><Layers size={18} className="text-blue-500"/> Zavorre Cemento? <InfoTooltip text={`Calcola posa zavorre (+${selectedModelData.ore_zavorre_per_posto} h/PA) e scarico con gru.`}/></div>
                          <input type="checkbox" checked={inputs.optZavorre} onChange={(e) => handleInputChange('optZavorre', e.target.checked)} className="w-6 h-6 rounded border-slate-300 text-blue-600 cursor-pointer" />
                      </div>
                      {inputs.optZavorre && (
                          <div className="flex flex-col gap-1 animate-in slide-in-from-left-2 mt-3 pt-3 border-t border-slate-200">
                              <select value={inputs.tipoZavorraNome} onChange={(e) => handleInputChange('tipoZavorraNome', e.target.value)} className="w-full border-2 border-blue-200 rounded-xl px-3 py-2 text-sm font-bold text-blue-800 bg-white">{ballasts.map(b => <option key={b.nome} value={b.nome}>{b.nome} ({b.peso_kg}kg)</option>)}</select>
                              <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter ml-1">Peso Zavorre: {Math.round(result?.weightZavorre || 0).toLocaleString('it-IT')} kg ({result?.numZavorre} pz)</p>
                          </div>
                      )}
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                      { key: 'optPannelliFotovoltaici', label: 'Moduli FV', icon: <Sun size={18}/>, hours: selectedModelData.ore_pv_per_posto },
                      { key: 'optIlluminazioneLED', label: 'Luci LED', icon: <Lightbulb size={18}/>, hours: globalVars.ore_led_per_posto_global || selectedModelData.ore_led_per_posto },
                      { key: 'optInstallazioneTelo', label: 'Telo PVC', icon: <Layers size={18}/>, hours: selectedModelData.ore_telo_per_posto },
                      { key: 'optPannelliCoibentati', label: 'Coibentato', icon: <Layers size={18}/>, hours: selectedModelData.ore_coibentati_per_posto }
                  ].map(opt => (
                      <div key={opt.key}>
                        <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all shadow-sm ${inputs[opt.key as keyof QuoteInputs] ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                            <div className="flex flex-col"><div className="flex items-center gap-3 font-black text-sm uppercase">{opt.icon} {opt.label}</div><span className="text-[10px] opacity-70 font-black ml-7 mt-1.5 bg-white/50 px-2 py-0.5 rounded">+{opt.hours.toFixed(1)} h/PA</span></div>
                            <input type="checkbox" checked={!!inputs[opt.key as keyof QuoteInputs]} onChange={(e) => handleInputChange(opt.key as keyof QuoteInputs, e.target.checked)} className="hidden" />
                        </label>
                        {opt.key === 'optPannelliFotovoltaici' && inputs.optPannelliFotovoltaici && !inputs.optPannelliCoibentati && (
                          <div className="ml-6 p-4 bg-white border-2 border-dashed border-blue-200 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-2 mt-2 shadow-sm">
                             <div className="flex flex-col"><span className="text-xs font-black text-slate-700 uppercase">Guarnizioni?</span><span className="text-[9px] text-blue-500 font-bold uppercase mt-1">+{selectedModelData.ore_pv_guarnizioni_per_posto} h/PA</span></div>
                             <input type="checkbox" checked={inputs.optGuarnizioni} onChange={(e) => handleInputChange('optGuarnizioni', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600" />
                          </div>
                        )}
                      </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 p-6 rounded-xl border-2 border-orange-200 space-y-6"><h2 className="text-lg font-black text-orange-800 flex items-center gap-2 uppercase tracking-tight"><HandHelping size={24}/> Solo Assistenza</h2><div className="grid grid-cols-2 gap-4"><div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Giorni Intervento</label><input type="number" min="1" value={inputs.assistenzaGiorni} onChange={(e) => handleInputChange('assistenzaGiorni', parseInt(e.target.value) || 1)} className="w-full text-xl font-black text-orange-700 outline-none" /></div><div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm overflow-visible"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center justify-between">Tecnici Interni <InfoTooltip text="Quanti tecnini Pergosolar partono da Verona HQ?"/></label><input type="number" min="0" value={inputs.assistenzaTecniciCount} onChange={(e) => handleInputChange('assistenzaTecniciCount', parseInt(e.target.value) || 0)} className="w-full text-xl font-black text-orange-700 outline-none" /></div></div></div>
          )}

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight"><Users size={20}/> Squadre di Posa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-5 rounded-2xl border-2 transition-all shadow-sm ${inputs.useInternalTechs ? 'border-blue-600 bg-blue-50' : 'border-slate-100 opacity-60'}`}>
                    <label className="flex items-center gap-3 font-black text-slate-800 uppercase text-xs cursor-pointer mb-2"><input type="checkbox" checked={inputs.useInternalTechs} onChange={(e) => handleInputChange('useInternalTechs', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600"/> INTERNA</label>
                    {inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA && inputs.useInternalTechs && <input type="number" min="1" value={inputs.numInternalTechs} onChange={(e) => handleInputChange('numInternalTechs', Number(e.target.value))} className="w-16 border-2 border-slate-300 rounded-xl p-2 text-center font-black text-slate-700 mt-2" />}
                </div>
                <div className={`p-5 rounded-2xl border-2 transition-all shadow-sm ${inputs.useExternalTechs ? 'border-orange-500 bg-orange-50' : 'border-slate-100 opacity-60'}`}>
                    <label className="flex items-center gap-3 font-black text-slate-800 uppercase text-xs cursor-pointer mb-2"><input type="checkbox" checked={inputs.useExternalTechs} onChange={(e) => handleInputChange('useExternalTechs', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-orange-600"/> ESTERNA</label>
                    {inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA && inputs.useExternalTechs && <input type="number" min="1" value={inputs.numExternalTechs} onChange={(e) => handleInputChange('numExternalTechs', Number(e.target.value))} className="w-16 border-2 border-orange-200 rounded-xl p-2 text-center font-black text-orange-700 mt-2" />}
                    <div className="flex items-center gap-2 text-[10px] font-black text-orange-600 uppercase mt-3"><input type="checkbox" checked={inputs.externalIsLocal} onChange={(e) => handleInputChange('externalIsLocal', e.target.checked)} className="rounded text-orange-500" /> Locale (No Hotel)</div>
                </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6 overflow-visible">
          {result && (
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 overflow-visible sticky top-6">
              <div className="bg-slate-900 text-white p-8">
                <div className="flex justify-between items-start">
                    <div>
                      <p className="text-blue-400 text-[11px] uppercase font-black tracking-widest mb-1.5 flex items-center">Quotazione Pergosolar <InfoTooltip align="right" text="Calcolo dinamico con margine e modifiche manuali."/></p>
                      <div className="text-5xl font-black text-white flex items-baseline gap-1"><span className="text-3xl text-blue-500">€</span>{calculateFinalSellPrice().toLocaleString('it-IT', {minimumFractionDigits:2})}</div>
                    </div>
                    <button onClick={()=>setShowDebug(!showDebug)} className={`p-3 rounded-xl transition-all shadow-xl ${showDebug ? 'bg-blue-600 text-white scale-110' : 'bg-slate-800 text-slate-500 hover:text-white'}`}><Eye size={24}/></button>
                </div>
                <div className="mt-8 flex flex-wrap gap-4 text-[10px] opacity-75 border-t border-slate-800 pt-5 font-black uppercase tracking-widest">
                    <span className="flex items-center gap-1.5 text-blue-300"><Clock size={14}/> {result.totalHours.toFixed(1)} ore</span>
                    <span className="flex items-center gap-1.5 text-blue-300"><Box size={14}/> {result.totalDays} giorni</span>
                    {!isAssistenza && <span className="flex items-center gap-1.5 text-blue-300"><Truck size={14}/> {(result.totalWeight / 1000).toFixed(2)} t</span>}
                </div>
              </div>

              <div className="p-8 space-y-6 overflow-visible">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm"><p className="text-[10px] uppercase text-slate-400 font-black mb-1">Trasporto Utilizzato</p><p className="text-lg font-black text-blue-700 uppercase tracking-tight">{result.transportMethod}</p></div>

                <div className="space-y-4 overflow-visible">
                    {[
                        { label: 'Viaggio e Trasferta Squadra', items: result.internalTeamCosts.filter(c => !c.label.includes('Manodopera')), color: 'border-blue-600 text-blue-700' },
                        { label: 'Manodopera e Intervento', items: [...result.internalTeamCosts.filter(c => c.label.includes('Manodopera')), ...result.externalTeamCosts], color: 'border-green-600 text-green-700' },
                        { label: 'Trasporti e Noleggi Materiale', items: result.generalLogisticsCosts, color: 'border-slate-800 text-slate-800' }
                    ].map(group => {
                        const sectionTotal = group.items.reduce((acc, it) => acc + getCostValue(it), 0);
                        return group.items.length > 0 && (
                        <div key={group.label} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <h4 className={`text-[11px] font-black uppercase mb-4 pb-2 border-b border-slate-200 flex justify-between items-center ${group.color}`}><span>{group.label}</span></h4>
                            <div className="space-y-4">
                              {group.items.map((it: any, i: number) => {
                                  const isOverridden = costOverrides[it.label] !== undefined;
                                  return (
                                  <div key={i}>
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600 font-bold flex items-center">{it.label} {it.tooltip && <InfoTooltip align="right" text={it.tooltip}/>}</span>
                                        <div className="flex items-center gap-2">
                                          {isOverridden && <button onClick={() => resetCostOverride(it.label)} className="p-1 text-red-500 hover:bg-red-50 rounded no-print"><RotateCcw size={12}/></button>}
                                          <input 
                                            type="number" 
                                            value={getCostValue(it)} 
                                            onChange={(e) => handleCostOverride(it.label, e.target.value)}
                                            className={`w-24 text-right font-black outline-none bg-transparent border-b-2 transition-all ${isOverridden ? 'border-orange-400 text-orange-600' : 'border-transparent text-slate-800 hover:border-slate-300'}`}
                                          />
                                        </div>
                                      </div>
                                      {showDebug && it.formula && <div className="text-[10px] text-blue-600 font-mono bg-blue-50 p-2 rounded-lg mt-1 border border-blue-100">{it.formula}</div>}
                                  </div>
                              )})}
                              {/* Subtotale Sezione */}
                              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                                 <span className="text-[10px] font-black uppercase text-slate-400">TOTALE {group.label}</span>
                                 <span className={`text-sm font-black ${group.color}`}>€{sectionTotal.toLocaleString('it-IT')}</span>
                              </div>
                            </div>
                        </div>
                    )})}
                </div>

                <div className="p-6 bg-slate-900 rounded-2xl text-white space-y-4 shadow-2xl">
                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Clock size={16}/> Cronoprogramma</h4>
                    <div className="space-y-3 text-[11px] font-bold">
                      {result.workSchedule.map((line, idx) => (<div key={idx} className="flex gap-3 text-slate-300"><span className="text-blue-500">•</span><span>{line}</span></div>))}
                    </div>
                </div>

                <button onClick={() => window.print()} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-700 shadow-xl no-print"><FileDown size={24}/> SCARICA REPORT PDF</button>
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
