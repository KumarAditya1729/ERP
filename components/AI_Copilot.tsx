'use client';
import { useState, useRef, useEffect } from 'react';

// For MVP, we simulate typing out a Gemini/OpenAI response
const simulateTyping = (text: string, callback: (str: string) => void, onComplete: () => void) => {
  let i = 0;
  const interval = setInterval(() => {
    callback(text.substring(0, i));
    i++;
    if (i > text.length) {
      clearInterval(interval);
      onComplete();
    }
  }, 20); // typing speed
};

export default function AICopilot({ role = 'admin' }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'ai', content: string}[]>([
    { role: 'ai', content: `Hi! I'm NexBot, your AI Assistant. How can I help you manage the school today?` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentTyping, setCurrentTyping] = useState('');
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTyping, open]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsTyping(true);

    // AI Mock Logic based on keywords
    let responseText = "I can help with that. Since this is an MVP demonstration, my backend API is mocked. But I'm ready to integrate with Gemini or GPT-4 for full data-driven insights!";
    
    const lower = userMessage.toLowerCase();
    if (lower.includes('fee') || lower.includes('revenue')) {
       responseText = "Based on current fee collections, there is ₹2.5L pending from 34 students in Class 10. Would you like me to draft an SMS reminder to their parents and queue it for approval?";
    } else if (lower.includes('attendance') || lower.includes('absent')) {
       responseText = "Today's attendance is at 94.2%. However, 12 students are consecutively absent for the past 3 days. Our predictive model flags 3 of them as 'high dropout risk'. Do you want the list?";
    } else if (role === 'parent' && lower.includes('bus')) {
       responseText = "The school bus DL-1P-4452 is currently stuck in traffic near Green Park. The revised ETA to your stop is 03:45 PM (15 mins late).";
    }

    setTimeout(() => {
       simulateTyping(responseText, setCurrentTyping, () => {
          setMessages(prev => [...prev, { role: 'ai', content: responseText }]);
          setIsTyping(false);
          setCurrentTyping('');
       });
    }, 600);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 z-50 ${open ? 'bg-slate-800 rotate-90' : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:scale-110 glow-violet'}`}
      >
        {open ? (
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative">
             <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
             <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full" />
             <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
             </svg>
          </div>
        )}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-28 right-6 w-[360px] h-[550px] bg-[#0c1222]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 flex flex-col overflow-hidden animate-slide-up">
          
          {/* AI Header */}
          <div className="p-4 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border-b border-white/10 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center p-2 shadow-lg shadow-violet-500/20">
                <svg className="text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
             </div>
             <div>
               <h3 className="text-white font-bold text-sm">NexSchool AI Copilot</h3>
               <p className="text-[10px] text-violet-300">Powered by Advanced LLM</p>
             </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm pb-10">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] p-3 rounded-2xl ${
                   m.role === 'user' 
                     ? 'bg-violet-600 text-white rounded-br-sm shadow-md' 
                     : 'bg-white/[0.05] border border-white/[0.08] text-slate-200 rounded-bl-sm'
                 }`}>
                   <p className="leading-relaxed">{m.content}</p>
                 </div>
              </div>
            ))}
            
            {/* Live Typing Effect */}
            {isTyping && (
              <div className="flex justify-start">
                 <div className="max-w-[85%] p-3 rounded-2xl bg-white/[0.05] border border-violet-500/30 text-slate-200 rounded-bl-sm">
                   <p className="leading-relaxed whitespace-pre-wrap">{currentTyping}<span className="inline-block w-1.5 h-3.5 ml-1 bg-violet-400 animate-pulse align-middle" /></p>
                 </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-white/10 bg-[#080c1a]">
            <div className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask NexBot anything..."
                className="w-full bg-white/[0.03] border border-white/[0.08] text-sm text-white rounded-full py-3 pl-4 pr-12 focus:outline-none focus:border-violet-500 focus:bg-white/[0.06] transition-all"
              />
              <button 
                onClick={handleSend}
                className={`absolute right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${input.trim() ? 'bg-violet-600 text-white' : 'bg-white/10 text-slate-500 pointer-events-none'}`}
              >
                <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-center text-[9px] text-slate-500 mt-2">AI can make mistakes. Verify important data.</p>
          </div>

        </div>
      )}
    </>
  );
}
