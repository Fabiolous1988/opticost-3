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

  // Sync local state when props change (e.g. after CSV fetch)
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

  const handleSave = () => {
    onUpdate(localVars);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0">
          <h2 className="text-xl font-bold text-slate-800">Impostazioni Variabili</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-blue-600 border-b pb-2">Logistica & Diarie</h3>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Soglia Trasferta (km)</label>
              <input type="number" value={localVars.soglia_distanza_trasferta_km} onChange={(e) => handleChange('soglia_distanza_trasferta_km', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Diaria Squadra Interna (€/giorno)</label>
              <input type="number" value={localVars.diaria_squadra_interna} onChange={(e) => handleChange('diaria_squadra_interna', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
             <div>
              <label className="block text-sm text-slate-600 mb-1">Diaria Squadra Esterna (€/giorno)</label>
              <input type="number" value={localVars.diaria_squadra_esterna} onChange={(e) => handleChange('diaria_squadra_esterna', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Soglia Minima Ore Lavoro Utili</label>
              <input type="number" value={localVars.soglia_minima_ore_lavoro_utili} onChange={(e) => handleChange('soglia_minima_ore_lavoro_utili', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-blue-600 border-b pb-2">Costi Mezzi & Noleggi</h3>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Costo Gasolio (€/L)</label>
              <input type="number" value={localVars.costo_medio_gasolio_euro_litro} onChange={(e) => handleChange('costo_medio_gasolio_euro_litro', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Km per Litro (Furgone)</label>
              <input type="number" value={localVars.km_per_litro_furgone} onChange={(e) => handleChange('km_per_litro_furgone', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Usura Mezzo (€/km)</label>
              <input type="number" value={localVars.costo_usura_mezzo_euro_km} onChange={(e) => handleChange('costo_usura_mezzo_euro_km', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
            <div>
               <label className="block text-sm text-slate-600 mb-1">Noleggio Muletto Base (€)</label>
               <input type="number" value={localVars.costo_noleggio_muletto_base} onChange={(e) => handleChange('costo_noleggio_muletto_base', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
            <div>
               <label className="block text-sm text-slate-600 mb-1">Noleggio Muletto Extra (€/giorno)</label>
               <input type="number" value={localVars.costo_noleggio_muletto_extra} onChange={(e) => handleChange('costo_noleggio_muletto_extra', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-blue-600 border-b pb-2">Manodopera & Margini</h3>
            <div>
               <label className="block text-sm text-slate-600 mb-1">Costo Orario Interno (€/h)</label>
               <input type="number" value={localVars.costo_orario_tecnico_interno} onChange={(e) => handleChange('costo_orario_tecnico_interno', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Costo Orario Esterno (€/h)</label>
              <input type="number" value={localVars.costo_orario_squadra_esterna} onChange={(e) => handleChange('costo_orario_squadra_esterna', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Ore Lavoro Giornaliere</label>
              <input type="number" value={localVars.ore_lavoro_giornaliere_standard} onChange={(e) => handleChange('ore_lavoro_giornaliere_standard', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Margine Installazione (%)</label>
              <input type="number" value={localVars.margine_percentuale_installazione} onChange={(e) => handleChange('margine_percentuale_installazione', e.target.value)} className="w-full bg-white text-slate-900 border p-2 rounded"/>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50 sticky bottom-0">
          <button 
            onClick={handleSave}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold flex justify-center items-center gap-2 hover:bg-blue-700"
          >
            <Save size={20} /> Salva Modifiche
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;