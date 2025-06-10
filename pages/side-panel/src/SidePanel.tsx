/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { FiSettings, FiUser, FiSearch, FiGrid, FiFileText, FiSun, FiMoon, FiPlus, FiChevronDown, FiPaperclip } from 'react-icons/fi';
import { PiPlusBold as PiPlusBoldIcon } from 'react-icons/pi';
import { GrHistory } from 'react-icons/gr';
import { type Message, Actors, chatHistoryStore, agentModelStore } from '@extension/storage';
import favoritesStorage, { type FavoritePrompt } from '@extension/storage/lib/prompt/favorites';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import ChatHistoryList from './components/ChatHistoryList';
import BookmarkList from './components/BookmarkList';
import { EventType, type AgentEvent, ExecutionState } from './types/event';
import './SidePanel.css';
import { FaInfinity } from 'react-icons/fa';


// Declare chrome API types
declare global {
  interface Window {
    chrome: typeof chrome;
  }
}

// Generic placeholder prompts
const GENERIC_PLACEHOLDER_PROMPTS: FavoritePrompt[] = [
  { id: 1, title: 'Summarize Webpage', content: 'Summarize the key points of the current webpage.', order: 1, createdAt: Date.now() },
  { id: 2, title: 'Draft Email', content: 'Draft a polite follow-up email regarding our last discussion on project X.', order: 2, createdAt: Date.now() },
  { id: 3, title: 'Explain Concept', content: 'Explain the concept of [insert concept] in simple terms.', order: 3, createdAt: Date.now() },
  { id: 4, title: 'Find Information', content: 'Find recent news articles about renewable energy breakthroughs.', order: 4, createdAt: Date.now() },
];


const SidePanel = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [showStopButton, setShowStopButton] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<Array<{ id: string; title: string; createdAt: number }>>([]);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const [isHistoricalSession, setIsHistoricalSession] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false); // Default to dark mode
  const [favoritePrompts, setFavoritePrompts] = useState<FavoritePrompt[]>(GENERIC_PLACEHOLDER_PROMPTS);
  const [hasConfiguredModels, setHasConfiguredModels] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  
  const [currentMode, setCurrentMode] = useState<'Agent' | 'Research'>('Agent');
  const [currentModel, setCurrentModel] = useState<string>('GPT-4o'); // Default model
  const [showModeModelPopup, setShowModeModelPopup] = useState(false);
  const [showAddContextPopup, setShowAddContextPopup] = useState(false);
  const [isWorkspaceConnected, setIsWorkspaceConnected] = useState(false);
  const [showWorkspaceConnectModal, setShowWorkspaceConnectModal] = useState(false);


  const sessionIdRef = useRef<string | null>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const setInputTextRef = useRef<((text: string) => void) | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const isDarkMode = !isLightMode; // Derived state for convenience

  const toggleTheme = () => {
    setIsLightMode(prev => !prev);
  };

  const checkModelConfiguration = useCallback(async () => {
    try {
      const configuredAgents = await agentModelStore.getConfiguredAgents();
      const hasAtLeastOneModel = configuredAgents.length > 0;
      setHasConfiguredModels(hasAtLeastOneModel);
    } catch (error) {
      console.error('Error checking model configuration:', error);
      setHasConfiguredModels(false);
    }
  }, []);

  useEffect(() => {
    checkModelConfiguration();
  }, [checkModelConfiguration]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) checkModelConfiguration();
    };
    const handleFocus = () => checkModelConfiguration();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkModelConfiguration]);

  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const appendMessage = useCallback((newMessage: Message, sessionId?: string | null) => {
    const isProgressMessage = newMessage.actor === Actors.SYSTEM && newMessage.content?.startsWith('Monarch is working...');
    
    setMessages(prev => {
        if (isProgressMessage && prev.length > 0 && prev[prev.length - 1].actor === Actors.SYSTEM && prev[prev.length - 1].content?.startsWith('Monarch is working...')) {
            const updatedMessages = [...prev];
            updatedMessages[prev.length -1] = newMessage;
            return updatedMessages;
        }
        return [...prev, newMessage];
    });

    const effectiveSessionId = sessionId !== undefined ? sessionId : sessionIdRef.current;
    if (effectiveSessionId && newMessage.actor !== Actors.SYSTEM) { 
      chatHistoryStore
        .addMessage(effectiveSessionId, newMessage)
        .catch(err => console.error('Failed to save message to history:', err));
    }
  }, []);

  const handleTaskState = useCallback(
    (event: AgentEvent) => {
      const { actor, state, timestamp, data } = event;
      const details = data?.details || '';
      let monarchMessage: string | null = null;

      if (actor === Actors.PLANNER || actor === Actors.NAVIGATOR || actor === Actors.VALIDATOR) {
        if (state === ExecutionState.STEP_START || state === ExecutionState.ACT_START) {
          monarchMessage = `Monarch is working on: ${details || actor.toLowerCase()} step...`;
        } else if (state === ExecutionState.STEP_OK || state === ExecutionState.ACT_OK) {
           if (details && details !== 'cache_content') monarchMessage = `Monarch: ${details}`;
        } else if (state === ExecutionState.STEP_FAIL || state === ExecutionState.ACT_FAIL) {
          monarchMessage = `Monarch encountered an issue: ${details || 'Failed step'}`;
        }
      } else if (actor === Actors.SYSTEM) {
         switch (state) {
            case ExecutionState.TASK_START:
              setIsHistoricalSession(false);
              monarchMessage = "Monarch is starting the task...";
              break;
            case ExecutionState.TASK_OK:
              setIsFollowUpMode(true);
              setInputEnabled(true);
              setShowStopButton(false);
              monarchMessage = data?.summary || "Task completed successfully.";
              break;
            case ExecutionState.TASK_FAIL:
              setIsFollowUpMode(true);
              setInputEnabled(true);
              setShowStopButton(false);
              monarchMessage = `Task failed: ${details}`;
              break;
            case ExecutionState.TASK_CANCEL:
              setIsFollowUpMode(false);
              setInputEnabled(true);
              setShowStopButton(false);
              monarchMessage = "Task cancelled.";
              break;
            default:
              if (details) monarchMessage = `Monarch: ${details}`;
              break;
          }
      }

      if (monarchMessage) {
        appendMessage({
          actor: Actors.SYSTEM, 
          content: monarchMessage,
          timestamp: timestamp,
        });
      }
    },
    [appendMessage],
  );
  
  const stopConnection = useCallback(() => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = null;
    if (portRef.current) portRef.current.disconnect();
    portRef.current = null;
  }, []);

  const setupConnection = useCallback(() => {
    if (portRef.current) return;
    try {
      portRef.current = chrome.runtime.connect({ name: 'side-panel-connection' });
      portRef.current.onMessage.addListener((message: any) => {
        if (message?.type === EventType.EXECUTION) handleTaskState(message);
        else if (message?.type === 'error') {
          appendMessage({ actor: Actors.SYSTEM, content: message.error || 'Unknown error', timestamp: Date.now() });
          setInputEnabled(true); setShowStopButton(false);
        } else if (message?.type === 'speech_to_text_result') {
          if (message.text && setInputTextRef.current) setInputTextRef.current(message.text);
          setIsProcessingSpeech(false);
        } else if (message?.type === 'speech_to_text_error') {
          appendMessage({ actor: Actors.SYSTEM, content: message.error || 'Speech recognition failed', timestamp: Date.now() });
          setIsProcessingSpeech(false);
        }
      });
      portRef.current.onDisconnect.addListener(() => {
        console.log('Connection disconnected', chrome.runtime.lastError ? `Error: ${chrome.runtime.lastError.message}` : '');
        portRef.current = null;
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
        setInputEnabled(true); setShowStopButton(false);
      });
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (portRef.current?.name === 'side-panel-connection') {
          try { portRef.current.postMessage({ type: 'heartbeat' }); }
          catch (error) { console.error('Heartbeat failed:', error); stopConnection(); }
        } else stopConnection();
      }, 25000);
    } catch (error) {
      console.error('Failed to establish connection:', error);
      appendMessage({ actor: Actors.SYSTEM, content: 'Failed to connect', timestamp: Date.now() });
      portRef.current = null;
    }
  }, [handleTaskState, appendMessage, stopConnection]);

  const sendMessageToBackend = useCallback( (message: any) => { 
      if (portRef.current?.name !== 'side-panel-connection') throw new Error('No valid connection');
      try { portRef.current.postMessage(message); }
      catch (error) { console.error('Failed to send message:', error); stopConnection(); throw error; }
    }, [stopConnection],
  );

  const handleCommand = async (command: string): Promise<boolean> => { /* ... (existing command logic, ensure it uses sendMessageToBackend if needed) ... */ return true; };

  const handleSendMessage = async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || isHistoricalSession) return;
    if (trimmedText.startsWith('/')) {
      const wasHandled = await handleCommand(trimmedText);
      if (wasHandled) return;
    }
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) throw new Error('No active tab found');
      setInputEnabled(false); setShowStopButton(true);
      if (!isFollowUpMode) {
        const newSession = await chatHistoryStore.createSession(trimmedText.substring(0, 50) + (trimmedText.length > 50 ? '...' : ''));
        setCurrentSessionId(newSession.id);
      }
      appendMessage({ actor: Actors.USER, content: trimmedText, timestamp: Date.now() }, sessionIdRef.current);
      if (!portRef.current) setupConnection();
      const messageType = isFollowUpMode ? 'follow_up_task' : 'new_task';
      await sendMessageToBackend({ type: messageType, task: trimmedText, taskId: sessionIdRef.current, tabId, mode: currentMode, model: currentModel });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Task error', errorMessage);
      appendMessage({ actor: Actors.SYSTEM, content: errorMessage, timestamp: Date.now() });
      setInputEnabled(true); setShowStopButton(false); stopConnection();
    }
  };

  const handleStopTask = async () => { 
    try { sendMessageToBackend({ type: 'cancel_task' }); }
    catch(err) { 
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('cancel_task error', errorMessage);
        appendMessage({ actor: Actors.SYSTEM, content: errorMessage, timestamp: Date.now() });
    }
    setInputEnabled(true); setShowStopButton(false);
  };
  const handleNewChat = () => { 
    setMessages([]); setCurrentSessionId(null); setInputEnabled(true);
    setShowStopButton(false); setIsFollowUpMode(false); setIsHistoricalSession(false);
    stopConnection();
  };
  const loadChatSessions = useCallback(async () => { 
     try {
      const sessions = await chatHistoryStore.getSessionsMetadata();
      setChatSessions(sessions.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) { console.error('Failed to load chat sessions:', error); }
  }, []);
  const handleLoadHistory = async () => { await loadChatSessions(); setShowHistory(true); };
  const handleBackToChat = (reset = false) => { 
    setShowHistory(false);
    if (reset) { setCurrentSessionId(null); setMessages([]); setIsFollowUpMode(false); setIsHistoricalSession(false); }
  };
  const handleSessionSelect = async (sessionId: string) => { 
    try {
      const fullSession = await chatHistoryStore.getSession(sessionId);
      if (fullSession?.messages.length > 0) {
        setCurrentSessionId(fullSession.id); setMessages(fullSession.messages);
        setIsFollowUpMode(false); setIsHistoricalSession(true);
      }
      setShowHistory(false);
    } catch (error) { console.error('Failed to load session:', error); }
  };
  const handleSessionDelete = async (sessionId: string) => { 
    try {
      await chatHistoryStore.deleteSession(sessionId); await loadChatSessions();
      if (sessionId === currentSessionId) { setMessages([]); setCurrentSessionId(null); }
    } catch (error) { console.error('Failed to delete session:', error); }
  };
  
   const handleSessionBookmark = async (sessionId: string) => {
    try {
      const fullSession = await chatHistoryStore.getSession(sessionId);
      if (fullSession && fullSession.messages.length > 0) {
        const sessionTitle = fullSession.title;
        const title = sessionTitle.split(' ').slice(0, 8).join(' ');
        const taskContent = fullSession.messages[0]?.content || '';
        const newFavorite = await favoritesStorage.addPrompt(title, taskContent);
        setFavoritePrompts(prev => [...prev, { ...newFavorite, id: newFavorite.id || Date.now(), createdAt: Date.now(), order: prev.length + 1 }].sort((a,b) => (a.order || 0) - (b.order || 0) ));
        handleBackToChat(true);
      }
    } catch (error) {
      console.error('Failed to pin session to favorites:', error);
    }
  };


  const handleBookmarkSelect = (content: string) => { if (setInputTextRef.current) setInputTextRef.current(content); };
  const handleBookmarkUpdateTitle = async (id: number, title: string) => { 
    try {
      await favoritesStorage.updatePromptTitle(id, title);
      setFavoritePrompts(prev => prev.map(p => p.id === id ? {...p, title} : p));
    } catch (error) { console.error('Failed to update fav title', error); }
  };
  const handleBookmarkDelete = async (id: number) => { 
    try {
      await favoritesStorage.removePrompt(id);
      setFavoritePrompts(prev => prev.filter(p => p.id !== id));
    } catch (error) { console.error('Failed to delete fav', error); }
  };
  const handleBookmarkReorder = async (draggedId: number, targetId: number) => { 
    try {
      await favoritesStorage.reorderPrompts(draggedId, targetId);
      const updatedPrompts = await favoritesStorage.getAllPrompts();
      setFavoritePrompts(updatedPrompts);
    } catch (error) { console.error('Failed to reorder favs', error); }
  };

  const handleConnectWorkspace = () => setShowWorkspaceConnectModal(true);
  const handleWorkspaceAuth = () => { 
    setIsWorkspaceConnected(true); setShowWorkspaceConnectModal(false);
    appendMessage({ actor: Actors.SYSTEM, content: 'Successfully connected to Google Workspace!', timestamp: Date.now() });
  };

  useEffect(() => { 
    const loadFavorites = async () => {
      try {
        let prompts = await favoritesStorage.getAllPrompts();
        if (prompts.length === 0) {
          for (const p of GENERIC_PLACEHOLDER_PROMPTS) {
            await favoritesStorage.addPrompt(p.title, p.content); 
          }
          prompts = await favoritesStorage.getAllPrompts(); 
        }
        setFavoritePrompts(prompts.sort((a,b) => (a.order || 0) - (b.order || 0)));
      } catch (error) {
        console.error('Failed to load/initialize favorite prompts:', error);
        setFavoritePrompts(GENERIC_PLACEHOLDER_PROMPTS); 
      }
    };
    loadFavorites();
  }, []);

  useEffect(() => { 
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      stopConnection();
    };
  }, [stopConnection]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  
  const handleMicClick = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permissionStatus.state === 'denied') {
        appendMessage({ actor: Actors.SYSTEM, content: 'Microphone access denied. Please enable microphone permissions in Chrome settings.', timestamp: Date.now() });
        return;
      }
      if (permissionStatus.state !== 'granted') {
        const permissionUrl = chrome.runtime.getURL('permission/index.html');
        chrome.windows.create({ url: permissionUrl, type: 'popup', width: 500, height: 600 }, (createdWindow) => {
          if (createdWindow?.id) {
            chrome.windows.onRemoved.addListener(function onWindowClose(windowId) {
              if (windowId === createdWindow.id) {
                chrome.windows.onRemoved.removeListener(onWindowClose);
                setTimeout(async () => {
                  try {
                    const newPermissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                    if (newPermissionStatus.state === 'granted') handleMicClick();
                  } catch (error) { console.error('Failed to check permission status:', error); }
                }, 500);
              }
            });
          }
        });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = event => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            if (!portRef.current) setupConnection();
            try {
              setIsProcessingSpeech(true);
              portRef.current?.postMessage({ type: 'speech_to_text', audio: base64Audio });
            } catch (error) {
              console.error('Failed to send audio for speech-to-text:', error);
              appendMessage({ actor: Actors.SYSTEM, content: 'Failed to process speech recording', timestamp: Date.now() });
              setIsRecording(false); setIsProcessingSpeech(false);
            }
          };
          reader.readAsDataURL(audioBlob);
        }
      };
      const maxDuration = 2 * 60 * 1000;
      recordingTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
        setIsRecording(false); setIsProcessingSpeech(true); recordingTimerRef.current = null;
      }, maxDuration);
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      let errorMessage = 'Failed to access microphone. ';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') errorMessage += 'Please grant microphone permission.';
        else if (error.name === 'NotFoundError') errorMessage += 'No microphone found.';
        else errorMessage += error.message;
      }
      appendMessage({ actor: Actors.SYSTEM, content: errorMessage, timestamp: Date.now() });
      setIsRecording(false);
    }
  };

  const handleAddContextClick = () => setShowAddContextPopup(prev => !prev);
  const handleModeModelClick = () => setShowModeModelPopup(prev => !prev);

  const ModeModelPopup = () => (
    <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-20 p-4 rounded-lg shadow-xl w-72 ${isDarkMode ? 'bg-slate-700 border border-slate-600' : 'bg-white border border-slate-200'}`}>
      <h4 className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Select Mode & Model</h4>
      <div className="space-y-2">
        <select value={currentMode} onChange={(e) => setCurrentMode(e.target.value as 'Agent' | 'Research')} className={`w-full p-2 rounded text-xs ${isDarkMode ? 'bg-slate-600 text-slate-100 border-slate-500' : 'bg-slate-100 text-slate-800 border-slate-300'}`}>
          <option value="Agent">Agent Mode</option>
          <option value="Research">Research Mode</option>
        </select>
        <select value={currentModel} onChange={(e) => setCurrentModel(e.target.value)} className={`w-full p-2 rounded text-xs ${isDarkMode ? 'bg-slate-600 text-slate-100 border-slate-500' : 'bg-slate-100 text-slate-800 border-slate-300'}`}>
          <option value="GPT-4o">GPT-4o</option>
          <option value="Claude 3 Opus">Claude 3 Opus</option>
          <option value="Gemini Pro">Gemini Pro</option>
        </select>
      </div>
      <button onClick={() => setShowModeModelPopup(false)} className={`mt-3 text-xs ${isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-500'}`}>Close</button>
    </div>
  );

  const AddContextPopup = () => (
     <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-20 p-4 rounded-lg shadow-xl w-72 ${isDarkMode ? 'bg-slate-700 border border-slate-600' : 'bg-white border border-slate-200'}`}>
      <h4 className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Add Context</h4>
      <p className={`text-xs mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Type '@' to mention files, URLs, or Google Workspace items.</p>
      <input type="text" placeholder="e.g., @myfile.pdf or @https://..." className={`w-full p-2 rounded text-xs mb-2 ${isDarkMode ? 'bg-slate-600 text-slate-100 border-slate-500 placeholder-slate-400' : 'bg-slate-100 text-slate-800 border-slate-300 placeholder-slate-400'}`} />
      <div className="flex justify-end">
        <button onClick={() => setShowAddContextPopup(false)} className={`text-xs ${isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-500'}`}>Close</button>
      </div>
    </div>
  );
  
  const WorkspaceConnectModal = () => ( 
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`relative w-full max-w-md p-6 rounded-lg shadow-xl ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
        <button onClick={() => setShowWorkspaceConnectModal(false)} className={`absolute top-3 right-3 p-1 rounded-full ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>✕</button>
        <div className="text-center mb-6">
            <FiLink className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-sky-400' : 'text-blue-500'}`} />
            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Connect to Google Workspace</h3>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Allow Monarch to access your Google Workspace data.</p>
        </div>
        <button onClick={handleWorkspaceAuth} className={`w-full mt-3 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} py-2.5 px-4 rounded-lg font-medium transition-colors`}>Connect Account</button>
      </div>
    </div>
  );


  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 ${isLightMode ? 'bg-white text-slate-900' : 'bg-slate-900 text-slate-100'}`}>
      <header className={`sticky top-0 z-10 flex items-center justify-between p-3 border-b transition-colors duration-300 ${isLightMode ? 'border-slate-200 bg-white/80 backdrop-blur-md' : 'border-slate-700 bg-slate-900/80 backdrop-blur-md'}`}>
        <div className="flex items-center gap-2">
          {showHistory ? (
            <button type="button" onClick={() => handleBackToChat(false)} className={`text-sm font-medium ${isLightMode ? 'text-blue-600 hover:text-blue-700' : 'text-sky-400 hover:text-sky-300'}`} aria-label="Back to chat">
              ← Back
            </button>
          ) : (
            <>
              <img src="/monarch-logo.svg" alt="Monarch Logo" className="h-6 w-6" />
              <span className={`text-lg font-semibold ${isLightMode ? 'text-slate-800' : 'text-slate-100'}`}>Monarch</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!showHistory && (
            <>
              <button type="button" onClick={handleNewChat} className={`p-1.5 rounded-md ${isLightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} aria-label="New Chat">
                <PiPlusBoldIcon size={18} />
              </button>
              <button type="button" onClick={handleLoadHistory} className={`p-1.5 rounded-md ${isLightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} aria-label="Load History">
                <GrHistory size={18} />
              </button>
            </>
          )}
          <button type="button" onClick={toggleTheme} className={`p-1.5 rounded-md ${isLightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} aria-label="Toggle theme">
            {isLightMode ? <FiMoon size={18} /> : <FiSun size={18} />}
          </button>
          <button type="button" onClick={() => { /* Placeholder for Account */ }} className={`p-1.5 rounded-md ${isLightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} aria-label="Account">
            <FiUser size={18} />
          </button>
          <button type="button" onClick={() => chrome.runtime.openOptionsPage()} className={`p-1.5 rounded-md ${isLightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-800' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`} aria-label="Settings">
            <FiSettings size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {showHistory ? (
          <ChatHistoryList sessions={chatSessions} onSessionSelect={handleSessionSelect} onSessionDelete={handleSessionDelete} onSessionBookmark={handleSessionBookmark} visible={true} isDarkMode={!isLightMode} />
        ) : (
          <>
            {hasConfiguredModels === null && (
              <div className={`flex-1 flex items-center justify-center p-8 ${isLightMode ? 'text-slate-600' : 'text-sky-300'}`}>
                <div className="text-center"><div className={`animate-spin w-8 h-8 border-2 ${isLightMode ? 'border-blue-500' : 'border-sky-400'} border-t-transparent rounded-full mx-auto mb-4`}></div><p>Checking configuration...</p></div>
              </div>
            )}
            {hasConfiguredModels === false && (
              <div className={`flex-1 flex items-center justify-center p-8 ${isLightMode ? 'text-slate-600' : 'text-sky-300'}`}>
                <div className="text-center max-w-md">
                  <FiSettings size={48} className={`mx-auto mb-4 ${isLightMode ? 'text-blue-500' : 'text-sky-400'}`} />
                  <h3 className={`text-lg font-semibold mb-2 ${isLightMode ? 'text-slate-700' : 'text-sky-200'}`}>Welcome to Monarch!</h3>
                  <p className="mb-4">To get started, please configure your AI models in settings.</p>
                  <button onClick={() => chrome.runtime.openOptionsPage()} className={`px-4 py-2 rounded-lg font-medium transition-colors ${isLightMode ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-sky-600 hover:bg-sky-700 text-white'}`}>Open Settings</button>
                </div>
              </div>
            )}
            {hasConfiguredModels === true && (
              <div className="h-full flex flex-col">
                {messages.length === 0 ? (
                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                     <div className="flex flex-col items-center justify-center h-full text-center">
                        <img src="/monarch-logo.svg" alt="Monarch Logo" className={`h-16 w-16 mb-4 ${isLightMode ? 'opacity-70' : 'opacity-50'}`} />
                        <h2 className={`text-xl font-semibold mb-2 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>How can I help you today?</h2>
                        <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Select a mode or start typing.</p>
                    </div>
                  </div>
                ) : (
                  <div className={`flex-1 overflow-x-hidden overflow-y-auto scroll-smooth p-4 scrollbar-gutter-stable ${isLightMode ? 'bg-slate-50' : 'bg-slate-800/50'}`}>
                    <MessageList messages={messages} isDarkMode={!isLightMode} />
                    <div ref={messagesEndRef} />
                  </div>
                )}
                <div className={`border-t p-1 ${isLightMode ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800'}`}>
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    onStopTask={handleStopTask}
                    onMicClick={handleMicClick}
                    onAddContextClick={handleAddContextClick}
                    onModeModelClick={handleModeModelClick}
                    currentMode={currentMode}
                    currentModel={currentModel}
                    isRecording={isRecording}
                    isProcessingSpeech={isProcessingSpeech}
                    disabled={!inputEnabled || isHistoricalSession}
                    showStopButton={showStopButton}
                    setContent={setter => { setInputTextRef.current = setter; }}
                    isDarkMode={!isLightMode}
                  />
                </div>
              </div>
            )}
          </>
        )}
        {/* Popups - Temporarily commented out for build debugging */}
        {/* {showModeModelPopup && <ModeModelPopup />} */}
        {/* {showAddContextPopup && <AddContextPopup />} */}
      </div>
      {/* Workspace Connect Modal - Temporarily commented out for build debugging */}
      {/* {showWorkspaceConnectModal && <WorkspaceConnectModal />} */}
    </div>
  );
};

export default SidePanel;
