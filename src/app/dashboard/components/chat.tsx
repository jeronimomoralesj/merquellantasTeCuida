import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, AlertCircle } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../../firebase'; // Adjust path as needed

export default function GeminiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
const [, setMood] = useState<string|null>(null);
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const maxChars = 120;
  const maxWords = 2000; // Maximum word limit for the entire conversation

  // Calculate word count for a string
const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  // Calculate total word count in the conversation
const calculateTotalWordCount = (messageList: Array<{role: string, content: string}>) => {    return messageList.reduce((total, msg) => {
      if (msg.role !== 'system') {
        return total + countWords(msg.content);
      }
      return total;
    }, 0);
  };

  // Check if mood needs to be asked (older than today)
const shouldAskMood = (lastMoodDate: {toDate: () => Date} | null) => {
    if (!lastMoodDate) return true;
    
    const today = new Date();
    const lastDate = lastMoodDate.toDate();
    
    // Check if it's a different day
    return today.toDateString() !== lastDate.toDateString();
  };

  // Get user data and check mood status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserName('');
        setUserId(null);
        return;
      }

      setUserId(user.uid);

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserName(userData.nombre || 'Usuario');

          // Check if we need to show mood selector
          const moodData = userData.mood;
          if (moodData && moodData.date && !shouldAskMood(moodData.date)) {
            // Mood was set today, don't show selector
            setShowMoodSelector(false);
            setMood(moodData.mood);
          } else {
            // Need to ask for mood
            setShowMoodSelector(true);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUserName('Usuario');
      }
    });

    return () => unsubscribe();
}, [setMood]);

  // Load messages from memory storage on mount (removed localStorage)
  useEffect(() => {
    // Initialize with empty state since we can't use localStorage
    setMessages([]);
    setWordCount(0);
    setLimitReached(false);
  }, []);

  // Update word count when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const newWordCount = calculateTotalWordCount(messages);
      setWordCount(newWordCount);
      setLimitReached(newWordCount >= maxWords);
    }
}, [messages, calculateTotalWordCount]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current && !showMoodSelector) {
      inputRef.current.focus();
    }
  }, [isOpen, showMoodSelector]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Store mood in Firebase
  const storeMoodInFirebase = async (selectedMood) => {
    if (!userId) return;

    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        mood: {
          mood: selectedMood,
          date: Timestamp.now()
        }
      }, { merge: true });
    } catch (error) {
      console.error('Error storing mood in Firebase:', error);
    }
  };

const selectMood = async (selectedMood: string) => {
    setMood(selectedMood);
    setShowMoodSelector(false);
    setLoading(true);

    // Store mood in Firebase
    await storeMoodInFirebase(selectedMood);
  
    // Add initial system message
    const initialMessage = {
      role: 'system',
      content: `Hola ${userName}, cuéntame como te sientes el dia de hoy`
    };
  
    // Add user's mood response
    const moodResponse = {
      role: 'user',
      content: `Me siento un poco ${selectedMood}`
    };
  
    // Add these messages to the chat
    setMessages([initialMessage, moodResponse]);
  
    try {
      // Send the initial request to Gemini via our API route
      const systemPrompt = {
        role: 'system',
        content: `El usuario ${userName} se siente en un mood ${selectedMood}. Por favor acompañalo y hazlo una pregunta amigable para guiarlo a estar mas feliz siempre! hazlo corto pero no seco. y Recuerda estas siendo un chatbot para los trabajadores de la empresa Merquellantas la mejor empresa de llantas en Colombia!`
      };
      
      const response = await fetchGeminiResponse([systemPrompt, moodResponse]);
      
      // Add Gemini's response to the chat
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('Error fetching from Gemini:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Lo siento, tuve problemas conectando. Por favor intenta de nuevo más tarde.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Updated fetchGeminiResponse function
const fetchGeminiResponse = async (messageHistory: Array<{role: string, content: string}>) => {
    try {
      console.log('Sending messages to API:', messageHistory);
      
      // Add conversation length constraint to the system message
      const remainingWords = maxWords - wordCount;
      const systemMessage = {
        role: 'system',
        content: `Please keep your response concise. The conversation has a ${maxWords} word limit and has already used ${wordCount} words. You have roughly ${remainingWords} words remaining for your response.`
      };
      
      const augmentedHistory = [systemMessage, ...messageHistory];
      
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: augmentedHistory })
      });
  
      const data = await response.json();
      
      if (!response.ok) {
        console.error('API error response:', data);
        throw new Error(data.error || 'API request failed');
      }
  
      return data.message;
    } catch (error) {
      console.error('Error calling API:', error);
      throw error;
    }
  };
  
  // The handleSendMessage function with word limit check
  const handleSendMessage = async () => {
    if (!input.trim() || loading || limitReached) return;
    
    const userMessage = { role: 'user', content: input };
    
    // Check if adding this message would exceed the word limit
    const newWordCount = wordCount + countWords(input);
    if (newWordCount >= maxWords) {
      setLimitReached(true);
    }
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
  
    try {
      // Format all previous messages for context
      const messageHistory = messages.concat(userMessage);
      
      console.log('Mandando:', messageHistory);
      const response = await fetchGeminiResponse(messageHistory);
      
      // Add assistant's response
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      
      // Check if the conversation is now over the limit
      const finalWordCount = calculateTotalWordCount([...messageHistory, { role: 'assistant', content: response }]);
      if (finalWordCount >= maxWords) {
        setLimitReached(true);
      }
    } catch (error) {
      console.error('Error fetching from Gemini:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Lo siento, tuve problemas conectando. Error: ${error.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Button */}
      <button
        onClick={toggleChat}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-[#f90] text-white shadow-lg hover:bg-[#e80] transition-all duration-300"
        aria-label="Toggle chat"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Container */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-80 sm:w-96 h-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Chat Header */}
          <div className="p-4 bg-[#f90] text-white flex justify-between items-center">
            <div>
              <h3 className="font-bold">Chat Bienestar</h3>
              <div className="text-xs mt-1">
                Palabras: {wordCount}/{maxWords}
              </div>
            </div>
            <div className="flex items-center">
              <button 
                onClick={toggleChat} 
                className="text-white hover:text-gray-200"
                aria-label="Close chat"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Mood Selector */}
          {showMoodSelector ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
              <p className="text-center mb-8 text-gray-700">
                Hola {userName || 'Usuario'}, por favor cuentanos como te sientes el dia de hoy
              </p>
              <div className="flex justify-center space-x-8">
                <button 
                  onClick={() => selectMood('feliz')}
                  className="flex flex-col items-center hover:scale-110 transition-transform"
                  aria-label="Happy mood"
                >
                  <div className="text-4xl mb-2">😊</div>
                  <span className="text-sm text-gray-600">Feliz</span>
                </button>
                <button 
                  onClick={() => selectMood('neutral')}
                  className="flex flex-col items-center hover:scale-110 transition-transform"
                  aria-label="Neutral mood"
                >
                  <div className="text-4xl mb-2">😐</div>
                  <span className="text-sm text-gray-600">Neutral</span>
                </button>
                <button 
                  onClick={() => selectMood('triste')}
                  className="flex flex-col items-center hover:scale-110 transition-transform"
                  aria-label="Sad mood"
                >
                  <div className="text-4xl mb-2">😢</div>
                  <span className="text-sm text-gray-600">Triste</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                {messages.map((message, index) => (
                  message.role !== 'system' && (
                    <div 
                      key={index} 
                      className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
                    >
                      <div 
                        className={`inline-block max-w-3/4 px-4 py-2 rounded-2xl ${
                          message.role === 'user' 
                            ? 'bg-[#f90] text-white rounded-br-none' 
                            : 'bg-gray-200 text-black rounded-bl-none'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  )
                ))}
                {loading && (
                  <div className="flex justify-start mb-4">
                    <div className="inline-block px-4 py-2 rounded-2xl bg-gray-200 text-black rounded-bl-none">
                      <Loader2 className="animate-spin" size={20} />
                    </div>
                  </div>
                )}
                
                {/* Word Limit Warning/Notice */}
                {limitReached && (
                  <div className="flex justify-center mb-4">
                    <div className="inline-block px-4 py-2 rounded-2xl bg-red-100 text-red-600 border border-red-200 flex items-center">
                      <AlertCircle size={16} className="mr-2" />
                      <span>Límite alcanzado ({maxWords} palabras)</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-gray-200 bg-white">
                <div className="flex items-center">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, maxChars))}
                    onKeyDown={handleKeyDown}
                    placeholder={limitReached ? "Límite de palabras alcanzado" : "Escribe tu mensaje..."}
                    className="text-black flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-[#f90] resize-none max-h-20"
                    rows={1}
                    maxLength={maxChars}
                    disabled={limitReached}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || loading || limitReached}
                    className={`ml-2 p-2 rounded-full ${
                      !input.trim() || loading || limitReached
                        ? 'bg-gray-300 text-gray-500' 
                        : 'bg-[#f90] text-white hover:bg-[#e80]'
                    } transition-colors`}
                    aria-label="Send message"
                  >
                    <Send size={20} />
                  </button>
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <div>
                    {wordCount >= maxWords * 0.8 && !limitReached && (
                      <span className="text-orange-500 flex items-center">
                        <AlertCircle size={12} className="mr-1" />
                        {maxWords - wordCount} palabras restantes
                      </span>
                    )}
                  </div>
                  <div>
                    {input.length}/{maxChars}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}