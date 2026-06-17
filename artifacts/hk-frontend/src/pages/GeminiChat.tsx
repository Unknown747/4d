import { useState, useRef, useEffect } from 'react';
import { fetchApi } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface ValidateResult {
  angka: string;
  result: {
    score: number;
    status: string;
    reason: string;
    suggestion: string;
  };
}

const QUICK_BUTTONS = [
  { label: '🔥 Prediksi 2D Hari Ini', text: 'Berikan prediksi 2D terbaik untuk draw hari ini berdasarkan data terbaru.' },
  { label: '📊 Analisis Data', text: 'Analisis pola dan tren dari data draw terakhir. Apa yang menarik perhatianmu?' },
  { label: '🧊 Angka Cold', text: 'Angka 2D apa saja yang paling lama tidak muncul (overdue)? Apakah layak dipasang?' },
  { label: '💡 Tips Togel', text: 'Berikan tips dan strategi terbaik untuk memprediksi togel HK berdasarkan analisis statistik.' },
  { label: '🐉 Shio Terbaik', text: 'Shio apa yang paling berpotensi keluar berdasarkan data terakhir?' },
];

export default function GeminiChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Halo! Saya HK Pro AI, asisten prediksi togel HK 4D. Saya dapat membantu analisis data, prediksi angka, dan menjawab pertanyaan seputar togel HK. Apa yang ingin Anda ketahui? 🎰',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Validate state
  const [validateAngka, setValidateAngka] = useState('');
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [validateLoading, setValidateLoading] = useState(false);
  const [validateError, setValidateError] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, text: m.text }));
      const data = await fetchApi<{ reply: string; timestamp: string }>('/gemini/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, history }),
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply,
        timestamp: data.timestamp,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `⚠️ Maaf, terjadi error: ${String(e)}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate() {
    if (!validateAngka.trim() || !/^\d{2,4}$/.test(validateAngka)) {
      setValidateError('Masukkan angka 2-4 digit');
      return;
    }
    setValidateLoading(true);
    setValidateError('');
    setValidateResult(null);
    try {
      const result = await fetchApi<ValidateResult>('/gemini/validate', {
        method: 'POST',
        body: JSON.stringify({ angka: validateAngka }),
      });
      setValidateResult(result);
    } catch (e) {
      setValidateError(String(e));
    } finally {
      setValidateLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    KUAT: 'text-green-400 border-green-600 bg-green-900/20',
    SEDANG: 'text-amber-400 border-amber-600 bg-amber-900/20',
    LEMAH: 'text-red-400 border-red-600 bg-red-900/20',
  };

  return (
    <div className="space-y-4">
      {/* Validate Panel */}
      <div className="card">
        <div className="card-header">✅ Validasi Angka dengan AI</div>
        <div className="flex gap-2">
          <input
            type="number"
            value={validateAngka}
            onChange={e => setValidateAngka(e.target.value.slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && handleValidate()}
            placeholder="Masukkan 2-4 digit angka"
            className="flex-1 bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 font-mono"
          />
          <button onClick={handleValidate} disabled={validateLoading}
            className="btn-primary">
            {validateLoading ? <span className="spinner !w-4 !h-4" /> : '✅ Validasi'}
          </button>
        </div>

        {validateError && (
          <div className="mt-3 text-red-400 text-sm">{validateError}</div>
        )}

        {validateResult && (
          <div className={`mt-3 p-4 rounded-xl border ${statusColor[validateResult.result.status] ?? statusColor['SEDANG']}`}>
            <div className="flex items-center gap-3">
              <div className="font-black text-3xl font-mono">{validateResult.angka}</div>
              <div>
                <div className="font-bold text-base">{validateResult.result.status}</div>
                <div className="text-xs opacity-70">Score: {validateResult.result.score}/100</div>
              </div>
            </div>
            <div className="mt-2 text-sm opacity-90">{validateResult.result.reason}</div>
            {validateResult.result.suggestion && (
              <div className="mt-1 text-xs opacity-70 italic">{validateResult.result.suggestion}</div>
            )}
            {/* Score bar */}
            <div className="mt-3 h-2 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${validateResult.result.score}%`, background: 'currentColor', opacity: 0.7 }} />
            </div>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <div className="card flex flex-col" style={{ minHeight: '500px' }}>
        <div className="card-header">🤖 Chat dengan HK Pro AI</div>

        {/* Quick buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_BUTTONS.map(btn => (
            <button
              key={btn.label}
              onClick={() => sendMessage(btn.text)}
              disabled={loading}
              className="btn-ghost text-xs py-1.5 disabled:opacity-40"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1" style={{ maxHeight: '400px' }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-100 rounded-tr-sm'
                  : 'bg-[#1a2235] border border-[#1e2d45] text-slate-200 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="text-xs text-violet-400 font-bold mb-1">🤖 HK Pro AI</div>
                )}
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div className="text-[10px] opacity-40 mt-1 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#1a2235] border border-[#1e2d45] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="text-xs text-violet-400 font-bold mb-1">🤖 HK Pro AI</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 mt-auto pt-4 border-t border-[#1e2d45]">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Tanya tentang prediksi, analisis data, strategi..."
            disabled={loading}
            className="flex-1 bg-[#1a2235] border border-[#1e2d45] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="btn-primary px-4"
          >
            {loading ? <span className="spinner !w-4 !h-4" /> : '➤'}
          </button>
        </div>

        {/* Clear chat */}
        <button
          onClick={() => setMessages([{
            role: 'assistant',
            text: 'Chat dikosongkan. Saya siap membantu lagi! 🎰',
            timestamp: new Date().toISOString(),
          }])}
          className="text-xs text-slate-600 hover:text-slate-400 mt-2 self-end transition-colors"
        >
          Kosongkan chat
        </button>
      </div>
    </div>
  );
}
