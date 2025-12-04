import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, MessageCircle, LogOut } from 'lucide-react';

const API_URL = 'http://localhost:3000';

const MessengerApp = () => {
  const [screen, setScreen] = useState('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [currentPhone, setCurrentPhone] = useState(null);
  const [activeTab, setActiveTab] = useState('chats');
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // WebSocket connection using native WebSocket API
  useEffect(() => {
    if (sessionId && !wsRef.current) {
      const ws = new WebSocket('ws://localhost:3000');
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({ type: 'register', sessionId }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'newMessage') {
          if (selectedChat && (data.message.from === selectedChat || data.message.to === selectedChat)) {
            setMessages(prev => [...prev, data.message]);
          }
          loadChats();
        } else if (data.type === 'messageSent') {
          setMessages(prev => [...prev, data.message]);
          loadChats();
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };

      wsRef.current = ws;

      // Fallback: Poll for new messages every 2 seconds
      pollIntervalRef.current = setInterval(() => {
        if (selectedChat) {
          loadMessages(selectedChat, true);
        }
        loadChats();
      }, 2000);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCheckPhone = async () => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      
      const data = await res.json();
      
      if (data.registered) {
        setScreen('verify');
      } else {
        setError('Номер не зарегистрирован. Используйте +375000 или +375001');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  const handleVerifyCode = async () => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSessionId(data.sessionId);
        setCurrentPhone(data.phoneNumber);
        setScreen('messenger');
        loadChats();
      } else {
        setError(data.error || 'Неверный код');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }
  };

  const loadChats = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/api/chats?sessionId=${sessionId}`);
      const data = await res.json();
      setChats(data.chats || []);
    } catch (err) {
      console.error('Ошибка загрузки чатов:', err);
    }
  };

  const loadMessages = async (phone, silent = false) => {
    try {
      const res = await fetch(`${API_URL}/api/messages?sessionId=${sessionId}&withPhone=${phone}`);
      const data = await res.json();
      if (!silent) {
        setMessages(data.messages || []);
        setSelectedChat(phone);
      } else {
        // Silent update - only add new messages
        const currentIds = new Set(messages.map(m => m.id));
        const newMessages = (data.messages || []).filter(m => !currentIds.has(m.id));
        if (newMessages.length > 0) {
          setMessages(prev => [...prev, ...newMessages]);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки сообщений:', err);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;

    try {
      // Try WebSocket first
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'sendMessage',
          to: selectedChat,
          text: messageText,
          sessionId
        }));
      } else {
        // Fallback to HTTP POST
        const message = {
          id: `msg_${Date.now()}_${Math.random()}`,
          from: currentPhone,
          to: selectedChat,
          text: messageText,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, message]);
        loadChats();
      }
      
      setMessageText('');
    } catch (err) {
      console.error('Ошибка отправки сообщения:', err);
    }
  };

  const logout = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setSessionId(null);
    setCurrentPhone(null);
    setScreen('login');
    setPhoneNumber('');
    setCode('');
    setChats([]);
    setMessages([]);
    setSelectedChat(null);
  };

  // Login Screen
  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <MessageCircle className="w-16 h-16 mx-auto text-blue-500 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">Мессенджер</h1>
            <p className="text-gray-500 mt-2">Войдите в свой аккаунт</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Номер телефона
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+375000 или +375001"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleCheckPhone()}
              />
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <button
              onClick={handleCheckPhone}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              Продолжить
            </button>
            
            <div className="text-center text-sm text-gray-500 mt-4">
              Тестовые номера: +375000, +375001
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Verify Screen
  if (screen === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800">Введите код</h2>
            <p className="text-gray-500 mt-2">
              Код отправлен на номер {phoneNumber}
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Введите код"
                maxLength="5"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleVerifyCode()}
              />
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <button
              onClick={handleVerifyCode}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              Подтвердить
            </button>
            
            <button
              onClick={() => setScreen('login')}
              className="w-full text-gray-600 py-2 text-sm hover:text-gray-800"
            >
              Назад
            </button>
            
            <div className="text-center text-sm text-gray-500 mt-4">
              Код: 11111
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Messenger Screen
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-blue-500" />
          <span className="font-semibold text-gray-800">Мессенджер</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{currentPhone}</span>
          <button
            onClick={logout}
            className="text-gray-600 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r flex flex-col">
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-3 px-4 font-medium ${
                activeTab === 'chats'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-600'
              }`}
            >
              Чаты
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-3 px-4 font-medium ${
                activeTab === 'settings'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-600'
              }`}
            >
              Настройки
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'chats' ? (
              <div>
                {chats.map((chat) => (
                  <div
                    key={chat.phoneNumber}
                    onClick={() => loadMessages(chat.phoneNumber)}
                    className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 ${
                      selectedChat === chat.phoneNumber ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {chat.phoneNumber.slice(-3)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800">
                          {chat.phoneNumber}
                        </div>
                        {chat.lastMessage && (
                          <div className="text-sm text-gray-500 truncate">
                            {chat.lastMessage.text}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2">Аккаунт</h3>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Номер телефона:</p>
                      <p className="font-medium text-gray-800">{currentPhone}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2">О приложении</h3>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                      <p>Версия: 1.0.0</p>
                      <p className="mt-1">Простой мессенджер для обмена сообщениями</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="bg-white px-6 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedChat.slice(-3)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">{selectedChat}</div>
                    <div className="text-xs text-green-500">в сети</div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg) => {
                  const isOwn = msg.from === currentPhone;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'bg-blue-500 text-white rounded-br-sm'
                            : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
                        }`}
                      >
                        <p>{msg.text}</p>
                        <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="bg-white px-6 py-4 shadow-lg">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Введите сообщение..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={sendMessage}
                    className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Выберите чат для начала общения</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessengerApp;