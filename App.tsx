
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Trash2, 
  History, 
  Copy, 
  Check, 
  Settings,
  Info,
  Languages,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import { AppStatus, LanguageInfo, Message } from './types';
import { detectLanguage, LANGUAGES } from './utils/languageDetector';

// Helper functions for Audio Processing
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [detectedLang, setDetectedLang] = useState<LanguageInfo>(LANGUAGES[LANGUAGES.length - 1]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onstart = () => {
        setStatus('listening');
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setText(prev => (prev.endsWith(' ') || prev === '' ? prev : prev + ' ') + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setError('Microphone permission denied.');
        } else if (event.error !== 'no-speech') {
          setError(`Microphone error: ${event.error}`);
        }
        setStatus('idle');
      };

      recognition.onend = () => {
        if (status === 'listening') setStatus('idle');
      };

      recognitionRef.current = recognition;
    } else {
      setError('Speech Recognition is not supported in this browser.');
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (currentSourceRef.current) currentSourceRef.current.stop();
    };
  }, [status]);

  useEffect(() => {
    const lang = detectLanguage(text);
    setDetectedLang(lang);
  }, [text]);

  const toggleListening = useCallback(() => {
    if (status === 'listening') {
      recognitionRef.current?.stop();
      setStatus('idle');
    } else {
      setError(null);
      if (recognitionRef.current) {
        recognitionRef.current.lang = detectedLang.code;
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [status, detectedLang]);

  const stopSpeaking = () => {
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    setStatus('idle');
  };

  const handleSpeak = async () => {
    if (!text.trim()) return;

    if (status === 'speaking') {
      stopSpeaking();
      return;
    }

    setStatus('speaking');
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Determine voice based on detected language
      // Using 'Kore' as a balanced voice for most languages, 'Puck' as an alternative
      const voiceName = detectedLang.code === 'en-US' ? 'Zephyr' : 'Kore';

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak this clearly in ${detectedLang.name}: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!base64Audio) {
        throw new Error("AI failed to generate audio.");
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioBuffer = await decodeAudioData(
        decodeBase64(base64Audio),
        audioContextRef.current,
        24000,
        1,
      );

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setStatus('idle');
        currentSourceRef.current = null;
        // Add to history
        setHistory(prev => [{
          id: Date.now().toString(),
          text,
          type: 'user',
          lang: detectedLang,
          timestamp: Date.now()
        }, ...prev.slice(0, 9)]);
      };

      currentSourceRef.current = source;
      source.start();

    } catch (err: any) {
      console.error("Gemini TTS Error:", err);
      setError("AI Speech failed. Please check your connection.");
      setStatus('idle');
    }
  };

  const clearText = () => {
    setText('');
    setError(null);
    if (status === 'speaking') stopSpeaking();
    if (status === 'listening') recognitionRef.current?.stop();
    setStatus('idle');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white selection:bg-indigo-500/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 md:py-16">
        <header className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>Premium Voice Engine Active</span> 
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            PolyVoice
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
            Native-quality speech synthesis for {LANGUAGES.length} languages.
          </p>
        </header>

        <main className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all duration-300 ${
                  status === 'idle' ? 'bg-slate-700/50 text-slate-300' :
                  status === 'listening' ? 'bg-red-500/20 text-red-400' :
                  status === 'speaking' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700'
                }`}>
                  {status === 'listening' && <div className="listening-indicator" />}
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {status === 'idle' ? 'Ready' : 
                     status === 'listening' ? 'Listening' : 
                     status === 'speaking' ? 'AI Speaking' : 'Processing'}
                  </span>
                </div>
                
                <div className="h-4 w-[1px] bg-slate-700" />

                <div className="flex items-center gap-2 text-indigo-400">
                  <span className="text-xs font-bold uppercase tracking-wider bg-indigo-500/10 px-2 py-1 rounded">
                    {detectedLang.name}
                  </span>
                  <span className="text-xs text-slate-500 font-medium hidden sm:inline">({detectedLang.nativeName})</span>
                </div>
              </div>

              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <History className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Start typing or speak..."
                  className="w-full h-48 md:h-64 bg-transparent text-xl md:text-3xl text-white placeholder-slate-700 focus:outline-none resize-none leading-relaxed"
                />
                
                <div className="absolute bottom-0 right-0 flex gap-2 p-2">
                  <button 
                    onClick={copyToClipboard}
                    className="p-3 bg-slate-700/80 hover:bg-slate-600 rounded-xl text-slate-300 transition-all backdrop-blur"
                  >
                    {isCopied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={clearText}
                    className="p-3 bg-slate-700/80 hover:bg-red-500/80 rounded-xl text-slate-300 transition-all backdrop-blur"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900/50 flex flex-col md:flex-row gap-4">
              <button
                onClick={toggleListening}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all transform active:scale-[0.98] ${
                  status === 'listening' 
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg' 
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                {status === 'listening' ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6 text-indigo-400" />}
                <span>{status === 'listening' ? 'Stop Listening' : 'Start Microphone'}</span>
              </button>

              <button
                onClick={handleSpeak}
                disabled={!text.trim()}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all transform active:scale-[0.98] disabled:opacity-50 ${
                  status === 'speaking'
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                }`}
              >
                {status === 'speaking' ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                <span>{status === 'speaking' ? 'Stop Audio' : `Speak in ${detectedLang.name}`}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 animate-in fade-in zoom-in duration-300">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-400" />
                How it works
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                When you enter text in <span className="text-indigo-300">Telugu</span>, our engine automatically detects the script and routes the request to Gemini's neural voice models for high-fidelity playback.
              </p>
            </div>

            <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Languages className="w-5 h-5 text-purple-400" />
                Featured Languages
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Telugu', 'Hindi', 'Tamil', 'Arabic', 'Japanese', 'Chinese'].map(lang => (
                  <span key={lang} className="px-2 py-1 rounded-md bg-slate-700/50 text-xs text-slate-300 font-medium">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </main>

        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
            <div className="relative bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">Recent History</h2>
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white text-2xl">
                  &times;
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto p-4 space-y-3">
                {history.map(item => (
                  <div key={item.id} className="p-3 bg-slate-700/30 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">{item.lang.name}</span>
                      <span className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-2">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
