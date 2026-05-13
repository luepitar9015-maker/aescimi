import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';

export default function AIChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', content: '¡Hola! Soy tu asistente de inteligencia artificial para gestión documental. ¿En qué puedo ayudarte hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      // Enviar historial completo (menos el mensaje actual)
      const history = messages; 
      
      const res = await axios.post('/api/ai/chat', {
        message: userMessage,
        history: history
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessages(prev => [...prev, { role: 'model', content: res.data.reply }]);
    } catch (error) {
      console.error('Error in chat:', error);
      const serverErrorMsg = error.response?.data?.error || 'Hubo un error de conexión con la IA. Asegúrate de tener la clave API configurada.';
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: `❌ Error: ${serverErrorMsg}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#39A900',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(57,169,0,0.4)',
            cursor: 'pointer',
            zIndex: 9999,
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageCircle size={28} />
        </button>
      )}

      {/* Ventana de Chat */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '350px',
          height: '500px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          overflow: 'hidden',
          border: '1px solid #e5e7eb'
        }}>
          {/* Header */}
          <div style={{
            background: '#39A900',
            color: 'white',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={20} />
              <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Asistente SENA IA</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Mensajes */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#f9fafb'
          }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}>
                {msg.role === 'model' && (
                  <div style={{ background: '#dcfce7', color: '#166534', padding: '6px', borderRadius: '50%' }}>
                    <Bot size={14} />
                  </div>
                )}
                
                <div style={{
                  background: msg.role === 'user' ? '#39A900' : 'white',
                  color: msg.role === 'user' ? 'white' : '#374151',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 0 14px' : '14px 14px 14px 0',
                  fontSize: '13px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  border: msg.role === 'user' ? 'none' : '1px solid #e5e7eb',
                  lineHeight: '1.4'
                }}>
                  {msg.content}
                </div>

                {msg.role === 'user' && (
                  <div style={{ background: '#e5e7eb', color: '#4b5563', padding: '6px', borderRadius: '50%' }}>
                    <User size={14} />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start' }}>
                 <div style={{ background: '#dcfce7', color: '#166534', padding: '6px', borderRadius: '50%' }}>
                    <Bot size={14} />
                 </div>
                 <div style={{ padding: '10px', fontSize: '12px', color: '#9ca3af' }}>
                   Escribiendo...
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{
            padding: '12px',
            borderTop: '1px solid #e5e7eb',
            background: 'white',
            display: 'flex',
            gap: '8px'
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Haz tu pregunta..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '99px',
                outline: 'none',
                fontSize: '13px'
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                background: input.trim() && !isLoading ? '#39A900' : '#e5e7eb',
                color: input.trim() && !isLoading ? 'white' : '#9ca3af',
                border: 'none',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s'
              }}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
