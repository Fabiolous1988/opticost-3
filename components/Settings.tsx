
import React, { useState, useEffect } from 'react';
import { GlobalVariables } from '../types';
import { X, Save } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variables: GlobalVariables;
  onUpdate: (newVars: GlobalVariables) => void;
}

const Settings: React.FC<Props> = ({ isOpen, onClose, variables, onUpdate }) => {
  const [localVars, setLocalVars] = useState<GlobalVariables>(variables);

  useEffect(() => {
    setLocalVars(variables);
  }, [variables]);

  if (!isOpen) return null;

  const handleChange = (key: keyof GlobalVariables, val: string) => {
    setLocalVars(prev => ({
      ...prev,
      [key]: parseFloat(val) || 0
    }));
  };

  // Mappatura inversa per visualizzare le etichette esatte del CSV
  const displayMap: Record<string, string> = {
    soglia_distanza_trasferta_km: "Soglia Trasferta (km)",
    diaria_squadra_interna: "Diaria Squadra Interna (€/giorno)",
    diaria_squadra_esterna: "Diaria Squadra Esterna (€/giorno)",
    soglia_minima_ore_lavoro_utili: "Soglia minima ore lavoro utili (h)",
    costo_medio_gasolio_euro_litro: "Costo Gasolio (€/l)",
    km_per_litro_furgone: "Km per Litro (Furgone)",
    costo_usura_mezzo_euro_km: "Usura Mezzo (€/Km)",
    costo_noleggio_muletto_base: "Noleggio Muletto Base (€)",
    costo_noleggio_muletto_extra: "Noleggio Muletto Extra (€/giorno)",
    ore_lavoro_giornaliere_standard: "Ore Lavoro Giornaliere",
    margine_percentuale_installazione: "Margine Installazione (%)",
    costo_orario_tecnico_interno: "paga oraria tecnico squadra interna (€)",
    costo_orario_squadra_esterna: "paga oraria tecnico squadra esterna (€)"
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">OFFICIAL - ALTRE METRICHE</h2>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Configurazione Variabili Globali</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
          <div className="space-y-4">
              {Object.keys(displayMap).map((key) => {
                  const val = localVars[key as keyof GlobalVariables];
                  if (typeof val !== 'number') return null;
                  return (
                    <div key={key} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-tighter">{displayMap[key]}</label>
                        <input 
                            type="number" 
                            step="0.001"
                            value={val} 
                            onChange={(e) => handleChange(key as keyof GlobalVariables, e.target.value)} 
                            className="w-full bg-white text-slate-900 border border-slate-300 p-2 rounded-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                  );
              })}

              {/* Extra Vars dal CSV */}
              {localVars.extra_vars && Object.entries(localVars.extra_vars).map(([label, val]) => (
                <div key={label} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-tighter">{label}</label>
                  <input 
                      type="number" 
                      value={val} 
                      readOnly
                      className="w-full bg-slate-100 text-slate-400 border border-slate-200 p-2 rounded-lg font-bold outline-none cursor-not-allowed"
                  />
                </div>
              ))}
          </div>

          <div className="space-y-3 pt-6 border-t border-slate-100">
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest text-blue-600">Sconti Quantità (%)</h3>
              <div className="grid grid-cols-1 gap-2">
                {localVars.hourly_discounts.map((tier, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs font-bold">
                        <span className="text-slate-600">Oltre {tier.threshold} Posti Auto</span>
                        <span className="text-blue-700">{tier.percentage}%</span>
                    </div>
                ))}
              </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <button 
            onClick={() => { onUpdate(localVars); onClose(); }}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-black flex justify-center items-center gap-2 hover:bg-blue-700 transition-all shadow-xl active:scale-95"
          >
            <Save size={20} /> AGGIORNA CONFIGURAZIONE
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
