import { useEffect, useState, useCallback } from 'react';
import { Button } from '@extension/ui';
import {
  llmProviderStore,
  agentModelStore,
  AgentNameEnum, // We'll use a default agent name like 'primary'
  ProviderTypeEnum,
  type ProviderConfig,
} from '@extension/storage';
import { FiKey, FiServer, FiCpu, FiSave, FiEye, FiEyeOff, FiInfo, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

// Simulate reading from .env (in a real extension, this would come from a build process or background script)
const SIMULATED_ENV = {
  USE_MONARCH_PROVIDED_KEYS: process.env.USE_MONARCH_PROVIDED_KEYS === 'true',
  MONARCH_OPENAI_API_KEY: process.env.MONARCH_OPENAI_API_KEY,
  MONARCH_ANTHROPIC_API_KEY: process.env.MONARCH_ANTHROPIC_API_KEY,
  MONARCH_GOOGLE_API_KEY: process.env.MONARCH_GOOGLE_API_KEY,
  // User keys from .env are not directly used here, UI is for user to input if not using Monarch's
};

const PRIMARY_AGENT_NAME = AgentNameEnum.Planner; // Using Planner as the representative for the "primary" agent

interface ModelSettingsProps {
  isLightMode: boolean;
}

interface ProviderOption {
  id: ProviderTypeEnum | 'custom_openai';
  name: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  apiKeyLabel?: string;
  baseUrlLabel?: string;
  defaultModels?: string[];
  modelInputType?: 'dropdown' | 'text';
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: ProviderTypeEnum.OpenAI, name: 'OpenAI', requiresApiKey: true, requiresBaseUrl: false, defaultModels: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'], modelInputType: 'dropdown' },
  { id: ProviderTypeEnum.Anthropic, name: 'Anthropic', requiresApiKey: true, requiresBaseUrl: false, defaultModels: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'], modelInputType: 'dropdown' },
  { id: ProviderTypeEnum.Gemini, name: 'Google Gemini', requiresApiKey: true, requiresBaseUrl: false, defaultModels: ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-1.0-pro'], modelInputType: 'dropdown' },
  { id: ProviderTypeEnum.Ollama, name: 'Ollama (Local)', requiresApiKey: false, requiresBaseUrl: true, baseUrlLabel: 'Ollama Base URL', defaultModels: ['llama3', 'mistral', 'codellama'], modelInputType: 'text', apiKeyLabel: 'API Key (Optional)' },
  { id: 'custom_openai', name: 'Custom OpenAI-Compatible', requiresApiKey: true, requiresBaseUrl: true, baseUrlLabel: 'API Base URL', modelInputType: 'text', apiKeyLabel: 'API Key (Optional)' },
];

export const ModelSettings = ({ isLightMode }: ModelSettingsProps) => {
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderOption['id']>(PROVIDER_OPTIONS[0].id);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customModelName, setCustomModelName] = useState(''); // For text input models like Ollama/Custom
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const [useMonarchProvidedKeys, setUseMonarchProvidedKeys] = useState(SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS);
  const [canUserEditKeys, setCanUserEditKeys] = useState(!SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS);

  const currentProviderConfig = PROVIDER_OPTIONS.find(p => p.id === selectedProviderId) || PROVIDER_OPTIONS[0];

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const primaryAgentConfig = await agentModelStore.getAgentModel(PRIMARY_AGENT_NAME);
      if (primaryAgentConfig && primaryAgentConfig.provider) {
        const providerIdToLoad = primaryAgentConfig.provider === ProviderTypeEnum.CustomOpenAI && !PROVIDER_OPTIONS.find(p => p.id === primaryAgentConfig.provider)
          ? 'custom_openai' // map stored "custom_openai_1" etc. to our simplified "custom_openai"
          : primaryAgentConfig.provider as ProviderOption['id'];
        
        const providerConfig = PROVIDER_OPTIONS.find(p => p.id === providerIdToLoad);

        if (providerConfig) {
          setSelectedProviderId(providerIdToLoad);
          
          const storedProviderDetails = await llmProviderStore.getProvider(primaryAgentConfig.provider);
          
          // Determine if we should use .env keys or allow user input
          // This logic might be more complex if we allow overriding .env Monarch keys
          if (SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS) {
            setUseMonarchProvidedKeys(true);
            setCanUserEditKeys(false); // Don't allow editing if Monarch keys are forced
            // Pre-fill with Monarch's key if available (masked)
            let monarchKey = '';
            if (providerIdToLoad === ProviderTypeEnum.OpenAI) monarchKey = SIMULATED_ENV.MONARCH_OPENAI_API_KEY || '';
            else if (providerIdToLoad === ProviderTypeEnum.Anthropic) monarchKey = SIMULATED_ENV.MONARCH_ANTHROPIC_API_KEY || '';
            else if (providerIdToLoad === ProviderTypeEnum.Gemini) monarchKey = SIMULATED_ENV.MONARCH_GOOGLE_API_KEY || '';
            setApiKey(monarchKey);
          } else {
            setUseMonarchProvidedKeys(false);
            setCanUserEditKeys(true);
            setApiKey(storedProviderDetails?.apiKey || '');
          }
          
          setBaseUrl(storedProviderDetails?.baseUrl || (providerIdToLoad === ProviderTypeEnum.Ollama ? 'http://localhost:11434' : ''));
          
          if (providerConfig.modelInputType === 'dropdown') {
            setSelectedModel(primaryAgentConfig.modelName || (providerConfig.defaultModels ? providerConfig.defaultModels[0] : ''));
            setCustomModelName('');
          } else {
            setCustomModelName(primaryAgentConfig.modelName || '');
            setSelectedModel('');
          }
        }
      } else {
        // Default to first provider if nothing is stored
        setSelectedProviderId(PROVIDER_OPTIONS[0].id);
        setApiKey(SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS && SIMULATED_ENV.MONARCH_OPENAI_API_KEY ? SIMULATED_ENV.MONARCH_OPENAI_API_KEY : '');
        setBaseUrl('');
        setSelectedModel(PROVIDER_OPTIONS[0].defaultModels ? PROVIDER_OPTIONS[0].defaultModels[0] : '');
        setCanUserEditKeys(!SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS);
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
      setError("Failed to load settings. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleProviderChange = (newProviderId: ProviderOption['id']) => {
    setSelectedProviderId(newProviderId);
    const newProviderConfig = PROVIDER_OPTIONS.find(p => p.id === newProviderId) || PROVIDER_OPTIONS[0];
    
    if (SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS && !canUserEditKeys) {
        let monarchKey = '';
        if (newProviderId === ProviderTypeEnum.OpenAI) monarchKey = SIMULATED_ENV.MONARCH_OPENAI_API_KEY || '';
        else if (newProviderId === ProviderTypeEnum.Anthropic) monarchKey = SIMULATED_ENV.MONARCH_ANTHROPIC_API_KEY || '';
        else if (newProviderId === ProviderTypeEnum.Gemini) monarchKey = SIMULATED_ENV.MONARCH_GOOGLE_API_KEY || '';
        setApiKey(monarchKey);
    } else {
        setApiKey(''); // Clear API key for user input unless it's a Monarch-provided one
    }
    
    setBaseUrl(newProviderId === ProviderTypeEnum.Ollama ? 'http://localhost:11434' : '');
    setSelectedModel(newProviderConfig.defaultModels ? newProviderConfig.defaultModels[0] : '');
    setCustomModelName('');
    setError(null);
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const finalApiKey = apiKey; // Key being saved is always from the UI input if editable
    const finalBaseUrl = baseUrl;
    const modelToSave = currentProviderConfig.modelInputType === 'dropdown' ? selectedModel : customModelName;

    if (currentProviderConfig.requiresApiKey && !finalApiKey && currentProviderConfig.id !== ProviderTypeEnum.Ollama && currentProviderConfig.id !== 'custom_openai') {
      setError(`${currentProviderConfig.name} API Key is required.`);
      setIsLoading(false);
      return;
    }
    if (currentProviderConfig.requiresBaseUrl && !finalBaseUrl) {
      setError(`${currentProviderConfig.baseUrlLabel || 'Base URL'} is required for ${currentProviderConfig.name}.`);
      setIsLoading(false);
      return;
    }
    if (!modelToSave && (currentProviderConfig.modelInputType === 'text' || (currentProviderConfig.modelInputType === 'dropdown' && currentProviderConfig.defaultModels && currentProviderConfig.defaultModels.length > 0))) {
       // Only require model if it's text input or dropdown has options
      setError(`Model selection is required for ${currentProviderConfig.name}.`);
      setIsLoading(false);
      return;
    }

    try {
      const providerStorageId = selectedProviderId === 'custom_openai' ? ProviderTypeEnum.CustomOpenAI : selectedProviderId as ProviderTypeEnum;
      
      const providerDataToSave: ProviderConfig = {
        type: providerStorageId,
        name: currentProviderConfig.name,
        apiKey: finalApiKey,
        baseUrl: finalBaseUrl,
        modelNames: modelToSave ? [modelToSave] : [], // Store the single selected/entered model
        createdAt: Date.now(),
      };
      
      // For custom_openai, the providerId in storage might be unique (e.g., custom_openai_1)
      // For this simplified version, we'll just use "custom_openai" as the key.
      // If multiple custom providers were needed, a more complex ID generation would be required.
      const effectiveProviderKey = selectedProviderId === 'custom_openai' ? 'custom_openai_main' : selectedProviderId;

      await llmProviderStore.setProvider(effectiveProviderKey, providerDataToSave);
      
      await agentModelStore.setAgentModel(PRIMARY_AGENT_NAME, {
        provider: effectiveProviderKey,
        modelName: modelToSave,
        // Parameters are preset, not user-configurable in this version
      });

      setSuccessMessage("Settings saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error("Failed to save settings:", e);
      setError("Failed to save settings. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleToggleApiKeyVisibility = () => setShowApiKey(prev => !prev);

  const handleUseMyOwnKeysToggle = () => {
    const newCanUserEditKeys = !canUserEditKeys;
    setCanUserEditKeys(newCanUserEditKeys);
    if (newCanUserEditKeys) {
        // User wants to edit, clear any Monarch prefill
        setUseMonarchProvidedKeys(false); // Reflect that user keys are now intended
        setApiKey(''); // Clear for user input
        // Base URL and model might also need resetting depending on desired UX
    } else {
        // User wants to use Monarch keys (if available and SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS is true)
        setUseMonarchProvidedKeys(SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS);
        if (SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS) {
            let monarchKey = '';
            if (selectedProviderId === ProviderTypeEnum.OpenAI) monarchKey = SIMULATED_ENV.MONARCH_OPENAI_API_KEY || '';
            else if (selectedProviderId === ProviderTypeEnum.Anthropic) monarchKey = SIMULATED_ENV.MONARCH_ANTHROPIC_API_KEY || '';
            else if (selectedProviderId === ProviderTypeEnum.Gemini) monarchKey = SIMULATED_ENV.MONARCH_GOOGLE_API_KEY || '';
            setApiKey(monarchKey);
        } else {
            // If Monarch keys are not set to be used in .env, but user toggles off "use my own", it's ambiguous.
            // Default to user needing to input, or show error. For now, allow input.
             setApiKey('');
        }
    }
  };


  const inputClasses = `w-full px-4 py-3 rounded-lg bg-slate-700 border text-slate-100 placeholder-slate-400 transition-colors duration-150 ease-in-out focus:ring-2 focus:outline-none ${isLightMode ? 'border-slate-300 focus:border-blue-500 focus:ring-blue-500' : 'border-slate-600 focus:border-sky-500 focus:ring-sky-500'}`;
  const labelClasses = `block text-sm font-medium mb-1.5 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`;
  const buttonClasses = `w-full sm:w-auto text-base font-medium py-3 px-6 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${isLightMode ? 'focus:ring-offset-white' : 'focus:ring-offset-slate-900'}`;
  const primaryButtonClasses = `${buttonClasses} ${isLightMode ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500' : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white focus:ring-sky-500 shadow-lg hover:shadow-blue-500/50'}`;
  const secondaryButtonClasses = `${buttonClasses} ${isLightMode ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 focus:ring-slate-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-200 focus:ring-slate-500'}`;

  if (isLoading && !selectedProviderId) { // Adjusted loading condition
    return <div className={`p-6 text-center ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>Loading settings...</div>;
  }

  return (
    <div className={`p-6 md:p-8 rounded-xl shadow-2xl ${isLightMode ? 'bg-white' : 'bg-slate-800/70 backdrop-blur-md border border-slate-700'} transition-colors duration-300`}>
      <h2 className={`text-3xl font-semibold mb-8 ${isLightMode ? 'text-slate-800' : 'text-slate-100'}`}>
        AI Model Configuration
      </h2>

      {SIMULATED_ENV.USE_MONARCH_PROVIDED_KEYS && (
        <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${isLightMode ? 'bg-sky-50 border-sky-200' : 'bg-sky-900/50 border-sky-700'} border`}>
            <div>
                <p className={`font-medium ${isLightMode ? 'text-sky-700' : 'text-sky-300'}`}>
                    Monarch Provided Keys are Active
                </p>
                <p className={`text-xs ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}>
                    API keys are managed by Monarch.
                </p>
            </div>
            <label htmlFor="useMonarchKeysToggle" className="flex items-center cursor-pointer">
                <span className={`mr-3 text-sm font-medium ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>Use my own keys</span>
                <div className="relative">
                    <input type="checkbox" id="useMonarchKeysToggle" className="sr-only" checked={canUserEditKeys} onChange={handleUseMyOwnKeysToggle} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${canUserEditKeys ? (isLightMode ? 'bg-blue-500' : 'bg-sky-500') : (isLightMode ? 'bg-slate-300' : 'bg-slate-600')}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${canUserEditKeys ? 'translate-x-full' : ''}`}></div>
                </div>
            </label>
        </div>
      )}


      <div className="space-y-8">
        {/* Provider Selection */}
        <div>
          <label htmlFor="providerSelect" className={labelClasses}>LLM Provider</label>
          <select
            id="providerSelect"
            value={selectedProviderId}
            onChange={(e) => handleProviderChange(e.target.value as ProviderOption['id'])}
            className={inputClasses}
            disabled={isLoading || (useMonarchProvidedKeys && !canUserEditKeys && selectedProviderId !== ProviderTypeEnum.Ollama && selectedProviderId !== 'custom_openai')}
          >
            {PROVIDER_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>

        {/* API Key Input */}
        {currentProviderConfig.requiresApiKey && (
          <div>
            <label htmlFor="apiKeyInput" className={labelClasses}>
              {currentProviderConfig.apiKeyLabel || `${currentProviderConfig.name} API Key`}
            </label>
            <div className="relative">
              <input
                id="apiKeyInput"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${currentProviderConfig.name} API Key`}
                className={`${inputClasses} pr-12`}
                disabled={isLoading || (useMonarchProvidedKeys && !canUserEditKeys)}
              />
              <button
                type="button"
                onClick={handleToggleApiKeyVisibility}
                className={`absolute inset-y-0 right-0 px-4 flex items-center text-sm leading-5 rounded-r-lg transition-colors ${isLightMode ? 'text-slate-500 hover:text-blue-600' : 'text-slate-400 hover:text-sky-400'}`}
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
                disabled={isLoading || (useMonarchProvidedKeys && !canUserEditKeys)}
              >
                {showApiKey ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
              </button>
            </div>
            {currentProviderConfig.id !== ProviderTypeEnum.Ollama && currentProviderConfig.id !== 'custom_openai' && !apiKey && canUserEditKeys && (
                 <p className={`mt-1.5 text-xs ${isLightMode ? 'text-red-600' : 'text-red-400'}`}>API Key is required for {currentProviderConfig.name}.</p>
            )}
          </div>
        )}

        {/* Base URL Input */}
        {currentProviderConfig.requiresBaseUrl && (
          <div>
            <label htmlFor="baseUrlInput" className={labelClasses}>
              {currentProviderConfig.baseUrlLabel || 'API Base URL'}
            </label>
            <input
              id="baseUrlInput"
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={currentProviderConfig.id === ProviderTypeEnum.Ollama ? "e.g., http://localhost:11434" : "Enter API Base URL"}
              className={inputClasses}
              disabled={isLoading || (useMonarchProvidedKeys && !canUserEditKeys && currentProviderConfig.id !== ProviderTypeEnum.Ollama)}
            />
             {currentProviderConfig.id === ProviderTypeEnum.Ollama && (
                <p className={`mt-1.5 text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Default for local Ollama is http://localhost:11434. Ensure Ollama server is running and accessible.</p>
            )}
            {!baseUrl && canUserEditKeys && (
                 <p className={`mt-1.5 text-xs ${isLightMode ? 'text-red-600' : 'text-red-400'}`}>Base URL is required for {currentProviderConfig.name}.</p>
            )}
          </div>
        )}

        {/* Model Selection/Input */}
        <div>
          <label htmlFor="modelInput" className={labelClasses}>Model</label>
          {currentProviderConfig.modelInputType === 'dropdown' && currentProviderConfig.defaultModels ? (
            <select
              id="modelInput"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className={inputClasses}
              disabled={isLoading || (useMonarchProvidedKeys && !canUserEditKeys)}
            >
              {currentProviderConfig.defaultModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          ) : (
            <input
              id="modelInput"
              type="text"
              value={customModelName}
              onChange={(e) => setCustomModelName(e.target.value)}
              placeholder={
                currentProviderConfig.id === ProviderTypeEnum.Ollama 
                ? "e.g., llama3, mistral:latest" 
                : "Enter model name (e.g., custom-model-v1)"
              }
              className={inputClasses}
              disabled={isLoading || (useMonarchProvidedKeys && !canUserEditKeys)}
            />
          )}
           {!selectedModel && !customModelName && canUserEditKeys && (
             <p className={`mt-1.5 text-xs ${isLightMode ? 'text-red-600' : 'text-red-400'}`}>Model is required.</p>
           )}
        </div>

        {/* Save Button and Messages */}
        <div className="pt-4">
          <Button
            onClick={handleSave}
            disabled={isLoading || (useMonarchProvidedKeys && !canUserEditKeys)}
            className={`${primaryButtonClasses} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : <FiSave className="mr-2 h-5 w-5" />}
            Save Configuration
          </Button>

          {error && (
            <div className={`mt-4 p-3 rounded-lg flex items-center text-sm ${isLightMode ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
              <FiAlertCircle className="h-5 w-5 mr-2 shrink-0" />
              {error}
            </div>
          )}
          {successMessage && (
            <div className={`mt-4 p-3 rounded-lg flex items-center text-sm ${isLightMode ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-green-900/50 text-green-300 border border-green-700'}`}>
              <FiCheckCircle className="h-5 w-5 mr-2 shrink-0" />
              {successMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
