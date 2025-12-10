import React, { useState, useEffect } from 'react';
import { Settings, Calculator as CalcIcon, Truck, Users, Hammer, FileDown, Search, MapPin, Building, TrainFront, Box, Plane, CreditCard, Calendar, Weight, AlertCircle } from 'lucide-react';
import { GlobalVariables, TransportRate, QuoteInputs, ServiceType, ModelData, BallastData } from '../types';
import { calculateQuote } from '../services/calculationService';
import { fetchLogisticsFromAI } from '../services/aiService';

interface Props {
  globalVars: GlobalVariables;
  transportRates: TransportRate[];
  onOpenSettings: () => void;
  models: ModelData[];
  ballasts: BallastData[];
  apiKey: string;
}

const Calculator: React.FC<Props> = ({ globalVars, transportRates, onOpenSettings, models, ballasts, apiKey }) => {
  
  const [inputs, setInputs] = useState<QuoteInputs>({
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
    modello: models.length > 0 ? models[0].nome : '',
    postiAuto: 2,
    useInternalTechs: true,
    numInternalTechs: 2,
    useExternalTechs: false,
    numExternalTechs: 2,
    assistenzaGiorni: 1,
    assistenzaTecniciCount: 1,
    optInstallazioneTelo: true,
    optPannelliFotovoltaici: false,
    optIlluminazioneLED: false,
    optPannelliCoibentati: false,
    clientHasForklift: true, // Default: Client HAS forklift. If false -> Rent
    usePublicTransport: false,
    optZavorre: false,
    tipoZavorraNome: ballasts.length > 0 ? ballasts[0].nome : ''
  });

  const [result, setResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
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

  const handleAnalyzeAddress = async () => {
    if (!inputs.indirizzoCompleto) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
        const logistics = await fetchLogisticsFromAI(inputs.indirizzoCompleto, apiKey);
        setInputs(prev => ({ ...prev, logistics }));
    } catch (e: any) {
        console.error("Analysis failed", e);
        setAnalysisError(e.message || "Errore sconosciuto durante l'analisi.");
    } finally {
        setAnalyzing(false);
    }
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
        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Settings size={20} />
          Impostazioni
        </button>
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

            {/* Transport Mode Toggle - Moved Here */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-sm font-medium text-slate-700">Modalità Viaggio Tecnici:</span>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                    <button 
                        onClick={() => handleInputChange('usePublicTransport', false)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${!inputs.usePublicTransport ? 'bg-slate-100 shadow-inner text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <div className="flex items-center gap-1"><Truck size={14}/> Furgone</div>
                    </button>
                    <button 
                        onClick={() => handleInputChange('usePublicTransport', true)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${inputs.usePublicTransport ? 'bg-slate-100 shadow-inner text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <div className="flex items-center gap-1"><TrainFront size={14}/> Mezzi Pubblici</div>
                    </button>
                </div>
            </div>

            {/* AI Results Display */}
            {inputs.logistics.fetched && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 animate-in fade-in duration-500">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500 block">Distanza</span>
                            <span className="font-semibold text-slate-800 text-lg">{inputs.logistics.distanceKm} km</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Viaggio Auto</span>
                            <span className="font-semibold text-slate-800 text-lg">{Math.floor(inputs.logistics.durationMinutes / 60)}h {inputs.logistics.durationMinutes % 60}m</span>
                        </div>
                         <div>
                            <span className="text-slate-500 block">Prezzo Hotel 3* (Media)</span>
                            <span className="font-semibold text-slate-800 text-lg">€ {inputs.logistics.avgHotelPrice} /notte</span>
                        </div>
                    </div>

                    {/* Detailed Public Transport - Only Show if Selected */}
                    {inputs.usePublicTransport && (
                      <div className="pt-2 border-t border-slate-200">
                         <span className="text-slate-500 block text-xs uppercase font-bold tracking-wider mb-2">Opzioni Mezzi Pubblici (A/R per persona)</span>
                         <div className="grid grid-cols-2 gap-2 text-sm">
                             <div className={`p-2 rounded border ${inputs.logistics.recommendedMode === 'train' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                                 <div className="flex items-center gap-1 font-semibold text-slate-700"><TrainFront size={14}/> Treno</div>
                                 <div className="text-slate-500 text-xs">Verona PN → Dest.</div>
                                 <div className="font-bold">€ {inputs.logistics.trainPrice || '--'}</div>
                             </div>
                             <div className={`p-2 rounded border ${inputs.logistics.recommendedMode === 'plane' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                                 <div className="flex items-center gap-1 font-semibold text-slate-700"><Plane size={14}/> Aereo</div>
                                 <div className="text-slate-500 text-xs">VRN → Aeroporto</div>
                                 <div className="font-bold">€ {inputs.logistics.planePrice || '--'}</div>
                             </div>
                             <div className="col-span-2 text-xs text-slate-500 flex justify-between px-1">
                                 <span>+ Last Mile (Taxi/Bus):</span>
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
                      <span className="font-medium text-slate-700">Tecnici Interni</span>
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
                      <span className="font-medium text-slate-700">Tecnici Esterni</span>
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
                    <div className="space-y-3">
                        {result.breakdown.map((item: any, idx: number) => (
                            <div key={idx} className={`flex justify-between items-start text-sm ${item.isBold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                <div>
                                    <span>{item.label}</span>
                                    {item.details && <span className="block text-xs text-slate-400 font-normal">{item.details}</span>}
                                </div>
                                <span>€ {item.value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        ))}
                    </div>
                    
                    {/* Summary Totals */}
                    <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
                        <div className="flex justify-between text-slate-700">
                            <span>Totale Installazione</span>
                            <span className="font-semibold">€ {result.installationCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                            <span>Totale Trasporto</span>
                            <span className="font-semibold">€ {result.transportCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                        </div>
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