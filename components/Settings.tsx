
import React, { useState, useEffect } from 'react';
import { GlobalVariables, OrderedVariable } from '../types';
import { X, Save, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variables: GlobalVariables;
  onUpdate: (newVars: GlobalVariables) => void;
}

const Settings: React.FC<Props> = ({ isOpen, onClose, variables, onUpdate }) => {
  const [localOrderedVars, setLocalOrderedVars] = useState<OrderedVariable[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLocalOrderedVars(JSON.parse(JSON.stringify(variables.ordered_vars)));
    }
  }, [isOpen, variables]);

  if (!isOpen) return null;

  const handleChange = (index: number, val: string) => {
    const updated = [...localOrderedVars];
    updated[index].value = parseFloat(val) || 0;
    setLocalOrderedVars(updated);
  };

  const handleSave = () => {
    const newVars = { ...variables, ordered_vars: localOrderedVars };
    
    // Sincronizza i valori nelle chiavi interne utilizzate dal motore di calcolo
    localOrderedVars.forEach(v => {
      if (v.internalKey) {
        (newVars as any)[v.internalKey] = v.value;
      }
    });

    onUpdate(newVars);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
          <div>
            <h2 className="text-xl font-bold">ALTRE METRICHE</h2>
            <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest">Mirroring File CSV Variabili</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={24} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-[10px] text-amber-700 font-bold uppercase leading-tight mb-4">
            Le etichette sottostanti corrispondono esattamente al file di origine. Le modifiche sono temporanee per questa sessione.
          </div>

          <div className="space-y-3">
              {localOrderedVars.map((v, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-blue-300 group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-tighter group-hover:text-blue-500 transition-colors">
                      {v.label}
                    </label>
                    <div className="relative">
                      <input 
                          type="number" 
                          step="0.001"
                          value={v.value} 
                          onChange={(e) => handleChange(idx, e.target.value)} 
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded-lg font-black focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
                      />
                      {v.internalKey && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2" title="Valore di sistema mappato">
                          <RefreshCw size={12} className="text-blue-400 opacity-50" />
                        </div>
                      )}
                    </div>
                </div>
              ))}
          </div>

          <div className="space-y-3 pt-6 border-t border-slate-200">
              <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest text-blue-600 mb-2">Sconti Quantità (da file)</h3>
              <div className="grid grid-cols-1 gap-2">
                {variables.hourly_discounts.map((tier, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-blue-100/30 rounded-xl border border-blue-100 text-[10px] font-black uppercase">
                        <span className="text-slate-500">Oltre {tier.threshold} Posti Auto</span>
                        <span className="text-blue-700">{tier.percentage}% Sconto</span>
                    </div>
                ))}
              </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-white shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
          <button 
            onClick={handleSave}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-black flex justify-center items-center gap-2 hover:bg-blue-700 transition-all shadow-xl active:scale-95 shadow-blue-200"
          >
            <Save size={20} /> APPLICA MODIFICHE
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
