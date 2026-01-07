
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage, QuoteInputs, GlobalVariables, CalculationResult } from '../types';
import { getChatResponse } from '../services/aiService';

interface Props {
  inputs: QuoteInputs;
  vars: GlobalVariables;
  result: CalculationResult | null;
}

const Chatbot: React.FC<Props> = ({ inputs, vars, result }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Ciao! Sono l\'assistente OptiCost. Chiedimi pure spiegazioni sui calcoli o sulla logistica del preventivo corrente.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim() || !result || isTyping) return;

    const userMsg: ChatMessage = { role: 'user', text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Removed unused apiKey argument as it must be obtained from process.env.API_KEY exclusively
      const responseText = await getChatResponse([...messages, userMsg], { inputs, vars, result });
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: "Mi dispiace, si è verificato un errore durante la generazione della risposta." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* FAB Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 transition-all hover:scale-110 z-40 no-print"
      >
        <MessageCircle size={28} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[400px] max-w-[90vw] h-[600px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 no-print">
          <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">Assistente OptiCost</p>
                <p className="text-[10px] text-blue-300">Context-Aware AI</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Chiedi spiegazioni sul calcolo..."
              className="flex-1 bg-slate-100 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button 
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
