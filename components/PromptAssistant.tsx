import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { UploadedImage } from '../types';
import { chatWithAssistant, ChatMessage } from '../services/geminiService';

interface PromptAssistantProps {
  onApplyPrompt: (prompt: string) => void;
  // onClose removed as per requirement
}

// OPTIMIZATION: Wrap với React.memo để tránh re-render khi props không đổi
export const PromptAssistant: React.FC<PromptAssistantProps> = memo(({ onApplyPrompt }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Xin chào! Hãy dán (Ctrl+V) hoặc kéo thả ảnh vào đây. Tôi sẽ giúp bạn phân tích và viết Prompt tiếng Việt chi tiết.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Pending Image State (Draft)
  const [pendingImage, setPendingImage] = useState<UploadedImage | null>(null);

  // Editing State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (editingIndex === null) {
      scrollToBottom();
    }
  }, [messages, editingIndex]);

  // Handle Global Paste (Only when this component is active/focused, handled via wrapper)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items) as DataTransferItem[]) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processFile(file);
        return; // Process only the first image found
      }
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPendingImage({
        id: Date.now().toString(),
        base64: base64.split(',')[1],
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        processFile(file);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !pendingImage) return;

    // Capture current state for the message
    const msgText = inputText;
    const msgImage = pendingImage;

    // Reset input state immediately
    setInputText('');
    setPendingImage(null);
    setIsLoading(true);

    const newUserMsg: ChatMessage = { role: 'user', text: msgText, image: msgImage || undefined };
    const newHistory = [...messages, newUserMsg];
    setMessages(newHistory);

    try {
      const responseText = await chatWithAssistant(newHistory, msgText, msgImage || undefined);
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Lỗi kết nối AI. Vui lòng thử lại." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = (index: number, text: string) => {
    setEditingIndex(index);
    setEditText(text);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const saveEdit = async () => {
    if (editingIndex === null) return;

    // Truncate history up to the edited message (exclusive)
    const truncatedHistory = messages.slice(0, editingIndex);

    // Create new message with the edited text
    const originalMsg = messages[editingIndex];
    const newMsg: ChatMessage = { ...originalMsg, text: editText };

    // Update state to show loading immediately
    const newHistory = [...truncatedHistory, newMsg];
    setMessages(newHistory);
    setEditingIndex(null);
    setEditText('');
    setIsLoading(true);

    try {
      // We need to regenerate the response based on the new history
      const responseText = await chatWithAssistant(truncatedHistory, editText, originalMsg.image);
      setMessages([...newHistory, { role: 'model', text: responseText }]);
    } catch (error) {
      setMessages([...newHistory, { role: 'model', text: "Lỗi kết nối AI. Vui lòng thử lại." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractPrompt = (text: string): string => {
    const match = text.match(/Prompt:\s*"([^"]+)"/i) || text.match(/"([^"]+)"/);
    return match ? match[1] : text;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-slate-900/50" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-500/20 text-brand-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-bold text-white">AI Prompt Assistant</h3>
        </div>
      </div>

      {/* Messages Area - Scrollable - Must have flex-1 and min-h-0 to work properly */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent" style={{ flex: '1 1 0%', overflowY: 'auto' }}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
            <div
              className={`relative max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-none'
                : 'bg-slate-800 text-slate-200 rounded-bl-none border border-white/5'
                }`}
            >
              {/* Edit Button for User */}
              {msg.role === 'user' && (
                <button
                  onClick={() => handleEditMessage(idx, msg.text)}
                  className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-brand-400 hover:bg-slate-700"
                  title="Edit message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              )}

              {msg.image && (
                <img src={`data:${msg.image.mimeType};base64,${msg.image.base64}`} alt="Uploaded" className="mb-2 rounded-lg max-h-32 object-cover border border-white/10" />
              )}
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Action Buttons for Model */}
              {msg.role === 'model' && (
                <div className="mt-2 flex gap-2 border-t border-white/10 pt-2">
                  <button
                    onClick={() => onApplyPrompt(extractPrompt(msg.text))}
                    className="flex-1 rounded bg-white/10 py-1.5 text-xs font-medium hover:bg-white/20 transition flex items-center justify-center gap-1"
                  >
                    Use Prompt
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(msg.text)}
                    className="rounded bg-white/10 px-2 py-1.5 text-xs font-medium hover:bg-white/20 transition"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-none p-4 border border-white/5">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce delay-100"></div>
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at Bottom - Always visible */}
      <div className="p-4 border-t border-white/10 bg-slate-900/80 backdrop-blur-md shrink-0 z-10" style={{ flexShrink: 0 }}>
        {/* Edit Mode UI */}
        {editingIndex !== null ? (
          <div className="flex flex-col gap-2 animate-slide-up">
            <div className="flex justify-between items-center text-xs text-brand-400 font-bold uppercase tracking-wider">
              <span>Editing Message</span>
              <button onClick={cancelEdit} className="text-slate-500 hover:text-white">Cancel</button>
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded-xl bg-slate-800 border border-brand-500/50 p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none h-20"
              autoFocus
            />
            <button
              onClick={saveEdit}
              disabled={!editText.trim() || isLoading}
              className="w-full rounded-xl bg-brand-600 py-2 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition shadow-lg shadow-brand-500/20"
            >
              Save & Regenerate
            </button>
          </div>
        ) : (
          /* Normal Input UI */
          <div className="relative">
            {pendingImage && (
              <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 rounded-xl border border-white/10 shadow-xl animate-fade-in">
                <div className="relative">
                  <img src={`data:${pendingImage.mimeType};base64,${pendingImage.base64}`} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            )}

            <div className="relative flex items-end gap-2 bg-slate-800/50 p-2 rounded-2xl border border-white/10 focus-within:border-brand-500/50 focus-within:bg-slate-800 transition-all">
              <button
                onClick={() => document.getElementById('assistant-image-upload')?.click()}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition shrink-0"
                title="Upload Image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <input
                type="file"
                id="assistant-image-upload"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                onPaste={handlePaste}
                placeholder="Nhập tin nhắn..."
                className="w-full bg-transparent border-none text-white placeholder-slate-500 focus:ring-0 resize-none py-2.5 max-h-32 min-h-[44px] text-sm"
                rows={1}
                style={{ height: 'auto', minHeight: '44px' }}
              />

              <button
                onClick={sendMessage}
                disabled={(!inputText.trim() && !pendingImage) || isLoading}
                className="p-2 bg-brand-600 text-white rounded-xl hover:bg-brand-500 disabled:opacity-50 disabled:hover:bg-brand-600 transition shadow-lg shadow-brand-500/20 shrink-0 mb-0.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Display name for debugging
PromptAssistant.displayName = 'PromptAssistant';
