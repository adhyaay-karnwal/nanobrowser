/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { FiSettings, FiUser, FiSun, FiMoon, FiPlus, FiChevronDown, FiPaperclip, FiLink, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
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

// Updated Generic placeholder prompts
const GENERIC_PLACEHOLDER_PROMPTS: FavoritePrompt[] = [
  { id: 1, title: 'Summarize This Page', content: 'Provide a concise summary of the current webpage.', order: 1, createdAt: Date.now() },
  { id: 2, title: 'Draft Professional Email', content: 'Draft a professional email to [Recipient Name] about [Subject]. Key points: [Point 1], [Point 2].', order: 2, createdAt: Date.now() },
  { id: 3, title: 'Explain [Tech Concept]', content: 'Explain the concept of [insert technical concept, e.g., "Blockchain"] in simple terms suitable for a non-technical audience.', order: 3, createdAt: Date.now() },
  { id: 4, title: 'Brainstorm Ideas for [Topic]', content: 'Brainstorm 5 innovative ideas related to [Topic, e.g., "sustainable urban living"].', order: 4, createdAt: Date.now() },
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
  const [isLightMode, setIsLightMode] = useState(false);
  const [favoritePrompts, setFavoritePrompts] = useState<FavoritePrompt[]>(GENERIC_PLACEHOLDER_PROMPTS);
  const [hasConfiguredModels, setHasConfiguredModels] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  
  // These will be controlled by ChatInput's internal state, but SidePanel needs to know them for sending messages
  // Or, lift state up from ChatInput to SidePanel if more complex interactions are needed.
  // For now, ChatInput will pass them during onSendMessage.
  // const [currentMode, setCurrentMode] = useState<'Agent' | 'Research'>('Agent'); // Default mode
  // const [currentModel, setCurrentModel] = useState<string>('GPT-4o'); // Default model

  const [showAddContextPopup, setShowAddContextPopup] = useState(false); // State for Add Context popup
  const [isWorkspaceConnected, setIsWorkspaceConnected] = useState(false);
  const [showWorkspaceConnectModal, setShowWorkspaceConnectModal] = useState(false);

  const [availableModelsForChatInput, setAvailableModelsForChatInput] = useState<{id: string, name: string}[]>([]);


  const sessionIdRef = useRef<string | null>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const setInputTextRef = useRef<((text: string) => void) | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const isDarkMode = !isLightMode;

  const toggleTheme = () => {
    setIsLightMode(prev => {
      const newMode = !prev;
      localStorage.setItem('monarch-theme', newMode ? 'light' : 'dark');
      return newMode;
    });
  };
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('monarch-theme');
    if (savedTheme === 'light') setIsLightMode(true);
    else if (savedTheme === 'dark') setIsLightMode(false);
    else {
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      setIsLightMode(prefersLight);
    }
  }, []);


  const checkModelConfiguration = useCallback(async () => {
    try {
      const configuredAgents = await agentModelStore.getConfiguredAgents();
      const hasAtLeastOneModel = configuredAgents.length > 0;
      setHasConfiguredModels(hasAtLeastOneModel);

      if(hasAtLeastOneModel){
        const modelsFromStorage = await agentModelStore.getAvailableModels();
        const formattedModels = modelsFromStorage.map(m => ({
          id: `${m.provider}>${m.model}`, // Unique ID for selection
          name: `${m.providerName} - ${m.model}`, // Display name
        }));
        setAvailableModelsForChatInput(formattedModels.length > 0 ? formattedModels : [{id: 'default', name: 'Default Model'}]);
      } else {
        setAvailableModelsForChatInput([{id: 'default', name: 'Default Model'}]);
      }
    } catch (error) {
      console.error('Error checking model configuration:', error);
      setHasConfiguredModels(false);
      setAvailableModelsForChatInput([{id: 'default', name: 'Default Model'}]);
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
    // Only save user messages and final AI responses to history, not intermediate system/progress messages.
    if (effectiveSessionId && (newMessage.actor === Actors.USER || (newMessage.actor === Actors.SYSTEM && !isProgressMessage))) { 
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
      let isFinalMessage = false;

      // Consolidate internal agent messages into user-friendly updates from "Monarch"
      if (actor === Actors.PLANNER || actor === Actors.NAVIGATOR || actor === Actors.VALIDATOR) {
        if (state === ExecutionState.STEP_START || state === ExecutionState.ACT_START) {
          monarchMessage = `Monarch is working on: ${details || actor.toLowerCase().replace('_', ' ')} step...`;
        } else if (state === ExecutionState.STEP_OK || state === ExecutionState.ACT_OK) {
           if (details && details.toLowerCase() !== 'cache_content' && details.toLowerCase() !== 'ok') {
             monarchMessage = `Monarch: ${details}`; // Show meaningful "OK" details
           }
        } else if (state === ExecutionState.STEP_FAIL || state === ExecutionState.ACT_FAIL) {
          monarchMessage = `Monarch encountered an issue with ${actor.toLowerCase().replace('_', ' ')}: ${details || 'Failed step'}`;
          isFinalMessage = true; // Treat failures as potentially final for that sub-task
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
              isFinalMessage = true;
              break;
            case ExecutionState.TASK_FAIL:
              setIsFollowUpMode(true); // Allow follow-up even on failure to ask for clarification
              setInputEnabled(true);
              setShowStopButton(false);
              monarchMessage = `Task failed: ${details || data?.summary || 'An unexpected error occurred.'}`;
              isFinalMessage = true;
              break;
            case ExecutionState.TASK_CANCEL:
              setIsFollowUpMode(false);
              setInputEnabled(true);
              setShowStopButton(false);
              monarchMessage = "Task cancelled.";
              isFinalMessage = true;
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
        if(isFinalMessage) {
            // Potentially remove any lingering "Monarch is working..." message if this is a final update
            setMessages(prev => prev.filter(msg => !(msg.actor === Actors.SYSTEM && msg.content?.startsWith('Monarch is working...'))));
            appendMessage({ actor: Actors.SYSTEM, content: monarchMessage, timestamp: timestamp }); // Re-append final message if needed
        }
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
      appendMessage({ actor: Actors.SYSTEM, content: 'Failed to connect to Monarch services.', timestamp: Date.now() });
      portRef.current = null;
    }
  }, [handleTaskState, appendMessage, stopConnection]);

  const sendMessageToBackend = useCallback( (message: any) => { 
      if (portRef.current?.name !== 'side-panel-connection') throw new Error('No valid connection to Monarch services.');
      try { portRef.current.postMessage(message); }
      catch (error) { console.error('Failed to send message:', error); stopConnection(); throw error; }
    }, [stopConnection],
  );

  const handleCommand = async (command: string): Promise<boolean> => {
    // Simplified command handling
    if (command === '/state' || command === '/nohighlight') {
        if (!portRef.current) setupConnection();
        try {
            sendMessageToBackend({ type: command.substring(1) }); // e.g., 'state', 'nohighlight'
            return true;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            appendMessage({ actor: Actors.SYSTEM, content: `Error processing command: ${msg}`, timestamp: Date.now() });
            return true;
        }
    }
    appendMessage({ actor: Actors.SYSTEM, content: `Unknown command: ${command}`, timestamp: Date.now() });
    return true;
 };

  const handleSendMessage = async (text: string, mode: string, model: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || isHistoricalSession) return;
    if (trimmedText.startsWith('/')) {
      const wasHandled = await handleCommand(trimmedText);
      if (wasHandled) return;
    }
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) throw new Error('No active tab found.');
      setInputEnabled(false); setShowStopButton(true);
      
      let effectiveSessionId = sessionIdRef.current;
      if (!isFollowUpMode || !effectiveSessionId) {
        const newSession = await chatHistoryStore.createSession(trimmedText.substring(0, 50) + (trimmedText.length > 50 ? '...' : ''));
        effectiveSessionId = newSession.id;
        setCurrentSessionId(effectiveSessionId); // This will also update sessionIdRef.current via useEffect
      }
      
      appendMessage({ actor: Actors.USER, content: trimmedText, timestamp: Date.now() }, effectiveSessionId);
      if (!portRef.current) setupConnection();
      
      const messageType = isFollowUpMode ? 'follow_up_task' : 'new_task';
      await sendMessageToBackend({ type: messageType, task: trimmedText, taskId: effectiveSessionId, tabId, mode, model });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Task error:', errorMessage);
      appendMessage({ actor: Actors.SYSTEM, content: `Error: ${errorMessage}`, timestamp: Date.now() });
      setInputEnabled(true); setShowStopButton(false); stopConnection();
    }
  };

  const handleStopTask = async () => { 
    try { sendMessageToBackend({ type: 'cancel_task' }); }
    catch(err) { 
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Cancel task error:', errorMessage);
        appendMessage({ actor: Actors.SYSTEM, content: `Error stopping task: ${errorMessage}`, timestamp: Date.now() });
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
        handleBackToChat(true); // Go back to chat view, potentially resetting it
      }
    } catch (error) {
      console.error('Failed to pin session to favorites:', error);
      appendMessage({actor: Actors.SYSTEM, content: "Could not save prompt to favorites.", timestamp: Date.now()});
    }
  };


  const handleBookmarkSelect = (content: string) => { if (setInputTextRef.current) setInputTextRef.current(content); };
  const handleBookmarkUpdateTitle = async (id: number, title: string) => { 
    try {
      await favoritesStorage.updatePromptTitle(id, title);
      setFavoritePrompts(prev => prev.map(p => p.id === id ? {...p, title} : p));
    } catch (error) { console.error('Failed to update favorite prompt title:', error); }
  };
  const handleBookmarkDelete = async (id: number) => { 
    try {
      await favoritesStorage.removePrompt(id);
      setFavoritePrompts(prev => prev.filter(p => p.id !== id));
    } catch (error) { console.error('Failed to delete favorite prompt:', error); }
  };
  const handleBookmarkReorder = async (draggedId: number, targetId: number) => { 
    try {
      await favoritesStorage.reorderPrompts(draggedId, targetId);
      const updatedPrompts = await favoritesStorage.getAllPrompts();
      setFavoritePrompts(updatedPrompts);
    } catch (error) { console.error('Failed to reorder favorite prompts:', error); }
  };

  const handleConnectWorkspace = () => setShowWorkspaceConnectModal(true);
  const handleWorkspaceAuth = () => { 
    // Placeholder for actual OAuth flow
    setIsWorkspaceConnected(true); setShowWorkspaceConnectModal(false);
    appendMessage({ actor: Actors.SYSTEM, content: 'Successfully connected to Google Workspace!', timestamp: Date.now() });
    // TODO: Trigger actual OAuth flow here.
    // chrome.identity.getAuthToken({ interactive: true }, function(token) { ... });
  };

  useEffect(() => { 
    const loadFavorites = async () => {
      try {
        let prompts = await favoritesStorage.getAllPrompts();
        if (prompts.length === 0) {
          // If storage is empty, populate with generic placeholders
          for (const p of GENERIC_PLACEHOLDER_PROMPTS) {
            await favoritesStorage.addPrompt(p.title, p.content); 
          }
          prompts = await favoritesStorage.getAllPrompts(); 
        }
        setFavoritePrompts(prompts.sort((a,b) => (a.order || 0) - (b.order || 0)));
      } catch (error) {
        console.error('Failed to load/initialize favorite prompts:', error);
        setFavoritePrompts(GENERIC_PLACEHOLDER_PROMPTS); // Fallback to defaults on error
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
      // If permission is not granted, try to open the custom permission page
      if (permissionStatus.state !== 'granted') {
        const permissionUrl = chrome.runtime.getURL('permission/index.html');
        chrome.windows.create({ url: permissionUrl, type: 'popup', width: 400, height: 300 }, (createdWindow) => {
          if (createdWindow?.id) {
            chrome.windows.onRemoved.addListener(function onWindowClose(windowId) {
              if (windowId === createdWindow.id) {
                chrome.windows.onRemoved.removeListener(onWindowClose);
                // After the permission window is closed, re-check and try again if granted
                setTimeout(async () => {
                  try {
                    const newPermissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                    if (newPermissionStatus.state === 'granted') handleMicClick(); // Retry if granted
                    else if (newPermissionStatus.state === 'denied') appendMessage({ actor: Actors.SYSTEM, content: 'Microphone access still denied.', timestamp: Date.now() });
                  } catch (error) { console.error('Failed to re-check permission status:', error); }
                }, 500); // Short delay to allow permission state to update
              }
            });
          } else {
             appendMessage({ actor: Actors.SYSTEM, content: 'Could not open permission request window. Please check your browser settings.', timestamp: Date.now() });
          }
        });
        return;
      }
      // Permission is granted, proceed with recording
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
              appendMessage({ actor: Actors.SYSTEM, content: 'Failed to process speech recording.', timestamp: Date.now() });
              setIsRecording(false); setIsProcessingSpeech(false);
            }
          };
          reader.readAsDataURL(audioBlob);
        } else {
            setIsProcessingSpeech(false); // No audio data to process
        }
      };
      const maxDuration = 2 * 60 * 1000; // 2 minutes
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
  // const handleModeModelClick = () => setShowModeModelPopup(prev => !prev); // Now handled by ChatInput

  // Simplified AddContextPopup (placeholder content)
  const AddContextPopup = () => (
     <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-20 p-4 rounded-lg shadow-xl w-72 ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
      <div className="flex justify-between items-center mb-2">
        <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Add Context</h4>
        <button onClick={() => setShowAddContextPopup(false)} className={`p-1 rounded-full ${isDarkMode ? 'text-slate-400 hover:bg-slate-600' : 'text-slate-500 hover:bg-slate-100'}`}>✕</button>
      </div>
      <p className={`text-xs mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Type '@' in the chat to mention files, URLs, or connect to Google Workspace.</p>
      {!isWorkspaceConnected && (
        <Button onClick={handleConnectWorkspace} className={`w-full mt-2 text-xs ${isDarkMode ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
            <FiLink className="mr-1.5 h-3.5 w-3.5"/> Connect Google Workspace
        </Button>
      )}
      {isWorkspaceConnected && (
         <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-700'}`}>
            <FiCheckCircle className="inline mr-1 h-3.5 w-3.5"/> Google Workspace Connected
        </div>
      )}
    </div>
  );
  
  const WorkspaceConnectModal = () => ( 
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className={`relative w-full max-w-sm p-6 rounded-lg shadow-xl ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
        <button onClick={() => setShowWorkspaceConnectModal(false)} className={`absolute top-3 right-3 p-1 rounded-full ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>✕</button>
        <div className="text-center mb-5">
            <FiLink className={`w-10 h-10 mx-auto mb-3 ${isDarkMode ? 'text-sky-400' : 'text-blue-500'}`} />
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Connect to Google Workspace</h3>
            <p className={`mt-1.5 text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Allow Monarch to securely access your Google Workspace data to provide personalized assistance.</p>
        </div>
        <Button onClick={handleWorkspaceAuth} className={`w-full mt-3 text-sm ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} py-2 px-4 rounded-md font-medium transition-colors`}>
            <svg className="w-4 h-4 mr-2 inline" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56,12.25C22.56,12.25,22.56,12.25,22.56,12.25C22.56,11.42,22.49,10.61,22.36,9.82H12.29V14.2H18.05C17.83,15.61,17.07,16.82,15.96,17.57V20.07H19.05C21.21,18.13,22.56,15.44,22.56,12.25Z" fill="#4285F4"></path><path d="M12.29,22.76C15.23,22.76,17.7,21.81,19.53,20.07L16.44,17.57C15.43,18.25,14,18.65,12.29,18.65C9.46,18.65,7.06,16.73,6.15,14.29H3.06V16.79C4.89,20.34,8.28,22.76,12.29,22.76Z" fill="#34A853"></path><path d="M6.15,14.29C6.15,14.29,6.15,14.29,6.15,14.29C5.96,13.72,5.85,13.13,5.85,12.52C5.85,11.91,5.96,11.32,6.15,10.75V8.25H3.06C2.32,9.71,1.92,11.06,1.92,12.52C1.92,13.98,2.32,15.33,3.06,16.79L6.15,14.29Z" fill="#FBBC05"></path><path d="M12.29,6.39C14.4,6.39,15.92,7.21,16.77,8L19.6,5.18C17.7,3.49,15.23,2.28,12.29,2.28C8.28,2.28,4.89,4.7,3.06,8.25L6.15,10.75C7.06,8.31,9.46,6.39,12.29,6.39Z" fill="#EA4335"></path></svg>
            Sign in with Google
        </Button>
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
              <img src={isLightMode ? chrome.runtime.getURL('icons/icon-dark.svg') : chrome.runtime.getURL('icons/icon-light.svg')} alt="Monarch Logo" className="h-6 w-6" />
              <span className={`text-lg font-semibold ${isLightMode ? 'text-slate-800' : 'text-slate-100'}`}>Monarch</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
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
                  <div className="flex-1 overflow-y-auto p-4 space-y-6 flex flex-col items-center justify-center">
                     <div className="text-center">
                        <img src={isLightMode ? chrome.runtime.getURL('icons/icon-dark.svg') : chrome.runtime.getURL('icons/icon-light.svg')} alt="Monarch Logo" className={`h-16 w-16 mb-4 opacity-60`} />
                        <h2 className={`text-xl font-semibold mb-2 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>How can I help you today?</h2>
                        <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Select a mode or start typing below.</p>
                    </div>
                    <div className="w-full max-w-md mt-6">
                        <h3 className={`text-sm font-medium mb-2 text-center ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>Quick Prompts</h3>
                        <BookmarkList 
                            bookmarks={favoritePrompts} 
                            onBookmarkSelect={handleBookmarkSelect} 
                            onBookmarkUpdateTitle={handleBookmarkUpdateTitle} 
                            onBookmarkDelete={handleBookmarkDelete} 
                            onBookmarkReorder={handleBookmarkReorder} 
                            isDarkMode={!isLightMode} 
                        />
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
                    // onModeModelClick is handled internally by ChatInput now
                    isRecording={isRecording}
                    isProcessingSpeech={isProcessingSpeech}
                    disabled={!inputEnabled || isHistoricalSession}
                    showStopButton={showStopButton}
                    setContent={setter => { setInputTextRef.current = setter; }}
                    isDarkMode={!isLightMode}
                    availableModels={availableModelsForChatInput}
                  />
                </div>
              </div>
            )}
          </>
        )}
        {showAddContextPopup && <AddContextPopup />}
      </div>
      {showWorkspaceConnectModal && <WorkspaceConnectModal />}
    </div>
  );
};

export default SidePanel;
