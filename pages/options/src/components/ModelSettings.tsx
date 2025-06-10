import { useEffect, useState, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@extension/ui';
import {
  llmProviderStore,
  agentModelStore,
  speechToTextModelStore,
  AgentNameEnum,
  llmProviderModelNames, // This contains default model lists for known providers
  ProviderTypeEnum,
  getDefaultDisplayNameFromProviderId,
  getDefaultProviderConfig,
  getDefaultAgentModelParams,
  type ProviderConfig,
  type SpeechToTextModelConfig,
} from '@extension/storage';
import { FiSave, FiTrash2, FiPlusCircle, FiEye, FiEyeOff, FiChevronDown, FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi';

// Helper function to check if a model is an O-series model (OpenAI specific logic, might need adjustment)
function isOpenAIOModel(modelName: string): boolean {
  if (!modelName) return false;
  // Example: openai/o1-preview, o1-mini-latest etc.
  // This is a simplified check. A more robust check might involve checking the provider as well.
  return modelName.toLowerCase().includes('o1-') || modelName.toLowerCase().includes('o-series');
}

// Updated Gemini Models
const updatedLlmProviderModelNames = {
  ...llmProviderModelNames,
  [ProviderTypeEnum.Gemini]: [
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash-latest',
    'gemini-2.0-pro', // Added
    'gemini-2.0-flash', // Added
    'gemini-1.0-pro',
    // Add other specific Gemini versions if needed
  ],
};


interface ModelSettingsProps {
  isLightMode: boolean;
}

export const ModelSettings = ({ isLightMode }: ModelSettingsProps) => {
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [modifiedProviders, setModifiedProviders] = useState<Set<string>>(new Set());
  const [providersFromStorage, setProvidersFromStorage] = useState<Set<string>>(new Set());

  const defaultAgentSettings = Object.values(AgentNameEnum).reduce((acc, agent) => {
    acc[agent] = { model: '', temperature: 0.7, topP: 1.0, reasoningEffort: 'medium' as 'low' | 'medium' | 'high' | undefined };
    return acc;
  }, {} as Record<AgentNameEnum, { model: string; temperature: number; topP: number; reasoningEffort?: 'low' | 'medium' | 'high' }>);

  const [agentSettings, setAgentSettings] = useState(defaultAgentSettings);
  
  const [newModelInputs, setNewModelInputs] = useState<Record<string, string>>({});
  const [isProviderSelectorOpen, setIsProviderSelectorOpen] = useState(false);
  const newlyAddedProviderRef = useRef<string | null>(null);
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});
  
  const [availableModelsForSelection, setAvailableModelsForSelection] = useState<Array<{ provider: string; providerName: string; model: string }>>([]);
  const [selectedSpeechToTextModel, setSelectedSpeechToTextModel] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Styling classes based on theme ---
  const cardClasses = isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800 border-slate-700 shadow-xl';
  const titleClasses = isLightMode ? 'text-slate-700' : 'text-slate-100';
  const labelClasses = isLightMode ? 'text-slate-600' : 'text-slate-300';
  const inputClasses = `w-full px-3 py-2 rounded-md border text-sm transition-colors duration-150 ease-in-out focus:ring-2 focus:outline-none ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/50' : 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-sky-500 focus:ring-sky-500/50'}`;
  const selectClasses = inputClasses;
  const buttonPrimaryClasses = `inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${isLightMode ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 focus:ring-offset-slate-100' : 'bg-sky-600 hover:bg-sky-700 text-white focus:ring-sky-500 focus:ring-offset-slate-800'}`;
  const buttonSecondaryClasses = `inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md border transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${isLightMode ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 focus:ring-blue-500 focus:ring-offset-slate-100' : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600 focus:ring-sky-500 focus:ring-offset-slate-800'}`;
  const buttonDangerClasses = `inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${isLightMode ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 focus:ring-offset-slate-100' : 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 focus:ring-offset-slate-800'}`;
  const textMutedClasses = isLightMode ? 'text-slate-500' : 'text-slate-400';
  const sliderTrackBg = isLightMode ? 'bg-slate-200' : 'bg-slate-600';
  const sliderThumbBg = isLightMode ? 'bg-blue-600' : 'bg-sky-500';
  const errorAlertClasses = `p-3 rounded-md flex items-center text-sm ${isLightMode ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-red-900/50 text-red-300 border border-red-700'}`;
  const successAlertClasses = `p-3 rounded-md flex items-center text-sm ${isLightMode ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-green-900/50 text-green-300 border border-green-700'}`;


  const loadProviderSettings = useCallback(async () => {
    try {
      const allProviders = await llmProviderStore.getAllProviders();
      setProvidersFromStorage(new Set(Object.keys(allProviders)));
      setProviders(allProviders);
    } catch (e) {
      console.error('Error loading providers:', e);
      setError('Failed to load provider settings.');
      setProviders({});
      setProvidersFromStorage(new Set());
    }
  }, []);

  const loadAgentAndSpeechSettings = useCallback(async () => {
    try {
      const loadedAgentSettings = { ...defaultAgentSettings };
      for (const agent of Object.values(AgentNameEnum)) {
        const config = await agentModelStore.getAgentModel(agent);
        if (config) {
          loadedAgentSettings[agent].model = config.provider && config.modelName ? `${config.provider}>${config.modelName}` : '';
          loadedAgentSettings[agent].temperature = config.parameters?.temperature ?? defaultAgentSettings[agent].temperature;
          loadedAgentSettings[agent].topP = config.parameters?.topP ?? defaultAgentSettings[agent].topP;
          loadedAgentSettings[agent].reasoningEffort = config.reasoningEffort ?? defaultAgentSettings[agent].reasoningEffort;
        }
      }
      setAgentSettings(loadedAgentSettings);

      const speechConfig = await speechToTextModelStore.getSpeechToTextModel();
      if (speechConfig && speechConfig.provider && speechConfig.modelName) {
        setSelectedSpeechToTextModel(`${speechConfig.provider}>${speechConfig.modelName}`);
      }
    } catch (e) {
      console.error('Error loading agent or speech settings:', e);
      setError('Failed to load agent or speech model settings.');
    }
  }, []);
  
  const refreshAvailableModelsForSelection = useCallback(async () => {
    const models: Array<{ provider: string; providerName: string; model: string }> = [];
    const currentProviders = await llmProviderStore.getAllProviders(); // Fetch current state of providers
    for (const [providerId, config] of Object.entries(currentProviders)) {
      if (config.type === ProviderTypeEnum.AzureOpenAI) {
        (config.azureDeploymentNames || []).forEach(deployment => {
          models.push({ provider: providerId, providerName: config.name || providerId, model: deployment });
        });
      } else {
        const providerModelList = config.modelNames || updatedLlmProviderModelNames[config.type as keyof typeof updatedLlmProviderModelNames] || [];
        providerModelList.forEach(model => {
          models.push({ provider: providerId, providerName: config.name || providerId, model });
        });
      }
    }
    setAvailableModelsForSelection(models);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      loadProviderSettings(),
      loadAgentAndSpeechSettings()
    ]).then(() => {
      refreshAvailableModelsForSelection();
    }).catch((e) => {
      // Error handling is done within individual load functions
    }).finally(() => {
      setIsLoading(false);
    });
  }, [loadProviderSettings, loadAgentAndSpeechSettings, refreshAvailableModelsForSelection]);


  useEffect(() => {
    if (newlyAddedProviderRef.current && providers[newlyAddedProviderRef.current]) {
      const providerId = newlyAddedProviderRef.current;
      const config = providers[providerId];
      const inputToFocus = config.type === ProviderTypeEnum.CustomOpenAI ? `${providerId}-name` : `${providerId}-api-key`;
      document.getElementById(inputToFocus)?.focus();
      newlyAddedProviderRef.current = null;
    }
  }, [providers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isProviderSelectorOpen && !(event.target as HTMLElement).closest('.provider-selector-container')) {
        setIsProviderSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProviderSelectorOpen]);


  const handleProviderConfigChange = (providerId: string, field: keyof ProviderConfig, value: any) => {
    setModifiedProviders(prev => new Set(prev).add(providerId));
    setProviders(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], [field]: typeof value === 'string' ? value.trim() : value },
    }));
    if (field === 'name' && providers[providerId]?.type === ProviderTypeEnum.CustomOpenAI) {
        setNameErrors(prev => ({...prev, [providerId]: ''})); // Clear name error on change
    }
  };
  
  const toggleApiKeyVisibility = (providerId: string) => setVisibleApiKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));

  const handleModelsTagChange = (providerId: string, modelsString: string) => {
    setNewModelInputs(prev => ({ ...prev, [providerId]: modelsString }));
  };

  const addModelTag = (providerId: string, model: string) => {
    if (!model.trim()) return;
    handleProviderConfigChange(providerId, 'modelNames', [...(providers[providerId]?.modelNames || []), model.trim()]);
    setNewModelInputs(prev => ({ ...prev, [providerId]: '' }));
  };

  const removeModelTag = (providerId: string, modelToRemove: string) => {
    handleProviderConfigChange(providerId, 'modelNames', (providers[providerId]?.modelNames || []).filter(m => m !== modelToRemove));
  };
  
  const handleModelTagKeyDown = (e: KeyboardEvent<HTMLInputElement>, providerId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      addModelTag(providerId, newModelInputs[providerId] || '');
    }
  };

  const handleSaveProvider = async (providerId: string) => {
    setError(null); setSuccessMessage(null);
    const config = providers[providerId];
    if (!config) return;

    if (config.type === ProviderTypeEnum.CustomOpenAI && config.name?.includes(' ')) {
      setNameErrors(prev => ({ ...prev, [providerId]: 'Spaces are not allowed in custom provider names.' }));
      return;
    }
    if ((config.type === ProviderTypeEnum.CustomOpenAI || config.type === ProviderTypeEnum.Ollama || config.type === ProviderTypeEnum.AzureOpenAI || config.type === ProviderTypeEnum.OpenRouter) && !config.baseUrl?.trim()) {
      setError(`Base URL is required for ${config.name || getDefaultDisplayNameFromProviderId(providerId)}.`);
      return;
    }
     if (config.type === ProviderTypeEnum.AzureOpenAI && (!config.azureDeploymentNames?.length || !config.azureApiVersion?.trim())) {
      setError(`Azure Deployment Name(s) and API Version are required for ${config.name}.`);
      return;
    }
    if (config.type !== ProviderTypeEnum.Ollama && config.type !== ProviderTypeEnum.CustomOpenAI && !config.apiKey?.trim() && config.type !== ProviderTypeEnum.AzureOpenAI && config.type !== ProviderTypeEnum.OpenRouter) {
         // For Azure/OpenRouter, API key is required but might be optional for CustomOpenAI if baseUrl handles auth
        if(config.type === ProviderTypeEnum.AzureOpenAI || config.type === ProviderTypeEnum.OpenRouter){
             if(!config.apiKey?.trim()){
                setError(`API Key is required for ${config.name}.`);
                return;
             }
        } else if (config.type !== ProviderTypeEnum.CustomOpenAI && !config.apiKey?.trim()){
            // Standard providers require API key
            setError(`API Key is required for ${config.name}.`);
            return;
        }
    }


    setIsLoading(true);
    try {
      const configToSave = { ...config, createdAt: config.createdAt || Date.now() };
      if (config.type !== ProviderTypeEnum.AzureOpenAI && !configToSave.modelNames) {
        configToSave.modelNames = [...(updatedLlmProviderModelNames[config.type as keyof typeof updatedLlmProviderModelNames] || [])];
      }
      await llmProviderStore.setProvider(providerId, configToSave);
      setProvidersFromStorage(prev => new Set(prev).add(providerId));
      setModifiedProviders(prev => { const next = new Set(prev); next.delete(providerId); return next; });
      setNameErrors(prev => { const next = { ...prev }; delete next[providerId]; return next; });
      await refreshAvailableModelsForSelection();
      setSuccessMessage(`${config.name || providerId} settings saved successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error('Error saving provider:', e);
      setError(`Failed to save ${config.name || providerId} settings.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    setError(null); setSuccessMessage(null); setIsLoading(true);
    try {
      await llmProviderStore.removeProvider(providerId);
      setProvidersFromStorage(prev => { const next = new Set(prev); next.delete(providerId); return next; });
      setModifiedProviders(prev => { const next = new Set(prev); next.delete(providerId); return next; });
      setProviders(prev => { const next = { ...prev }; delete next[providerId]; return next; });
      await refreshAvailableModelsForSelection();
      setSuccessMessage(`Provider ${getDefaultDisplayNameFromProviderId(providerId)} deleted.`);
       setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error('Error deleting provider:', e);
      setError(`Failed to delete provider ${getDefaultDisplayNameFromProviderId(providerId)}.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCancelProviderChanges = (providerId: string) => {
    // This function is for newly added providers that haven't been saved yet.
    setProviders(prev => { const next = { ...prev }; delete next[providerId]; return next; });
    setModifiedProviders(prev => { const next = new Set(prev); next.delete(providerId); return next; });
    setNameErrors(prev => { const next = { ...prev }; delete next[providerId]; return next; });
  };
  
  const handleAddNewProvider = (type: ProviderTypeEnum | 'custom_openai_new') => {
    setIsProviderSelectorOpen(false);
    let providerId = type as string;
    let config;

    if (type === 'custom_openai_new') {
      providerId = `${ProviderTypeEnum.CustomOpenAI}_${Date.now()}`; // Ensure unique ID
      config = getDefaultProviderConfig(ProviderTypeEnum.CustomOpenAI);
      config.name = `My Custom Provider ${Object.keys(providers).filter(k => k.startsWith(ProviderTypeEnum.CustomOpenAI)).length + 1}`;
    } else if (type === ProviderTypeEnum.AzureOpenAI) {
       const azureProviders = Object.keys(providers).filter(k => k === ProviderTypeEnum.AzureOpenAI || k.startsWith(`${ProviderTypeEnum.AzureOpenAI}_`));
       const nextNumber = azureProviders.length + 1;
       providerId = nextNumber === 1 ? ProviderTypeEnum.AzureOpenAI : `${ProviderTypeEnum.AzureOpenAI}_${nextNumber}`;
       config = getDefaultProviderConfig(ProviderTypeEnum.AzureOpenAI);
       config.name = `Azure OpenAI ${nextNumber}`;
    } else {
      config = getDefaultProviderConfig(type as ProviderTypeEnum);
    }
    
    setProviders(prev => ({ ...prev, [providerId]: config }));
    setModifiedProviders(prev => new Set(prev).add(providerId));
    newlyAddedProviderRef.current = providerId;
    setTimeout(() => document.getElementById(`provider-${providerId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  const handleAgentSettingChange = async (agentName: AgentNameEnum, field: keyof typeof defaultAgentSettings.planner, value: any) => {
    setAgentSettings(prev => ({
      ...prev,
      [agentName]: { ...prev[agentName], [field]: value },
    }));

    // Debounce saving or save on blur/explicit save button if performance is an issue
    const currentFullSetting = { ...agentSettings[agentName], [field]: value };
    const [provider, modelName] = currentFullSetting.model.split('>');
    
    if (provider && modelName) {
      try {
        await agentModelStore.setAgentModel(agentName, {
          provider,
          modelName,
          parameters: { temperature: currentFullSetting.temperature, topP: currentFullSetting.topP },
          reasoningEffort: isOpenAIOModel(modelName) ? currentFullSetting.reasoningEffort : undefined,
        });
         setSuccessMessage(`${agentName} settings updated.`);
         setTimeout(() => setSuccessMessage(null), 2000);
      } catch (e) {
        console.error(`Error saving ${agentName} settings:`, e);
        setError(`Failed to save ${agentName} settings.`);
      }
    } else if (!currentFullSetting.model) { // If model is cleared, reset it
        try {
            await agentModelStore.resetAgentModel(agentName);
            setSuccessMessage(`${agentName} model selection cleared.`);
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (e) {
            console.error(`Error resetting ${agentName} model:`, e);
            setError(`Failed to clear ${agentName} model selection.`);
        }
    }
  };
  
  const handleSpeechToTextModelChange = async (modelValue: string) => {
    setSelectedSpeechToTextModel(modelValue);
    try {
      if (modelValue) {
        const [provider, modelName] = modelValue.split('>');
        await speechToTextModelStore.setSpeechToTextModel({ provider, modelName });
      } else {
        await speechToTextModelStore.resetSpeechToTextModel();
      }
      setSuccessMessage('Speech-to-text model updated.');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (e) {
      console.error('Error saving speech-to-text model:', e);
      setError('Failed to save speech-to-text model.');
    }
  };

  const getSortedProviderKeys = () => {
    return Object.keys(providers).sort((aKey, bKey) => {
      const a = providers[aKey];
      const b = providers[bKey];
      const isNewA = !providersFromStorage.has(aKey) && modifiedProviders.has(aKey);
      const isNewB = !providersFromStorage.has(bKey) && modifiedProviders.has(bKey);
      if (isNewA && !isNewB) return 1;
      if (!isNewA && isNewB) return -1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  };
  
  const renderSlider = (agentName: AgentNameEnum, param: 'temperature' | 'topP', min: number, max: number, step: number) => {
    const value = agentSettings[agentName][param];
    const percentage = param === 'temperature' ? (value / max) * 100 : (value / max) * 100; // Adjusted for topP if max is 1
    const sliderStyle = {
      background: `linear-gradient(to right, ${isLightMode ? '#3b82f6' : '#38bdf8'} 0%, ${isLightMode ? '#3b82f6' : '#38bdf8'} ${percentage}%, ${isLightMode ? '#e2e8f0' : '#4b5563'} ${percentage}%, ${isLightMode ? '#e2e8f0' : '#4b5563'} 100%)`,
    };

    return (
        <div className="flex items-center space-x-3">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={e => handleAgentSettingChange(agentName, param, parseFloat(e.target.value))}
                style={sliderStyle}
                className={`flex-grow h-2 appearance-none rounded-full cursor-pointer ${sliderThumbBg}`}
            />
            <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={value.toFixed(param === 'topP' ? 3 : 2)}
                onChange={e => {
                    const numValue = parseFloat(e.target.value);
                    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
                        handleAgentSettingChange(agentName, param, numValue);
                    }
                }}
                className={`${inputClasses} w-20 text-center py-1`}
            />
        </div>
    );
};


  const providerTypesForSelector = Object.values(ProviderTypeEnum)
    .filter(type => type !== ProviderTypeEnum.CustomOpenAI); // Custom is handled separately

  return (
    <div className={`space-y-8 p-0 md:p-0 ${isLightMode ? 'text-slate-900' : 'text-slate-100'}`}>
      {isLoading && <div className={`p-4 text-center ${textMutedClasses}`}>Loading settings...</div>}
      {error && <div className={errorAlertClasses}><FiAlertCircle className="h-5 w-5 mr-2 shrink-0" />{error}</div>}
      {successMessage && <div className={successAlertClasses}><FiCheckCircle className="h-5 w-5 mr-2 shrink-0" />{successMessage}</div>}

      {/* LLM Providers Section */}
      <section className={`p-6 rounded-lg border ${cardClasses}`}>
        <h2 className={`text-xl font-semibold mb-6 ${titleClasses}`}>LLM Providers</h2>
        <div className="space-y-6">
          {getSortedProviderKeys().map(providerId => {
            const config = providers[providerId];
            if (!config || !config.type) return null;
            const isNewlyAdded = !providersFromStorage.has(providerId) && modifiedProviders.has(providerId);
            return (
              <div key={providerId} id={`provider-${providerId}`} className={`p-4 rounded-md border space-y-3 ${isLightMode ? (isNewlyAdded ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200') : (isNewlyAdded ? 'bg-sky-900/30 border-sky-700' : 'bg-slate-700/50 border-slate-600')}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-medium ${isLightMode ? 'text-blue-700' : 'text-sky-400'}`}>{config.name || getDefaultDisplayNameFromProviderId(providerId)}</h3>
                  <div className="flex space-x-2">
                    {isNewlyAdded && <Button onClick={() => handleCancelProviderChanges(providerId)} className={buttonSecondaryClasses}>Cancel</Button>}
                    <Button onClick={() => providersFromStorage.has(providerId) && !modifiedProviders.has(providerId) ? handleDeleteProvider(providerId) : handleSaveProvider(providerId)} className={providersFromStorage.has(providerId) && !modifiedProviders.has(providerId) ? buttonDangerClasses : buttonPrimaryClasses} disabled={isLoading}>
                      {providersFromStorage.has(providerId) && !modifiedProviders.has(providerId) ? <FiTrash2 className="mr-1.5 h-4 w-4"/> : <FiSave className="mr-1.5 h-4 w-4"/>}
                      {providersFromStorage.has(providerId) && !modifiedProviders.has(providerId) ? 'Delete' : 'Save'}
                    </Button>
                  </div>
                </div>

                {config.type === ProviderTypeEnum.CustomOpenAI && (
                  <div>
                    <label htmlFor={`${providerId}-name`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>Provider Name</label>
                    <input id={`${providerId}-name`} type="text" value={config.name || ''} onChange={e => handleProviderConfigChange(providerId, 'name', e.target.value)} className={`${inputClasses} ${nameErrors[providerId] ? (isLightMode ? 'border-red-400 focus:border-red-500' : 'border-red-500 focus:border-red-400') : ''}`} />
                    {nameErrors[providerId] && <p className={`text-xs mt-1 ${isLightMode ? 'text-red-600' : 'text-red-400'}`}>{nameErrors[providerId]}</p>}
                  </div>
                )}

                {(config.type !== ProviderTypeEnum.Ollama || (config.type === ProviderTypeEnum.Ollama && config.apiKey)) && ( // Show API key for all except default Ollama
                    <div>
                        <label htmlFor={`${providerId}-api-key`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>
                            API Key {config.type !== ProviderTypeEnum.Ollama && config.type !== ProviderTypeEnum.CustomOpenAI && <span className="text-red-500">*</span>}
                        </label>
                        <div className="relative">
                        <input id={`${providerId}-api-key`} type={visibleApiKeys[providerId] ? 'text' : 'password'} value={config.apiKey || ''} onChange={e => handleProviderConfigChange(providerId, 'apiKey', e.target.value)} placeholder={config.type === ProviderTypeEnum.Ollama ? "Optional for Ollama" : "Enter API Key"} className={`${inputClasses} pr-10`} />
                        <button type="button" onClick={() => toggleApiKeyVisibility(providerId)} className={`absolute inset-y-0 right-0 px-3 flex items-center ${textMutedClasses} hover:${isLightMode ? 'text-slate-700' : 'text-slate-200'}`} aria-label={visibleApiKeys[providerId] ? "Hide API key" : "Show API key"}>
                            {visibleApiKeys[providerId] ? <FiEyeOff className="h-4 w-4"/> : <FiEye className="h-4 w-4"/>}
                        </button>
                        </div>
                    </div>
                )}
                
                {(config.type === ProviderTypeEnum.CustomOpenAI || config.type === ProviderTypeEnum.Ollama || config.type === ProviderTypeEnum.AzureOpenAI || config.type === ProviderTypeEnum.OpenRouter) && (
                  <div>
                    <label htmlFor={`${providerId}-base-url`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>
                      {config.type === ProviderTypeEnum.AzureOpenAI ? 'Endpoint URL' : 'Base URL'} <span className="text-red-500">*</span>
                    </label>
                    <input id={`${providerId}-base-url`} type="text" value={config.baseUrl || ''} onChange={e => handleProviderConfigChange(providerId, 'baseUrl', e.target.value)} placeholder={config.type === ProviderTypeEnum.Ollama ? "e.g., http://localhost:11434" : "https://api.example.com/v1"} className={inputClasses} />
                  </div>
                )}

                {config.type === ProviderTypeEnum.AzureOpenAI && (
                  <>
                    <div>
                      <label htmlFor={`${providerId}-azure-deployments`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>Deployment Names <span className="text-red-500">*</span></label>
                      {/* Simplified: For Azure, modelNames array stores deployment names */}
                      <div className={`flex flex-wrap gap-2 p-2 rounded-md border ${inputClasses.replace('w-full', '')}`}>
                         {(config.modelNames || []).map(name => (
                           <div key={name} className={`flex items-center text-xs px-2 py-0.5 rounded-full ${isLightMode ? 'bg-blue-100 text-blue-700' : 'bg-sky-700 text-sky-100'}`}>
                             {name}
                             <button onClick={() => removeModelTag(providerId, name)} className="ml-1.5 font-bold">&times;</button>
                           </div>
                         ))}
                         <input
                           type="text"
                           value={newModelInputs[providerId] || ''}
                           onChange={e => handleModelsTagChange(providerId, e.target.value)}
                           onKeyDown={e => handleModelTagKeyDown(e, providerId)}
                           placeholder="Add deployment..."
                           className={`flex-grow p-0.5 text-sm bg-transparent outline-none min-w-[100px] ${isLightMode ? 'placeholder-slate-400' : 'placeholder-slate-500'}`}
                         />
                       </div>
                    </div>
                    <div>
                      <label htmlFor={`${providerId}-azure-apiversion`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>API Version <span className="text-red-500">*</span></label>
                      <input id={`${providerId}-azure-apiversion`} type="text" value={config.azureApiVersion || ''} onChange={e => handleProviderConfigChange(providerId, 'azureApiVersion', e.target.value)} placeholder="e.g., 2024-02-15-preview" className={inputClasses} />
                    </div>
                  </>
                )}

                {config.type !== ProviderTypeEnum.AzureOpenAI && (
                     <div>
                       <label htmlFor={`${providerId}-models`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>Models</label>
                       <div className={`flex flex-wrap gap-2 p-2 rounded-md border ${inputClasses.replace('w-full', '')}`}>
                         {(config.modelNames || updatedLlmProviderModelNames[config.type as keyof typeof updatedLlmProviderModelNames] || []).map(name => (
                           <div key={name} className={`flex items-center text-xs px-2 py-0.5 rounded-full ${isLightMode ? 'bg-blue-100 text-blue-700' : 'bg-sky-700 text-sky-100'}`}>
                             {name}
                             <button onClick={() => removeModelTag(providerId, name)} className="ml-1.5 font-bold">&times;</button>
                           </div>
                         ))}
                         <input
                           type="text"
                           value={newModelInputs[providerId] || ''}
                           onChange={e => handleModelsTagChange(providerId, e.target.value)}
                           onKeyDown={e => handleModelTagKeyDown(e, providerId)}
                           placeholder="Add model..."
                           className={`flex-grow p-0.5 text-sm bg-transparent outline-none min-w-[100px] ${isLightMode ? 'placeholder-slate-400' : 'placeholder-slate-500'}`}
                         />
                       </div>
                       <p className={`text-xs mt-1 ${textMutedClasses}`}>Default models are used if none are specified. Type and press Enter/Space to add.</p>
                     </div>
                )}
                {config.type === ProviderTypeEnum.Ollama && (
                    <div className={`mt-2 p-2 rounded-md text-xs ${isLightMode ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-900/50 text-amber-300 border border-amber-700'}`}>
                        <FiInfo className="inline mr-1 h-3 w-3" /> Remember to set <code className="text-xs">OLLAMA_ORIGINS=chrome-extension://*</code> for your Ollama server.
                    </div>
                )}
              </div>
            );
          })}
          <div className="provider-selector-container relative pt-4">
            <Button onClick={() => setIsProviderSelectorOpen(prev => !prev)} className={`${buttonPrimaryClasses} w-full`}>
              <FiPlusCircle className="mr-2 h-5 w-5" /> Add New Provider
            </Button>
            {isProviderSelectorOpen && (
              <div className={`absolute z-10 mt-1 w-full rounded-md shadow-lg border ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-700 border-slate-600'} max-h-60 overflow-y-auto`}>
                {providerTypesForSelector.map(type => (
                  <button key={type} onClick={() => handleAddNewProvider(type)} className={`block w-full text-left px-4 py-2 text-sm ${isLightMode ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-600'}`}>
                    {getDefaultDisplayNameFromProviderId(type)}
                  </button>
                ))}
                <button onClick={() => handleAddNewProvider('custom_openai_new')} className={`block w-full text-left px-4 py-2 text-sm ${isLightMode ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-600'}`}>
                  Custom OpenAI-Compatible
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Agent Model Configuration Section */}
      <section className={`p-6 rounded-lg border ${cardClasses}`}>
        <h2 className={`text-xl font-semibold mb-6 ${titleClasses}`}>Agent Model Configuration</h2>
        <div className="space-y-6">
          {Object.values(AgentNameEnum).map(agentName => (
            <div key={agentName} className={`p-4 rounded-md border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-700/50 border-slate-600'}`}>
              <h3 className={`text-lg font-medium mb-3 ${isLightMode ? 'text-blue-700' : 'text-sky-400'}`}>{agentName.charAt(0).toUpperCase() + agentName.slice(1)} Agent</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor={`${agentName}-model`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>Model</label>
                  <select id={`${agentName}-model`} value={agentSettings[agentName].model} onChange={e => handleAgentSettingChange(agentName, 'model', e.target.value)} className={selectClasses} disabled={availableModelsForSelection.length === 0}>
                    <option value="">Select Model</option>
                    {availableModelsForSelection.map(({ provider, providerName, model }) => (
                      <option key={`${provider}>${model}`} value={`${provider}>${model}`}>{`${providerName} > ${model}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${agentName}-temperature`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>Temperature ({agentSettings[agentName].temperature.toFixed(2)})</label>
                  {renderSlider(agentName, 'temperature', 0, 2, 0.01)}
                </div>
                <div>
                  <label htmlFor={`${agentName}-topP`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>Top P ({agentSettings[agentName].topP.toFixed(3)})</label>
                  {renderSlider(agentName, 'topP', 0, 1, 0.001)}
                </div>
                {isOpenAIOModel(agentSettings[agentName].model.split('>')[1]) && (
                  <div>
                    <label htmlFor={`${agentName}-reasoning`} className={`block text-sm font-medium mb-1 ${labelClasses}`}>Reasoning Effort</label>
                    <select id={`${agentName}-reasoning`} value={agentSettings[agentName].reasoningEffort || 'medium'} onChange={e => handleAgentSettingChange(agentName, 'reasoningEffort', e.target.value)} className={selectClasses}>
                      <option value="low">Low (Faster)</option>
                      <option value="medium">Medium (Balanced)</option>
                      <option value="high">High (More Thorough)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* Speech-to-Text Model Section */}
      <section className={`p-6 rounded-lg border ${cardClasses}`}>
        <h2 className={`text-xl font-semibold mb-4 ${titleClasses}`}>Speech-to-Text Model</h2>
        <p className={`text-sm mb-4 ${textMutedClasses}`}>Configure the model for voice input. Currently supports Gemini models.</p>
         <div>
            <label htmlFor="speech-model" className={`block text-sm font-medium mb-1 ${labelClasses}`}>Model</label>
            <select id="speech-model" value={selectedSpeechToTextModel} onChange={e => handleSpeechToTextModelChange(e.target.value)} className={selectClasses} disabled={availableModelsForSelection.filter(m => m.provider.startsWith(ProviderTypeEnum.Gemini)).length === 0}>
                <option value="">Select Gemini Model for Speech</option>
                {availableModelsForSelection
                    .filter(({ provider }) => providers[provider]?.type === ProviderTypeEnum.Gemini) // Filter by type from current providers state
                    .map(({ provider, providerName, model }) => (
                        <option key={`${provider}>${model}`} value={`${provider}>${model}`}>{`${providerName} > ${model}`}</option>
                ))}
            </select>
        </div>
      </section>
    </div>
  );
};
