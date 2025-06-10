import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FiMic, FiPlus, FiSend, FiChevronDown, FiLoader, FiSquare } from 'react-icons/fi'; // Using FiSquare for stop
import { FaInfinity } from 'react-icons/fa'; // Using FaInfinity for Agent symbol

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onStopTask: () => void;
  onMicClick?: () => void;
  onAddContextClick?: () => void; // New prop for context button
  onModeModelClick?: () => void; // New prop for mode/model selector
  currentMode?: string; // e.g., "Agent"
  currentModel?: string; // e.g., "GPT-4.1"
  isRecording?: boolean;
  isProcessingSpeech?: boolean;
  disabled: boolean;
  showStopButton: boolean;
  setContent?: (setter: (text: string) => void) => void;
  isDarkMode?: boolean;
}

export default function ChatInput({
  onSendMessage,
  onStopTask,
  onMicClick,
  onAddContextClick,
  onModeModelClick,
  currentMode = 'Agent',
  currentModel = 'Default Model',
  isRecording = false,
  isProcessingSpeech = false,
  disabled,
  showStopButton,
  setContent,
  isDarkMode = false,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const isSendButtonDisabled = useMemo(() => disabled || text.trim() === '', [disabled, text]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height
      const maxHeight = 120; // Max height for 5-6 lines
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
        onSendMessage(text);
        setText('');
      }
    },
    [text, onSendMessage, disabled],
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

  const micButtonBg = isDarkMode
  ? (isRecording ? 'bg-gradient-to-br from-sky-500 to-blue-600' : 'bg-slate-700 hover:bg-slate-600')
  : (isRecording ? 'bg-gradient-to-br from-sky-400 to-blue-500' : 'bg-slate-100 hover:bg-slate-200');

  const micButtonTextColor = isDarkMode
  ? (isRecording ? 'text-white' : 'text-slate-400 hover:text-slate-200')
  : (isRecording ? 'text-white' : 'text-slate-500 hover:text-slate-700');


  return (
    <div className={`p-3 space-y-3 ${isDarkMode ? 'dark' : ''}`}>
      {/* Context Button */}
      {onAddContextClick && (
        <button
          type="button"
          onClick={onAddContextClick}
          disabled={disabled}
          className={`
            flex items-center justify-center w-full sm:w-auto px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-offset-1
            ${isDarkMode
              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 focus:ring-sky-500 focus:ring-offset-slate-800'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-blue-500 focus:ring-offset-white'
            }
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          `}
          aria-label="Add context"
        >
          <FiPlus className="mr-1.5 h-4 w-4" />
          @ Add Context
        </button>
      )}

      {/* Main Input Area */}
      <div
        className={`
          flex items-end p-1 rounded-xl border transition-shadow duration-200
          ${isDarkMode
            ? 'bg-slate-800 border-slate-700 focus-within:border-sky-600 focus-within:shadow-[0_0_0_2px_theme(colors.sky.600)]'
            : 'bg-white border-slate-300 focus-within:border-blue-500 focus-within:shadow-[0_0_0_2px_theme(colors.blue.500)]'
          }
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
            flex-grow resize-none bg-transparent p-2.5 text-sm outline-none
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}
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
              ml-1.5 mb-1 flex-shrink-0 rounded-lg p-2.5 transition-all duration-200 ease-in-out transform active:scale-90
              focus:outline-none focus:ring-2 focus:ring-offset-1
              ${micButtonBg} ${micButtonTextColor}
              ${isDarkMode ? 'focus:ring-sky-500 focus:ring-offset-slate-800' : 'focus:ring-blue-500 focus:ring-offset-white'}
              ${(disabled || isProcessingSpeech) ? 'opacity-60 cursor-not-allowed' : ''}
              ${isRecording ? 'animate-pulse shadow-lg' : ''}
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

      {/* Bottom Controls: Mode/Model Selector and Send/Stop Button */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onModeModelClick}
          disabled={disabled}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
            focus:outline-none focus:ring-2 focus:ring-offset-1
            ${isDarkMode
              ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200 focus:ring-sky-500 focus:ring-offset-slate-800'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:ring-blue-500 focus:ring-offset-white'
            }
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          `}
          aria-label={`Current mode: ${currentMode}, Model: ${currentModel}. Click to change.`}
        >
          <FaInfinity className={`h-3 w-3 ${isDarkMode ? 'text-sky-500' : 'text-blue-600'}`} />
          <span>{currentMode}</span>
          <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>·</span>
          <span>{currentModel}</span>
          <FiChevronDown className="h-3 w-3" />
        </button>

        {showStopButton ? (
          <button
            type="button"
            onClick={onStopTask}
            className={`
              flex items-center justify-center p-2.5 rounded-full transition-all duration-200 ease-in-out transform active:scale-90 shadow-md
              focus:outline-none focus:ring-2 focus:ring-offset-1
              ${isDarkMode
                ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 focus:ring-red-500 focus:ring-offset-slate-800'
                : 'bg-gradient-to-br from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 focus:ring-red-500 focus:ring-offset-white'
              }
            `}
            aria-label="Stop task"
          >
            <FiSquare className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button" // Changed to button type, form submission handled by handleSubmit via onKeyDown or explicit call
            onClick={() => handleSubmit()}
            disabled={isSendButtonDisabled}
            className={`
              flex items-center justify-center p-2.5 rounded-full transition-all duration-200 ease-in-out transform active:scale-90 shadow-md
              focus:outline-none focus:ring-2 focus:ring-offset-1
              ${isSendButtonDisabled
                ? (isDarkMode ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed')
                : (isDarkMode
                    ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white hover:from-sky-400 hover:to-blue-500 focus:ring-sky-500 focus:ring-offset-slate-800'
                    : 'bg-gradient-to-br from-blue-500 to-sky-500 text-white hover:from-blue-600 hover:to-sky-600 focus:ring-blue-500 focus:ring-offset-white'
                  )
              }
            `}
            aria-label="Send message"
          >
            <FiSend className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
