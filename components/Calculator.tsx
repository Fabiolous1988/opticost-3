import React, { useState, useEffect } from 'react';
import { Settings, Calculator as CalcIcon, Truck, Users, Hammer, FileDown, Search, MapPin, Building, TrainFront, Box, Plane, CreditCard, Calendar } from 'lucide-react';
import { GlobalVariables, TransportRate, QuoteInputs, ServiceType, ModelData, BallastData } from '../types';
import { calculateQuote } from '../services/calculationService';
import { fetchLogisticsFromAI } from '../services/aiService';

interface Props {
  globalVars: GlobalVariables;
  transportRates: TransportRate[];
  onOpenSettings: () => void;
  models: ModelData[];
  ballasts: BallastData[];
}

const Calculator: React.FC<Props> = ({ globalVars, transportRates, onOpenSettings, models, ballasts }) => {
  
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
    const logistics = await fetchLogisticsFromAI(inputs.indirizzoCompleto);
    setInputs(prev => ({ ...prev, logistics }));
    setAnalyzing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const currentBallast = ballasts.find(b => b.nome === inputs.tipoZavorraNome);

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
                    <label htmlFor="optZavorre" className="text-lg font-semibold text-slate-800 cursor-pointer">Zavorre</label>
                 </div>
                 
                 {inputs.optZavorre && (
                   <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Zavorra</label>
                          <select 
                             value={inputs.tipoZavorraNome}
                             onChange={(e) => handleInputChange('tipoZavorraNome', e.target.value)}
                             className="w-full border border-slate-300 rounded-lg px-3 py-2"
                          >
                             {ballasts.map(b => (
                               <option key={b.nome} value={b.nome}>{b.nome} ({b.peso_kg}kg)</option>
                             ))}
                          </select>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-500">Quantità calcolata: <span className="font-bold text-slate-800">{result?.numZavorre || 0}</span></div>
                          <div className="text-xs text-slate-600 mt-1">
                             Peso Singola Zavorra: <span className="font-semibold">{currentBallast?.peso_kg} kg</span><br/>
                             Peso Totale Zavorre: <span className="font-bold text-slate-800">{result?.weightZavorre?.toLocaleString()} kg</span>
                          </div>
                        </div>
                      </div>
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* Config (Assistenza) */}
          {inputs.serviceType === ServiceType.ASSISTENZA && (
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
               <h2 className="text-lg font-semibold text-slate-800">Dettagli Assistenza</h2>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Giorni Lavoro</label>
                    <input 
                      type="number" 
                      min="1"
                      value={inputs.assistenzaGiorni}
                      onChange={(e) => handleInputChange('assistenzaGiorni', Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tecnici Richiesti</label>
                    <select 
                       value={inputs.assistenzaTecniciCount}
                       onChange={(e) => handleInputChange('assistenzaTecniciCount', Number(e.target.value))}
                       className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value={1}>1 Tecnico</option>
                      <option value={2}>2 Tecnici</option>
                    </select>
                 </div>
               </div>
             </div>
          )}
        </div>

        {/* RIGHT COLUMN: RESULTS */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden sticky top-6">
             <div className="bg-slate-900 p-6 text-white">
                <h2 className="text-xl font-bold mb-1">Totale Stimato</h2>
                <div className="text-4xl font-bold text-green-400">€ {result?.sellPrice?.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                <div className="text-sm text-slate-400 mt-2">IVA Esclusa</div>
             </div>
             
             <div className="p-6 space-y-4">
                {/* Detailed Breakdown Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
                   <table className="w-full">
                       <thead className="bg-slate-50 text-slate-500 font-medium">
                           <tr>
                               <th className="px-3 py-2 text-left">Voce di Costo</th>
                               <th className="px-3 py-2 text-right">Importo</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {result?.breakdown?.map((item: any, idx: number) => (
                               <tr key={idx} className={item.isBold ? "bg-slate-50 font-semibold" : ""}>
                                   <td className="px-3 py-2">
                                       <div className="text-slate-700">{item.label}</div>
                                       {item.details && <div className="text-xs text-slate-400 font-normal">{item.details}</div>}
                                   </td>
                                   <td className="px-3 py-2 text-right text-slate-800">
                                       € {item.value.toLocaleString('it-IT', {maximumFractionDigits: 0})}
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                       <tfoot className="bg-slate-100 font-bold text-slate-800">
                           <tr>
                               <td className="px-3 py-2">Totale Costi Vivi</td>
                               <td className="px-3 py-2 text-right">€ {result?.totalCost?.toLocaleString('it-IT', {maximumFractionDigits: 0})}</td>
                           </tr>
                       </tfoot>
                   </table>
                </div>
                
                <div className="text-xs text-slate-400 flex justify-between px-2">
                    <span>Peso Totale: {result?.totalWeight?.toLocaleString()} kg</span>
                    <span>Trasporto: {result?.transportMethod}</span>
                </div>

                <button 
                  onClick={handlePrint}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors mt-4"
                >
                  <FileDown size={20} />
                  Stampa / Salva PDF
                </button>
             </div>
          </div>
        </div>
      </div>
      
      {/* PRINT LAYOUT (Visible only on Print) */}
      <div className="print-only hidden p-8 bg-white text-black h-screen">
        <div className="flex justify-between items-start mb-8 border-b-2 border-slate-900 pb-6">
           <div>
               <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Pergosolar</h1>
               <p className="text-slate-500 mt-1 uppercase tracking-wide text-sm font-semibold">Preventivo Tecnico</p>
           </div>
           <div className="text-right">
               <p className="text-sm text-slate-600">Data Inizio Lavori</p>
               <p className="font-bold text-lg">{new Date(inputs.startDate).toLocaleDateString('it-IT')}</p>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12">
           <div className="space-y-2">
             <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider border-b border-slate-200 pb-1 mb-3">Dettagli Cantiere</h3>
             <div className="flex justify-between"><span className="text-slate-600">Destinazione:</span> <span className="font-medium">{inputs.indirizzoCompleto}</span></div>
             <div className="flex justify-between"><span className="text-slate-600">Distanza Sede:</span> <span className="font-medium">{inputs.logistics.distanceKm} km</span></div>
           </div>
           
           <div className="space-y-2">
             <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider border-b border-slate-200 pb-1 mb-3">Configurazione</h3>
             {inputs.serviceType === ServiceType.INSTALLAZIONE_COMPLETA ? (
               <>
                <div className="flex justify-between"><span className="text-slate-600">Modello:</span> <span className="font-medium">{inputs.modello}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Posti Auto:</span> <span className="font-medium">{inputs.postiAuto}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Config:</span> <span className="font-medium">
                   {[
                     inputs.optInstallazioneTelo && 'Telo',
                     inputs.optPannelliFotovoltaici && 'PV',
                     inputs.optIlluminazioneLED && 'LED',
                     inputs.optPannelliCoibentati && 'Coibentato',
                     inputs.optZavorre && 'Zavorre'
                   ].filter(Boolean).join(', ')}
                </span></div>
               </>
             ) : (
                <div className="flex justify-between"><span className="text-slate-600">Servizio:</span> <span className="font-medium">Assistenza Tecnica</span></div>
             )}
           </div>
        </div>

        <div className="mb-12">
          <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider border-b-2 border-slate-900 pb-2 mb-4">Riepilogo Costi</h3>
          <table className="w-full text-sm">
             <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                   <th className="pb-2 font-medium">Descrizione</th>
                   <th className="pb-2 font-medium text-right">Valore</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {result?.breakdown?.map((item: any, idx: number) => (
                    <tr key={idx} className="py-2">
                        <td className="py-2 text-slate-700">{item.label}</td>
                        <td className="py-2 text-right font-medium">€ {item.value.toLocaleString('it-IT', {maximumFractionDigits: 0})}</td>
                    </tr>
                ))}
             </tbody>
             <tfoot>
                <tr className="border-t-2 border-slate-900 text-lg">
                   <td className="pt-4 font-bold">Totale Stimato (IVA Esclusa)</td>
                   <td className="pt-4 font-bold text-right">€ {result?.sellPrice?.toLocaleString('it-IT', {minimumFractionDigits: 2})}</td>
                </tr>
             </tfoot>
          </table>
        </div>

        <div className="text-xs text-slate-400 mt-auto pt-8 border-t border-slate-100">
           <p>Preventivo generato automaticamente da OptiCost. I valori sono indicativi e soggetti a conferma.</p>
        </div>
      </div>
    </div>
  );
};

export default Calculator;