import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FiMic, FiPlus, FiSend, FiChevronDown, FiLoader, FiSquare, FiCheck } from 'react-icons/fi';
import { FaInfinity } from 'react-icons/fa';

interface ChatInputProps {
  onSendMessage: (text: string, mode: string, model: string) => void; // Updated to include mode and model
  onStopTask: () => void;
  onMicClick?: () => void;
  onAddContextClick?: () => void;
  // Removed onModeModelClick as dropdown is now internal
  // Removed currentMode, currentModel as they are now internal state or passed to onSendMessage
  isRecording?: boolean;
  isProcessingSpeech?: boolean;
  disabled: boolean;
  showStopButton: boolean;
  setContent?: (setter: (text: string) => void) => void;
  isDarkMode?: boolean;
  availableModels?: { provider: string; name: string; displayName: string }[]; // For model selection
}

const MODES = [
  { id: 'agent', name: 'Agent', prompt: 'Act as a general AI assistant.' },
  { id: 'research', name: 'Research', prompt: 'Focus on finding and summarizing information.' },
  { id: 'creative', name: 'Creative', prompt: 'Help with creative writing tasks.' },
];

// Placeholder models - in a real app, this would come from props or a store
const DEFAULT_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'llama-3-70b', name: 'Llama 3 70B (Local)' },
];


export default function ChatInput({
  onSendMessage,
  onStopTask,
  onMicClick,
  onAddContextClick,
  isRecording = false,
  isProcessingSpeech = false,
  disabled,
  showStopButton,
  setContent,
  isDarkMode = false,
  availableModels = DEFAULT_MODELS, // Use passed models or default
}: ChatInputProps) {
  const [text, setText] = useState('');
  const isSendButtonDisabled = useMemo(() => disabled || text.trim() === '', [disabled, text]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedMode, setSelectedMode] = useState(MODES[0]);
  const [selectedModel, setSelectedModel] = useState(availableModels[0] || DEFAULT_MODELS[0]);
  const [showModeModelDropdown, setShowModeModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 120; 
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [text]);

  useEffect(() => {
    if (setContent) {
      setContent(setText);
    }
  }, [setContent]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (text.trim() && !disabled) {
        onSendMessage(text, selectedMode.id, selectedModel.id); // Pass selected mode and model
        setText('');
      }
    },
    [text, onSendMessage, disabled, selectedMode, selectedModel],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModeModelDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);


  const micButtonBg = isDarkMode
  ? (isRecording ? 'bg-gradient-to-br from-sky-500 to-blue-600' : 'bg-slate-700 hover:bg-slate-600')
  : (isRecording ? 'bg-gradient-to-br from-sky-400 to-blue-500' : 'bg-slate-100 hover:bg-slate-200');

  const micButtonTextColor = isDarkMode
  ? (isRecording ? 'text-white' : 'text-slate-300 hover:text-slate-100') // Updated hover color
  : (isRecording ? 'text-white' : 'text-slate-500 hover:text-slate-700');


  // Dynamic classes for theme
  const themeClasses = {
    inputWrapper: isDarkMode
      ? 'bg-slate-800 border-slate-700 focus-within:border-sky-600 focus-within:shadow-[0_0_0_1.5px_theme(colors.sky.600)]'
      : 'bg-white border-slate-300 focus-within:border-blue-500 focus-within:shadow-[0_0_0_1.5px_theme(colors.blue.500)]',
    textarea: isDarkMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400',
    button: isDarkMode
      ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200 focus:ring-sky-500 focus:ring-offset-slate-800'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:ring-blue-500 focus:ring-offset-white',
    contextButton: isDarkMode
      ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 focus:ring-sky-500 focus:ring-offset-slate-800'
      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-blue-500 focus:ring-offset-white',
    sendButtonActive: isDarkMode
      ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white hover:from-sky-400 hover:to-blue-500 focus:ring-sky-500 focus:ring-offset-slate-800'
      : 'bg-gradient-to-br from-blue-500 to-sky-500 text-white hover:from-blue-600 hover:to-sky-600 focus:ring-blue-500 focus:ring-offset-white',
    sendButtonDisabled: isDarkMode ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed',
    stopButton: isDarkMode
      ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 focus:ring-red-500 focus:ring-offset-slate-800'
      : 'bg-gradient-to-br from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 focus:ring-red-500 focus:ring-offset-white',
    dropdown: isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700',
    dropdownItem: isDarkMode ? 'hover:bg-slate-600' : 'hover:bg-slate-100',
    dropdownItemActive: isDarkMode ? 'bg-sky-700 text-white' : 'bg-blue-500 text-white',
  };

  return (
    <div className={`p-2.5 space-y-2.5 ${isDarkMode ? 'dark' : ''}`}>
      {onAddContextClick && (
        <button
          type="button"
          onClick={onAddContextClick}
          disabled={disabled}
          className={`
            flex items-center justify-center w-full sm:w-auto px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ease-in-out
            focus:outline-none focus:ring-1
            ${themeClasses.contextButton}
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          `}
          aria-label="Add context"
        >
          <FiPlus className="mr-1.5 h-3.5 w-3.5" />
          @ Add Context
        </button>
      )}

      <div
        className={`
          flex items-end p-0.5 rounded-lg border transition-shadow duration-200
          ${themeClasses.inputWrapper}
        `}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className={`
            flex-grow resize-none bg-transparent p-2 text-sm outline-none
            ${themeClasses.textarea}
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
          placeholder="Imagine, plan, write anything..."
          aria-label="Message input"
        />
        {onMicClick && (
          <button
            type="button"
            onClick={onMicClick}
            disabled={disabled || isProcessingSpeech}
            className={`
              ml-1 mb-0.5 flex-shrink-0 rounded-md p-2 transition-all duration-200 ease-in-out transform active:scale-90
              focus:outline-none focus:ring-1
              ${micButtonBg} ${micButtonTextColor}
              ${isDarkMode ? 'focus:ring-sky-500 focus:ring-offset-slate-800' : 'focus:ring-blue-500 focus:ring-offset-white'}
              ${(disabled || isProcessingSpeech) ? 'opacity-60 cursor-not-allowed' : ''}
              ${isRecording ? 'animate-pulse shadow-md' : ''}
            `}
            aria-label={isProcessingSpeech ? 'Processing speech...' : isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {isProcessingSpeech
              ? <FiLoader className="h-4 w-4 animate-spin" />
              : <FiMic className="h-4 w-4" />
            }
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowModeModelDropdown(prev => !prev)}
            disabled={disabled}
            className={`
              flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors
              focus:outline-none focus:ring-1
              ${themeClasses.button}
              ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
            `}
            aria-expanded={showModeModelDropdown}
            aria-haspopup="true"
            aria-label={`Current mode: ${selectedMode.name}, Model: ${selectedModel.name}. Click to change.`}
          >
            <FaInfinity className={`h-3 w-3 ${isDarkMode ? 'text-sky-400' : 'text-blue-600'}`} />
            <span>{selectedMode.name}</span>
            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>·</span>
            <span>{selectedModel.name}</span>
            <FiChevronDown className={`h-3 w-3 transition-transform ${showModeModelDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showModeModelDropdown && (
            <div className={`absolute bottom-full mb-2 w-64 rounded-md shadow-lg border p-2 z-10 ${themeClasses.dropdown}`}>
              <div className="mb-2">
                <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Mode</label>
                {MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => { setSelectedMode(mode); setShowModeModelDropdown(false); }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-md flex items-center justify-between ${themeClasses.dropdownItem} ${selectedMode.id === mode.id ? themeClasses.dropdownItemActive : ''}`}
                  >
                    {mode.name}
                    {selectedMode.id === mode.id && <FiCheck className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Model</label>
                {availableModels.map(model => (
                  <button
                    key={model.id}
                    onClick={() => { setSelectedModel(model); setShowModeModelDropdown(false); }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-md flex items-center justify-between ${themeClasses.dropdownItem} ${selectedModel.id === model.id ? themeClasses.dropdownItemActive : ''}`}
                  >
                    {model.name}
                    {selectedModel.id === model.id && <FiCheck className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {showStopButton ? (
          <button
            type="button"
            onClick={onStopTask}
            className={`
              flex items-center justify-center p-2 rounded-full transition-all duration-200 ease-in-out transform active:scale-90 shadow-sm
              focus:outline-none focus:ring-1
              ${themeClasses.stopButton}
            `}
            aria-label="Stop task"
          >
            <FiSquare className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSendButtonDisabled}
            className={`
              flex items-center justify-center p-2 rounded-full transition-all duration-200 ease-in-out transform active:scale-90 shadow-sm
              focus:outline-none focus:ring-1
              ${isSendButtonDisabled ? themeClasses.sendButtonDisabled : themeClasses.sendButtonActive}
            `}
            aria-label="Send message"
          >
            <FiSend className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
