/*
 * Changes:
 * - Added a searchable select component with filtering capability for model selection
 * - Implemented keyboard navigation and accessibility for the custom dropdown
 * - Added search functionality that filters models based on user input
 * - Added keyboard event handlers to close dropdowns with Escape key
 * - Styling for both light and dark mode themes
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@extension/ui';
import {
  llmProviderStore,
  agentModelStore,
  speechToTextModelStore,
  AgentNameEnum,
  llmProviderModelNames,
  ProviderTypeEnum,
  getDefaultDisplayNameFromProviderId,
  getDefaultProviderConfig,
  getDefaultAgentModelParams,
  type ProviderConfig,
  type SpeechToTextModelConfig,
} from '@extension/storage';

// Helper function to check if a model is an O-series model
function isOpenAIOModel(modelName: string): boolean {
  if (modelName.startsWith('openai/')) {
    return modelName.startsWith('openai/o');
  }
  return modelName.startsWith('o');
}

interface ModelSettingsProps {
  isDarkMode?: boolean; // Controls dark/light theme styling
}

export const ModelSettings = ({ isDarkMode = false }: ModelSettingsProps) => {
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [modifiedProviders, setModifiedProviders] = useState<Set<string>>(new Set());
  const [providersFromStorage, setProvidersFromStorage] = useState<Set<string>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Record<AgentNameEnum, string>>({
    [AgentNameEnum.Navigator]: '',
    [AgentNameEnum.Planner]: '',
    [AgentNameEnum.Validator]: '',
  });
  const [modelParameters, setModelParameters] = useState<Record<AgentNameEnum, { temperature: number; topP: number }>>({
    [AgentNameEnum.Navigator]: { temperature: 0, topP: 0 },
    [AgentNameEnum.Planner]: { temperature: 0, topP: 0 },
    [AgentNameEnum.Validator]: { temperature: 0, topP: 0 },
  });

  // State for reasoning effort for O-series models
  const [reasoningEffort, setReasoningEffort] = useState<Record<AgentNameEnum, 'low' | 'medium' | 'high' | undefined>>({
    [AgentNameEnum.Navigator]: undefined,
    [AgentNameEnum.Planner]: undefined,
    [AgentNameEnum.Validator]: undefined,
  });
  const [newModelInputs, setNewModelInputs] = useState<Record<string, string>>({});
  const [isProviderSelectorOpen, setIsProviderSelectorOpen] = useState(false);
  const newlyAddedProviderRef = useRef<string | null>(null);
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  // Add state for tracking API key visibility
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});
  // Create a non-async wrapper for use in render functions
  const [availableModels, setAvailableModels] = useState<
    Array<{ provider: string; providerName: string; model: string }>
  >([]);
  // State for model input handling

  const [selectedSpeechToTextModel, setSelectedSpeechToTextModel] = useState<string>('');

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const allProviders = await llmProviderStore.getAllProviders();
        console.log('allProviders', allProviders);

        // Track which providers are from storage
        const fromStorage = new Set(Object.keys(allProviders));
        setProvidersFromStorage(fromStorage);

        // Only use providers from storage, don't add default ones
        setProviders(allProviders);
      } catch (error) {
        console.error('Error loading providers:', error);
        // Set empty providers on error
        setProviders({});
        // No providers from storage on error
        setProvidersFromStorage(new Set());
      }
    };

    loadProviders();
  }, []);

  // Load existing agent models and parameters on mount
  useEffect(() => {
    const loadAgentModels = async () => {
      try {
        const models: Record<AgentNameEnum, string> = {
          [AgentNameEnum.Planner]: '',
          [AgentNameEnum.Navigator]: '',
          [AgentNameEnum.Validator]: '',
        };

        for (const agent of Object.values(AgentNameEnum)) {
          const config = await agentModelStore.getAgentModel(agent);
          if (config) {
            models[agent] = config.modelName;
            if (config.parameters?.temperature !== undefined || config.parameters?.topP !== undefined) {
              setModelParameters(prev => ({
                ...prev,
                [agent]: {
                  temperature: config.parameters?.temperature ?? prev[agent].temperature,
                  topP: config.parameters?.topP ?? prev[agent].topP,
                },
              }));
            }
            // Also load reasoningEffort if available
            if (config.reasoningEffort) {
              setReasoningEffort(prev => ({
                ...prev,
                [agent]: config.reasoningEffort as 'low' | 'medium' | 'high',
              }));
            }
          }
        }
        setSelectedModels(models);
      } catch (error) {
        console.error('Error loading agent models:', error);
      }
    };

    loadAgentModels();
  }, []);

  useEffect(() => {
    const loadSpeechToTextModel = async () => {
      try {
        const config = await speechToTextModelStore.getSpeechToTextModel();
        if (config) {
          setSelectedSpeechToTextModel(`${config.provider}>${config.modelName}`);
        }
      } catch (error) {
        console.error('Error loading speech-to-text model:', error);
      }
    };

    loadSpeechToTextModel();
  }, []);

  // Auto-focus the input field when a new provider is added
  useEffect(() => {
    // Only focus if we have a newly added provider reference
    if (newlyAddedProviderRef.current && providers[newlyAddedProviderRef.current]) {
      const providerId = newlyAddedProviderRef.current;
      const config = providers[providerId];

      // For custom providers, focus on the name input
      if (config.type === ProviderTypeEnum.CustomOpenAI) {
        const nameInput = document.getElementById(`${providerId}-name`);
        if (nameInput) {
          nameInput.focus();
        }
      } else {
        // For default providers, focus on the API key input
        const apiKeyInput = document.getElementById(`${providerId}-api-key`);
        if (apiKeyInput) {
          apiKeyInput.focus();
        }
      }

      // Clear the ref after focusing
      newlyAddedProviderRef.current = null;
    }
  }, [providers]);

  // Add a click outside handler to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isProviderSelectorOpen && !target.closest('.provider-selector-container')) {
        setIsProviderSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProviderSelectorOpen]);

  // Create a memoized version of getAvailableModels
  const getAvailableModelsCallback = useCallback(async () => {
    const models: Array<{ provider: string; providerName: string; model: string }> = [];

    try {
      // Load providers directly from storage
      const storedProviders = await llmProviderStore.getAllProviders();

      // Only use providers that are actually in storage
      for (const [provider, config] of Object.entries(storedProviders)) {
        if (config.type === ProviderTypeEnum.AzureOpenAI) {
          // Handle Azure providers specially - use deployment names as models
          const deploymentNames = config.azureDeploymentNames || [];

          models.push(
            ...deploymentNames.map(deployment => ({
              provider,
              providerName: config.name || provider,
              model: deployment,
            })),
          );
        } else {
          // Standard handling for non-Azure providers
          const providerModels =
            config.modelNames || llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [];
          models.push(
            ...providerModels.map(model => ({
              provider,
              providerName: config.name || provider,
              model,
            })),
          );
        }
      }
    } catch (error) {
      console.error('Error loading providers for model selection:', error);
    }

    return models;
  }, []);

  // Update available models whenever providers change
  useEffect(() => {
    const updateAvailableModels = async () => {
      const models = await getAvailableModelsCallback();
      setAvailableModels(models);
    };

    updateAvailableModels();
  }, [getAvailableModelsCallback]); // Only depends on the callback

  const handleApiKeyChange = (provider: string, apiKey: string, baseUrl?: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));
    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        apiKey: apiKey.trim(),
        baseUrl: baseUrl !== undefined ? baseUrl.trim() : prev[provider]?.baseUrl,
      },
    }));
  };

  // Add a toggle handler for API key visibility
  const toggleApiKeyVisibility = (provider: string) => {
    setVisibleApiKeys(prev => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  const handleNameChange = (provider: string, name: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));
    setProviders(prev => {
      const updated = {
        ...prev,
        [provider]: {
          ...prev[provider],
          name: name.trim(),
        },
      };
      return updated;
    });
  };

  const handleModelsChange = (provider: string, modelsString: string) => {
    setNewModelInputs(prev => ({
      ...prev,
      [provider]: modelsString,
    }));
  };

  const addModel = (provider: string, model: string) => {
    if (!model.trim()) return;

    setModifiedProviders(prev => new Set(prev).add(provider));
    setProviders(prev => {
      const providerData = prev[provider] || {};

      // Get current models - either from provider config or default models
      let currentModels = providerData.modelNames;
      if (currentModels === undefined) {
        currentModels = [...(llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [])];
      }

      // Don't add duplicates
      if (currentModels.includes(model.trim())) return prev;

      return {
        ...prev,
        [provider]: {
          ...providerData,
          modelNames: [...currentModels, model.trim()],
        },
      };
    });

    // Clear the input
    setNewModelInputs(prev => ({
      ...prev,
      [provider]: '',
    }));
  };

  const removeModel = (provider: string, modelToRemove: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));

    setProviders(prev => {
      const providerData = prev[provider] || {};

      // If modelNames doesn't exist in the provider data yet, we need to initialize it
      // with the default models from llmProviderModelNames first
      if (!providerData.modelNames) {
        const defaultModels = llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [];
        const filteredModels = defaultModels.filter(model => model !== modelToRemove);

        return {
          ...prev,
          [provider]: {
            ...providerData,
            modelNames: filteredModels,
          },
        };
      }

      // If modelNames already exists, just filter out the model to remove
      return {
        ...prev,
        [provider]: {
          ...providerData,
          modelNames: providerData.modelNames.filter(model => model !== modelToRemove),
        },
      };
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, provider: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const value = newModelInputs[provider] || '';
      addModel(provider, value);
    }
  };

  const getButtonProps = (provider: string) => {
    const isInStorage = providersFromStorage.has(provider);
    const isModified = modifiedProviders.has(provider);

    // For deletion, we only care if it's in storage and not modified
    if (isInStorage && !isModified) {
      return {
        theme: isDarkMode ? 'dark' : 'light', // This prop might be from @extension/ui
        variant: 'danger' as const,
        children: 'Delete',
        disabled: false,
        className: `bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-150 ease-in-out`,
      };
    }

    // For saving, we need to check if it has the required inputs
    let hasInput = false;
    const providerType = providers[provider]?.type;
    const config = providers[provider];

    if (providerType === ProviderTypeEnum.CustomOpenAI) {
      hasInput = Boolean(config?.baseUrl?.trim()); // Custom needs Base URL, name checked elsewhere
    } else if (providerType === ProviderTypeEnum.Ollama) {
      hasInput = Boolean(config?.baseUrl?.trim()); // Ollama needs Base URL
    } else if (providerType === ProviderTypeEnum.AzureOpenAI) {
      // Azure needs API Key, Endpoint, Deployment Names, and API Version
      hasInput =
        Boolean(config?.apiKey?.trim()) &&
        Boolean(config?.baseUrl?.trim()) &&
        Boolean(config?.azureDeploymentNames?.length) &&
        Boolean(config?.azureApiVersion?.trim());
    } else if (providerType === ProviderTypeEnum.OpenRouter) {
      // OpenRouter needs API Key and optionally Base URL (has default)
      hasInput = Boolean(config?.apiKey?.trim()) && Boolean(config?.baseUrl?.trim());
    } else {
      // Other built-in providers just need API Key
      hasInput = Boolean(config?.apiKey?.trim());
    }

    return {
      theme: isDarkMode ? 'dark' : 'light',
      variant: 'primary' as const,
      children: 'Save',
      disabled: !hasInput || !isModified,
      className: `font-medium py-2 px-4 rounded-lg transition-colors duration-150 ease-in-out ${
        !hasInput || !isModified
          ? isDarkMode ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
      }`,
    };
  };

  const handleSave = async (provider: string) => {
    try {
      // Check if name contains spaces for custom providers
      if (providers[provider].type === ProviderTypeEnum.CustomOpenAI && providers[provider].name?.includes(' ')) {
        setNameErrors(prev => ({
          ...prev,
          [provider]: 'Spaces are not allowed in provider names. Please use underscores or other characters instead.',
        }));
        return;
      }

      // Check if base URL is required but missing for custom_openai, ollama, azure_openai or openrouter
      // Note: Groq and Cerebras do not require base URL as they use the default endpoint
      if (
        (providers[provider].type === ProviderTypeEnum.CustomOpenAI ||
          providers[provider].type === ProviderTypeEnum.Ollama ||
          providers[provider].type === ProviderTypeEnum.AzureOpenAI ||
          providers[provider].type === ProviderTypeEnum.OpenRouter) &&
        (!providers[provider].baseUrl || !providers[provider].baseUrl.trim())
      ) {
        alert(`Base URL is required for ${getDefaultDisplayNameFromProviderId(provider)}. Please enter it.`);
        return;
      }

      // Ensure modelNames is provided
      let modelNames = providers[provider].modelNames;
      if (!modelNames) {
        // Use default model names if not explicitly set
        modelNames = [...(llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [])];
      }

      // Prepare data for saving using the correctly typed config from state
      // We can directly pass the relevant parts of the state config
      // Create a copy to avoid modifying state directly if needed, though setProvider likely handles it
      const configToSave: Partial<ProviderConfig> = { ...providers[provider] }; // Use Partial to allow deleting modelNames

      // Explicitly set required fields that might be missing in partial state updates (though unlikely now)
      configToSave.apiKey = providers[provider].apiKey || '';
      configToSave.name = providers[provider].name || getDefaultDisplayNameFromProviderId(provider);
      configToSave.type = providers[provider].type;
      configToSave.createdAt = providers[provider].createdAt || Date.now();
      // baseUrl, azureDeploymentName, azureApiVersion should be correctly set by handlers

      if (providers[provider].type === ProviderTypeEnum.AzureOpenAI) {
        // Ensure modelNames is NOT included for Azure
        configToSave.modelNames = undefined;
      } else {
        // Ensure modelNames IS included for non-Azure
        // Use existing modelNames from state, or default if somehow missing
        configToSave.modelNames =
          providers[provider].modelNames || llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [];
      }

      // Pass the cleaned config to setProvider
      // Cast to ProviderConfig as we've ensured necessary fields based on type
      await llmProviderStore.setProvider(provider, configToSave as ProviderConfig);

      // Clear any name errors on successful save
      setNameErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[provider];
        return newErrors;
      });

      // Add to providersFromStorage since it's now saved
      setProvidersFromStorage(prev => new Set(prev).add(provider));

      setModifiedProviders(prev => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });

      // Refresh available models
      const models = await getAvailableModelsCallback();
      setAvailableModels(models);
    } catch (error) {
      console.error('Error saving API key:', error);
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      // Delete the provider from storage regardless of its API key value
      await llmProviderStore.removeProvider(provider);

      // Remove from providersFromStorage
      setProvidersFromStorage(prev => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });

      // Remove from providers state
      setProviders(prev => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });

      // Also remove from modifiedProviders if it's there
      setModifiedProviders(prev => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });

      // Refresh available models
      const models = await getAvailableModelsCallback();
      setAvailableModels(models);
    } catch (error) {
      console.error('Error deleting provider:', error);
    }
  };

  const handleCancelProvider = (providerId: string) => {
    // Remove the provider from the state
    setProviders(prev => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });

    // Remove from modified providers
    setModifiedProviders(prev => {
      const next = new Set(prev);
      next.delete(providerId);
      return next;
    });
  };

  const handleModelChange = async (agentName: AgentNameEnum, modelValue: string) => {
    // modelValue will be in format "provider>model"
    const [provider, model] = modelValue.split('>');

    console.log(`[handleModelChange] Setting ${agentName} model: provider=${provider}, model=${model}`);

    // Set parameters based on provider type
    const newParameters = getDefaultAgentModelParams(provider, agentName);

    setModelParameters(prev => ({
      ...prev,
      [agentName]: newParameters,
    }));

    setSelectedModels(prev => ({
      ...prev,
      [agentName]: model,
    }));

    try {
      if (model) {
        const providerConfig = providers[provider];

        // For Azure, verify the model is in the deployment names list
        if (providerConfig && providerConfig.type === ProviderTypeEnum.AzureOpenAI) {
          console.log(`[handleModelChange] Azure model selected: ${model}`);
        }

        // Reset reasoning effort if switching models
        if (isOpenAIOModel(model)) {
          // Keep existing reasoning effort if already set for O-series models
          setReasoningEffort(prev => ({
            ...prev,
            [agentName]: prev[agentName] || 'medium', // Default to medium if not set
          }));
        } else {
          // Clear reasoning effort for non-O-series models
          setReasoningEffort(prev => ({
            ...prev,
            [agentName]: undefined,
          }));
        }

        await agentModelStore.setAgentModel(agentName, {
          provider,
          modelName: model,
          parameters: newParameters,
          reasoningEffort: isOpenAIOModel(model) ? reasoningEffort[agentName] || 'medium' : undefined,
        });
      } else {
        // Reset storage if no model is selected
        await agentModelStore.resetAgentModel(agentName);
      }
    } catch (error) {
      console.error('Error saving agent model:', error);
    }
  };

  const handleReasoningEffortChange = async (agentName: AgentNameEnum, value: 'low' | 'medium' | 'high') => {
    setReasoningEffort(prev => ({
      ...prev,
      [agentName]: value,
    }));

    // Only update if we have a selected model
    if (selectedModels[agentName] && isOpenAIOModel(selectedModels[agentName])) {
      try {
        // Find provider
        const provider = getProviderForModel(selectedModels[agentName]);

        if (provider) {
          await agentModelStore.setAgentModel(agentName, {
            provider,
            modelName: selectedModels[agentName],
            parameters: modelParameters[agentName],
            reasoningEffort: value,
          });
        }
      } catch (error) {
        console.error('Error saving reasoning effort:', error);
      }
    }
  };

  const handleParameterChange = async (agentName: AgentNameEnum, paramName: 'temperature' | 'topP', value: number) => {
    const newParameters = {
      ...modelParameters[agentName],
      [paramName]: value,
    };

    setModelParameters(prev => ({
      ...prev,
      [agentName]: newParameters,
    }));

    // Only update if we have a selected model
    if (selectedModels[agentName]) {
      try {
        // Find provider
        let provider: string | undefined;
        for (const [providerKey, providerConfig] of Object.entries(providers)) {
          if (providerConfig.type === ProviderTypeEnum.AzureOpenAI) {
            // Check Azure deployment names
            const deploymentNames = providerConfig.azureDeploymentNames || [];
            if (deploymentNames.includes(selectedModels[agentName])) {
              provider = providerKey;
              break;
            }
          } else {
            // Check standard model names for non-Azure providers
            const modelNames =
              providerConfig.modelNames ||
              llmProviderModelNames[providerKey as keyof typeof llmProviderModelNames] ||
              [];
            if (modelNames.includes(selectedModels[agentName])) {
              provider = providerKey;
              break;
            }
          }
        }

        if (provider) {
          await agentModelStore.setAgentModel(agentName, {
            provider,
            modelName: selectedModels[agentName],
            parameters: newParameters,
          });
        }
      } catch (error) {
        console.error('Error saving agent parameters:', error);
      }
    }
  };

  const handleSpeechToTextModelChange = async (modelValue: string) => {
    setSelectedSpeechToTextModel(modelValue);

    try {
      if (modelValue) {
        // Parse the "provider>model" format
        const [provider, modelName] = modelValue.split('>');

        // Save to proper storage
        await speechToTextModelStore.setSpeechToTextModel({
          provider,
          modelName,
        });
      } else {
        // Reset if no model selected
        await speechToTextModelStore.resetSpeechToTextModel();
      }
    } catch (error) {
      console.error('Error saving speech-to-text model:', error);
    }
  };

  const renderModelSelect = (agentName: AgentNameEnum) => {
    const tempPercentage = (modelParameters[agentName].temperature / 2) * 100;
    const topPPercentage = modelParameters[agentName].topP * 100;
    const sliderActiveColor = isDarkMode ? '#2563eb' : '#3b82f6'; // blue-600 or blue-500
    const sliderTrackColor = isDarkMode ? '#4b5563' : '#9ca3af'; // slate-600 or gray-400

    return (
    <div
      className={`rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/60 shadow-lg backdrop-blur-sm' : 'border-gray-200 bg-gray-50 shadow-md'} p-6 transition-all duration-200 ease-in-out`}>
      <h3 className={`mb-3 text-xl font-semibold ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
        {agentName.charAt(0).toUpperCase() + agentName.slice(1)}
      </h3>
      <p className={`mb-6 text-sm font-normal ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
        {getAgentDescription(agentName)}
      </p>

      <div className="space-y-6">
        {/* Model Selection */}
        <div className="flex items-center">
          <label
            htmlFor={`${agentName}-model`}
            className={`w-28 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Model
          </label>
          <select
            id={`${agentName}-model`}
            className={`flex-1 rounded-md border text-sm ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'border-gray-300 bg-white text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} px-3 py-2.5 transition-colors duration-150 ease-in-out`}
            disabled={availableModels.length === 0}
            value={
              selectedModels[agentName]
                ? `${getProviderForModel(selectedModels[agentName])}>${selectedModels[agentName]}`
                : ''
            }
            onChange={e => handleModelChange(agentName, e.target.value)}>
            <option key="default" value="">
              Choose model
            </option>
            {availableModels.map(({ provider, providerName, model }) => (
              <option key={`${provider}>${model}`} value={`${provider}>${model}`}>\
                {`${providerName} > ${model}`}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature Slider */}
        <div className="flex items-center">
          <label
            htmlFor={`${agentName}-temperature`}
            className={`w-28 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Temperature
          </label>
          <div className="flex flex-1 items-center space-x-3">
            <input
              id={`${agentName}-temperature`}
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={modelParameters[agentName].temperature}
              onChange={e => handleParameterChange(agentName, 'temperature', Number.parseFloat(e.target.value))}
              style={{
                background: `linear-gradient(to right, ${sliderActiveColor} 0%, ${sliderActiveColor} ${tempPercentage}%, ${sliderTrackColor} ${tempPercentage}%, ${sliderTrackColor} 100%)`,
              }}
              className={`flex-1 h-2 appearance-none rounded-full cursor-pointer ${isDarkMode ? `accent-blue-500` : `accent-blue-600`}`}
            />
            <div className="flex items-center space-x-2">
              <span className={`w-12 text-sm tabular-nums ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                {modelParameters[agentName].temperature.toFixed(2)}
              </span>
              <input
                type="number"
                min="0"
                max="2"
                step="0.01"
                value={modelParameters[agentName].temperature}
                onChange={e => {
                  const value = Number.parseFloat(e.target.value);
                  if (!Number.isNaN(value) && value >= 0 && value <= 2) {
                    handleParameterChange(agentName, 'temperature', value);
                  }
                }}
                className={`w-20 rounded-md border text-sm ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'border-gray-300 bg-white text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} px-2 py-1.5 transition-colors duration-150 ease-in-out`}
                aria-label={`${agentName} temperature number input`}
              />
            </div>
          </div>
        </div>

        {/* Top P Slider */}
        <div className="flex items-center">
          <label
            htmlFor={`${agentName}-topP`}
            className={`w-28 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Top P
          </label>
          <div className="flex flex-1 items-center space-x-3">
            <input
              id={`${agentName}-topP`}
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={modelParameters[agentName].topP}
              onChange={e => handleParameterChange(agentName, 'topP', Number.parseFloat(e.target.value))}
              style={{
                background: `linear-gradient(to right, ${sliderActiveColor} 0%, ${sliderActiveColor} ${topPPercentage}%, ${sliderTrackColor} ${topPPercentage}%, ${sliderTrackColor} 100%)`,
              }}
              className={`flex-1 h-2 appearance-none rounded-full cursor-pointer ${isDarkMode ? `accent-blue-500` : `accent-blue-600`}`}
            />
            <div className="flex items-center space-x-2">
              <span className={`w-12 text-sm tabular-nums ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                {modelParameters[agentName].topP.toFixed(3)}
              </span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={modelParameters[agentName].topP}
                onChange={e => {
                  const value = Number.parseFloat(e.target.value);
                  if (!Number.isNaN(value) && value >= 0 && value <= 1) {
                    handleParameterChange(agentName, 'topP', value);
                  }
                }}
                className={`w-20 rounded-md border text-sm ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'border-gray-300 bg-white text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} px-2 py-1.5 transition-colors duration-150 ease-in-out`}
                aria-label={`${agentName} top P number input`}
              />
            </div>
          </div>
        </div>

        {/* Reasoning Effort Selector (only for O-series models) */}
        {selectedModels[agentName] && isOpenAIOModel(selectedModels[agentName]) && (
          <div className="flex items-center">
            <label
              htmlFor={`${agentName}-reasoning-effort`}
              className={`w-28 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Reasoning
            </label>
            <div className="flex flex-1 items-center space-x-2">
              <select
                id={`${agentName}-reasoning-effort`}
                value={reasoningEffort[agentName] || 'medium'}
                onChange={e => handleReasoningEffortChange(agentName, e.target.value as 'low' | 'medium' | 'high')}
                className={`flex-1 rounded-md border text-sm ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'border-gray-300 bg-white text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} px-3 py-2.5 transition-colors duration-150 ease-in-out`}>
                <option value="low">Low (Faster)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (More thorough)</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )};

  const getAgentDescription = (agentName: AgentNameEnum) => {
    switch (agentName) {
      case AgentNameEnum.Navigator:
        return 'Navigates websites and performs actions like clicking, typing, and extracting information.';
      case AgentNameEnum.Planner:
        return 'Develops and refines strategies to accomplish complex tasks by breaking them into manageable steps.';
      case AgentNameEnum.Validator:
        return 'Checks if tasks are completed successfully and accurately according to the initial request.';
      default:
        return '';
    }
  };

  const getMaxCustomProviderNumber = () => {
    let maxNumber = 0;
    for (const providerId of Object.keys(providers)) {
      if (providerId.startsWith('custom_openai_')) {
        const match = providerId.match(/custom_openai_(\d+)/);
        if (match) {
          const number = Number.parseInt(match[1], 10);
          maxNumber = Math.max(maxNumber, number);
        }
      }
    }
    return maxNumber;
  };

  const addCustomProvider = () => {
    const nextNumber = getMaxCustomProviderNumber() + 1;
    const providerId = `custom_openai_${nextNumber}`;

    setProviders(prev => ({
      ...prev,
      [providerId]: {
        apiKey: '',
        name: `CustomProvider${nextNumber}`,
        type: ProviderTypeEnum.CustomOpenAI,
        baseUrl: '',
        modelNames: [],
        createdAt: Date.now(),
      },
    }));

    setModifiedProviders(prev => new Set(prev).add(providerId));

    // Set the newly added provider ref
    newlyAddedProviderRef.current = providerId;

    // Scroll to the newly added provider after render
    setTimeout(() => {
      const providerElement = document.getElementById(`provider-${providerId}`);
      if (providerElement) {
        providerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const addBuiltInProvider = (provider: string) => {
    // Get the default provider configuration
    const config = getDefaultProviderConfig(provider);

    // Add the provider to the state
    setProviders(prev => ({
      ...prev,
      [provider]: config,
    }));

    // Mark as modified so it shows up in the UI
    setModifiedProviders(prev => new Set(prev).add(provider));

    // Set the newly added provider ref
    newlyAddedProviderRef.current = provider;

    // Scroll to the newly added provider after render
    setTimeout(() => {
      const providerElement = document.getElementById(`provider-${provider}`);
      if (providerElement) {
        providerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Sort providers to ensure newly added providers appear at the bottom
  const getSortedProviders = () => {
    // Filter providers to only include those from storage and newly added providers
    const filteredProviders = Object.entries(providers).filter(([providerId, config]) => {
      // ALSO filter out any provider missing a config or type, to satisfy TS
      if (!config || !config.type) {
        console.warn(`Filtering out provider ${providerId} with missing config or type.`);
        return false;
      }

      // Include if it's from storage
      if (providersFromStorage.has(providerId)) {
        return true;
      }

      // Include if it's a newly added provider (has been modified)
      if (modifiedProviders.has(providerId)) {
        return true;
      }

      // Exclude providers that aren't from storage and haven't been modified
      return false;
    });

    // Sort the filtered providers
    return filteredProviders.sort(([keyA, configA], [keyB, configB]) => {
      // Separate newly added providers from stored providers
      const isNewA = !providersFromStorage.has(keyA) && modifiedProviders.has(keyA);
      const isNewB = !providersFromStorage.has(keyB) && modifiedProviders.has(keyB);

      // If one is new and one is stored, new ones go to the end
      if (isNewA && !isNewB) return 1;
      if (!isNewA && isNewB) return -1;

      // If both are new or both are stored, sort by createdAt
      if (configA.createdAt && configB.createdAt) {
        return configA.createdAt - configB.createdAt; // Sort in ascending order (oldest first)
      }

      // If only one has createdAt, put the one without createdAt at the end
      if (configA.createdAt) return -1;
      if (configB.createdAt) return 1;

      // If neither has createdAt, sort by type and then name
      const isCustomA = configA.type === ProviderTypeEnum.CustomOpenAI;
      const isCustomB = configB.type === ProviderTypeEnum.CustomOpenAI;

      if (isCustomA && !isCustomB) {
        return 1; // Custom providers come after non-custom
      }

      if (!isCustomA && isCustomB) {
        return -1; // Non-custom providers come before custom
      }

      // Sort alphabetically by name within each group
      return (configA.name || keyA).localeCompare(configB.name || keyB);
    });
  };

  const handleProviderSelection = (providerType: string) => {
    // Close the dropdown immediately
    setIsProviderSelectorOpen(false);

    // Handle custom provider
    if (providerType === ProviderTypeEnum.CustomOpenAI) {
      addCustomProvider();
      return;
    }

    // Handle Azure OpenAI specially to allow multiple instances
    if (providerType === ProviderTypeEnum.AzureOpenAI) {
      addAzureProvider();
      return;
    }

    // Handle built-in supported providers
    addBuiltInProvider(providerType);
  };

  // New function to add Azure providers with unique IDs
  const addAzureProvider = () => {
    // Count existing Azure providers
    const azureProviders = Object.keys(providers).filter(
      key => key === ProviderTypeEnum.AzureOpenAI || key.startsWith(`${ProviderTypeEnum.AzureOpenAI}_`),
    );
    const nextNumber = azureProviders.length + 1;

    // Create unique ID
    const providerId =
      nextNumber === 1 ? ProviderTypeEnum.AzureOpenAI : `${ProviderTypeEnum.AzureOpenAI}_${nextNumber}`;

    // Create config with appropriate name
    const config = getDefaultProviderConfig(ProviderTypeEnum.AzureOpenAI);
    config.name = `Azure OpenAI ${nextNumber}`;

    // Add to providers
    setProviders(prev => ({
      ...prev,
      [providerId]: config,
    }));

    setModifiedProviders(prev => new Set(prev).add(providerId));
    newlyAddedProviderRef.current = providerId;

    // Scroll to the newly added provider after render
    setTimeout(() => {
      const providerElement = document.getElementById(`provider-${providerId}`);
      if (providerElement) {
        providerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const getProviderForModel = (modelName: string): string => {
    for (const [provider, config] of Object.entries(providers)) {
      // Check Azure deployment names
      if (config.type === ProviderTypeEnum.AzureOpenAI) {
        const deploymentNames = config.azureDeploymentNames || [];
        if (deploymentNames.includes(modelName)) {
          return provider;
        }
      } else {
        // Check regular model names for non-Azure providers
        const modelNames =
          config.modelNames || llmProviderModelNames[provider as keyof typeof llmProviderModelNames] || [];
        if (modelNames.includes(modelName)) {
          return provider;
        }
      }
    }
    return '';
  };

  // Add and remove Azure deployments
  const addAzureDeployment = (provider: string, deploymentName: string) => {
    if (!deploymentName.trim()) return;

    setModifiedProviders(prev => new Set(prev).add(provider));
    setProviders(prev => {
      const providerData = prev[provider] || {};

      // Initialize or use existing deploymentNames array
      const deploymentNames = providerData.azureDeploymentNames || [];

      // Don't add duplicates
      if (deploymentNames.includes(deploymentName.trim())) return prev;

      return {
        ...prev,
        [provider]: {
          ...providerData,
          azureDeploymentNames: [...deploymentNames, deploymentName.trim()],
        },
      };
    });

    // Clear the input
    setNewModelInputs(prev => ({
      ...prev,
      [provider]: '',
    }));
  };

  const removeAzureDeployment = (provider: string, deploymentToRemove: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));

    setProviders(prev => {
      const providerData = prev[provider] || {};

      // Get current deployments
      const deploymentNames = providerData.azureDeploymentNames || [];

      // Filter out the deployment to remove
      const filteredDeployments = deploymentNames.filter(name => name !== deploymentToRemove);

      return {
        ...prev,
        [provider]: {
          ...providerData,
          azureDeploymentNames: filteredDeployments,
        },
      };
    });
  };

  const handleAzureApiVersionChange = (provider: string, apiVersion: string) => {
    setModifiedProviders(prev => new Set(prev).add(provider));
    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        azureApiVersion: apiVersion.trim(),
      },
    }));
  };

  return (
    <section className="space-y-8">
      {/* LLM Providers Section */}
      <div
        className={`rounded-xl shadow-2xl ${isDarkMode ? 'border border-slate-700 bg-slate-800/70' : 'border border-gray-200 bg-gray-50'} p-6 text-left transition-all duration-200 ease-in-out`}>
        <h2 className={`mb-6 text-2xl font-semibold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>
          LLM Providers
        </h2>
        <div className="space-y-8">
          {getSortedProviders().length === 0 ? (
            <div className={`py-8 text-center ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              <p className="mb-4">No providers configured yet. Add a provider to get started.</p>
            </div>
          ) : (
            getSortedProviders().map(([providerId, providerConfig]) => {
              // Add type guard to satisfy TypeScript
              if (!providerConfig || !providerConfig.type) {
                console.warn(`Skipping rendering for providerId ${providerId} due to missing config or type`);
                return null; // Skip rendering this item if config/type is somehow missing
              }
              const buttonProps = getButtonProps(providerId);

              return (
                <div
                  key={providerId}
                  id={`provider-${providerId}`}
                  className={`space-y-4 rounded-xl p-6 shadow-xl transition-all duration-300 ease-in-out ${
                    modifiedProviders.has(providerId) && !providersFromStorage.has(providerId) 
                      ? isDarkMode ? 'border border-blue-500 bg-blue-950/40' : 'border border-blue-300 bg-blue-50/70'
                      : isDarkMode ? 'border border-slate-700 bg-slate-800 hover:border-blue-600/70' : 'border border-gray-200 bg-white hover:border-blue-300/70'
                  }`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                      {providerConfig.name || providerId}
                    </h3>
                    <div className="flex space-x-3">
                      {/* Show Cancel button for newly added providers */}
                      {modifiedProviders.has(providerId) && !providersFromStorage.has(providerId) && (
                        <Button 
                          variant="secondary" 
                          onClick={() => handleCancelProvider(providerId)}
                          className={`font-medium py-2 px-4 rounded-lg transition-colors duration-150 ease-in-out ${isDarkMode ? 'bg-slate-600 hover:bg-slate-500 text-slate-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                          >
                          Cancel
                        </Button>
                      )}
                      <Button
                        // variant={buttonProps.variant} // Use className for full control
                        disabled={buttonProps.disabled}
                        className={buttonProps.className}
                        onClick={() =>
                          providersFromStorage.has(providerId) && !modifiedProviders.has(providerId)
                            ? handleDelete(providerId)
                            : handleSave(providerId)
                        }>
                        {buttonProps.children}
                      </Button>
                    </div>
                  </div>

                  {/* Show message for newly added providers */}
                  {modifiedProviders.has(providerId) && !providersFromStorage.has(providerId) && (
                    <div className={`mb-2 text-sm ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>
                      <p>This provider is newly added. Please configure and save.</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Name input (only for custom_openai) - moved to top for prominence */}
                    {providerConfig.type === ProviderTypeEnum.CustomOpenAI && (
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <label
                            htmlFor={`${providerId}-name`}
                            className={`w-24 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                            Name
                          </label>
                          <input
                            id={`${providerId}-name`}
                            type="text"
                            placeholder="Provider name (e.g., MyCustomLLM)"
                            value={providerConfig.name || ''}
                            onChange={e => {
                              console.log('Name input changed:', e.target.value);
                              handleNameChange(providerId, e.target.value);
                            }}
                            className={`flex-1 rounded-md border p-2.5 text-sm outline-none transition-colors duration-150 ease-in-out ${
                              nameErrors[providerId]
                                ? isDarkMode
                                  ? 'border-red-500 bg-slate-700 text-slate-100 placeholder-slate-400 focus:border-red-400 focus:ring-1 focus:ring-red-400'
                                  : 'border-red-400 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                                : isDarkMode
                                  ? 'border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                  : 'border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                            }`}
                          />
                        </div>
                        {nameErrors[providerId] ? (
                          <p className={`ml-24 mt-1 text-xs ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
                            {nameErrors[providerId]}
                          </p>
                        ) : (
                          <p className={`ml-24 mt-1 text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>
                            Custom provider name (no spaces allowed).
                          </p>
                        )}\n                      </div>
                    )}

                    {/* API Key input with label */}
                    <div className="flex items-center">
                      <label
                        htmlFor={`${providerId}-api-key`}
                        className={`w-24 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                        API Key
                        {/* Show asterisk only if required */}
                        {providerConfig.type !== ProviderTypeEnum.CustomOpenAI &&
                        providerConfig.type !== ProviderTypeEnum.Ollama
                          ? <span className="text-red-500 ml-1">*</span>
                          : ''}
                      </label>
                      <div className="relative flex-1">
                        <input
                          id={`${providerId}-api-key`}
                          type={visibleApiKeys[providerId] ? 'text' : 'password'}
                          placeholder={
                            providerConfig.type === ProviderTypeEnum.CustomOpenAI
                              ? `API key (optional)`
                              : providerConfig.type === ProviderTypeEnum.Ollama
                                ? `API Key (leave empty for Ollama)`
                                : `API key (required)`
                          }
                          value={providerConfig.apiKey || ''}
                          onChange={e => handleApiKeyChange(providerId, e.target.value, providerConfig.baseUrl)}
                          className={`w-full rounded-md border p-2.5 text-sm outline-none transition-colors duration-150 ease-in-out ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                        />
                        <button
                          type="button"
                          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors duration-150 ease-in-out ${
                            isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                          }`}
                          onClick={() => toggleApiKeyVisibility(providerId)}
                          aria-label={visibleApiKeys[providerId] ? 'Hide API key' : 'Show API key'}>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="size-5"
                            aria-hidden="true">
                            <title>{visibleApiKeys[providerId] ? 'Hide API key' : 'Show API key'}</title>
                            {visibleApiKeys[providerId] ? (
                              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                            ) : (
                              <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38c-.352-.988-.997-1.874-1.82-2.58L15.17 9.83a1.5 1.5 0 00-2.121-2.121L11.202 5.875a10.029 10.029 0 00-4.38-3.3L5.034 3.28 3.28 2.22zM7.06 7.06c.21-.21.452-.393.713-.545l1.328 1.328a2.5 2.5 0 00-1.483 1.483L7.06 7.06z" clipRule="evenodd" />
                            )}
                             <path d="M10 5a.75.75 0 01.75.75v.036a3.98 3.98 0 014.464 4.464V10.5A4.5 4.5 0 0110.5 15H10a4.5 4.5 0 01-4.5-4.5v-.25A4.5 4.5 0 0110 5zm0 1.5A2.5 2.5 0 007.5 9v.25A2.5 2.5 0 0010 11.75h.25A2.5 2.5 0 0012.75 9.5V9A2.5 2.5 0 0010 6.5z" />

                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Base URL input (for custom_openai, ollama, azure_openai, and openrouter) */}
                    {(providerConfig.type === ProviderTypeEnum.CustomOpenAI ||
                      providerConfig.type === ProviderTypeEnum.Ollama ||
                      providerConfig.type === ProviderTypeEnum.AzureOpenAI ||
                      providerConfig.type === ProviderTypeEnum.OpenRouter) && (
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <label
                            htmlFor={`${providerId}-base-url`}
                            className={`w-24 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                            {providerConfig.type === ProviderTypeEnum.AzureOpenAI ? 'Endpoint' : 'Base URL'}
                            {(providerConfig.type === ProviderTypeEnum.CustomOpenAI ||
                              providerConfig.type === ProviderTypeEnum.Ollama || // Ollama also requires it
                              providerConfig.type === ProviderTypeEnum.AzureOpenAI)
                              ? <span className="text-red-500 ml-1">*</span>
                              : ''}
                          </label>
                          <input
                            id={`${providerId}-base-url`}
                            type="text"
                            placeholder={
                              providerConfig.type === ProviderTypeEnum.CustomOpenAI
                                ? 'Required OpenAI-compatible API endpoint'
                                : providerConfig.type === ProviderTypeEnum.AzureOpenAI
                                  ? 'https://YOUR_RESOURCE_NAME.openai.azure.com/'
                                  : providerConfig.type === ProviderTypeEnum.OpenRouter
                                    ? 'OpenRouter Base URL (defaults to https://openrouter.ai/api/v1)'
                                    : 'Ollama base URL (e.g. http://localhost:11434)'
                            }
                            value={providerConfig.baseUrl || ''}
                            onChange={e => handleApiKeyChange(providerId, providerConfig.apiKey || '', e.target.value)}
                            className={`flex-1 rounded-md border p-2.5 text-sm outline-none transition-colors duration-150 ease-in-out ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Azure Deployment Name input as tags/chips */}
                    {(providerConfig.type as ProviderTypeEnum) === ProviderTypeEnum.AzureOpenAI && (
                      <div className="flex items-start">
                        <label
                          htmlFor={`${providerId}-azure-deployment`}
                          className={`w-24 pt-2.5 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                          Deployment<span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="flex-1 space-y-2">
                          <div
                            className={`flex min-h-[44px] flex-wrap items-center gap-2 rounded-md border ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-gray-300 bg-white text-gray-700'} p-2`}>
                            {(providerConfig.azureDeploymentNames || []).map((deploymentName: string) => (
                                  <div
                                    key={deploymentName}
                                    className={`flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${isDarkMode ? 'bg-blue-700/80 text-blue-100' : 'bg-blue-100 text-blue-800'}`}>
                                    <span>{deploymentName}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeAzureDeployment(providerId, deploymentName)}
                                      className={`ml-1.5 font-bold transition-colors duration-150 ease-in-out ${isDarkMode ? 'text-blue-200 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
                                      aria-label={`Remove ${deploymentName}`}>
                                      ×
                                    </button>
                                  </div>
                                ))}
                            <input
                              id={`${providerId}-azure-deployment-input`}
                              type="text"
                              placeholder="Add deployment name..."
                              value={newModelInputs[providerId] || ''}
                              onChange={e => handleModelsChange(providerId, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  const value = newModelInputs[providerId] || '';
                                  if (value.trim()) {
                                    addAzureDeployment(providerId, value.trim());
                                    setNewModelInputs(prev => ({ ...prev, [providerId]: '' }));
                                  }
                                }
                              }}
                              className={`min-w-[150px] flex-1 border-none p-1 text-sm outline-none ${isDarkMode ? 'bg-transparent text-slate-100 placeholder-slate-400' : 'bg-transparent text-gray-700 placeholder-gray-400'}`}
                            />
                          </div>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>
                            Type model name (e.g., gpt-4o) and press Enter or Space.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Azure API Version input */}
                    {(providerConfig.type as ProviderTypeEnum) === ProviderTypeEnum.AzureOpenAI && (
                      <div className="flex items-center">
                        <label
                          htmlFor={`${providerId}-azure-version`}
                          className={`w-24 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                          API Version<span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          id={`${providerId}-azure-version`}
                          type="text"
                          placeholder="e.g., 2024-02-15-preview"
                          value={providerConfig.azureApiVersion || ''}
                          onChange={e => handleAzureApiVersionChange(providerId, e.target.value)}
                          className={`flex-1 rounded-md border p-2.5 text-sm outline-none transition-colors duration-150 ease-in-out ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                        />
                      </div>
                    )}

                    {/* Models input section (for non-Azure providers) */}
                    {(providerConfig.type as ProviderTypeEnum) !== ProviderTypeEnum.AzureOpenAI && (
                      <div className="flex items-start">
                        <label
                          htmlFor={`${providerId}-models-label`}
                          className={`w-24 pt-2.5 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                          Models
                        </label>
                        <div className="flex-1 space-y-2">
                          <div
                            className={`flex min-h-[44px] flex-wrap items-center gap-2 rounded-md border ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-gray-300 bg-white text-gray-700'} p-2`}>
                            {(() => {
                                  const models =
                                    providerConfig.modelNames !== undefined
                                      ? providerConfig.modelNames
                                      : llmProviderModelNames[providerId as keyof typeof llmProviderModelNames] || [];
                                  if (models.length === 0 && providerConfig.type !== ProviderTypeEnum.OpenRouter) {
                                      return <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>Default models will be used. Add specific models if needed.</span>;
                                  }
                                  return models.map(model => (
                                    <div
                                      key={model}
                                      className={`flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${isDarkMode ? 'bg-blue-700/80 text-blue-100' : 'bg-blue-100 text-blue-800'}`}>
                                      <span>{model}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeModel(providerId, model)}
                                        className={`ml-1.5 font-bold transition-colors duration-150 ease-in-out ${isDarkMode ? 'text-blue-200 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
                                        aria-label={`Remove ${model}`}>
                                        ×
                                      </button>
                                    </div>
                                  ));
                                })()}
                            <input
                              id={`${providerId}-models-input`}
                              type="text"
                              placeholder="Add model name..."
                              value={newModelInputs[providerId] || ''}
                              onChange={e => handleModelsChange(providerId, e.target.value)}
                              onKeyDown={e => handleKeyDown(e, providerId)}
                              className={`min-w-[150px] flex-1 border-none p-1 text-sm outline-none ${isDarkMode ? 'bg-transparent text-slate-100 placeholder-slate-400' : 'bg-transparent text-gray-700 placeholder-gray-400'}`}
                            />
                          </div>
                           <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>
                                Type model name and press Enter or Space to add.
                           </p>
                        </div>
                      </div>
                    )}

                    {/* Ollama reminder at the bottom of the section */}
                    {providerConfig.type === ProviderTypeEnum.Ollama && (
                      <div
                        className={`mt-4 rounded-lg border ${isDarkMode ? 'border-slate-600 bg-slate-700/60' : 'border-blue-100 bg-blue-50'} p-4`}>
                        <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                          <strong>Remember:</strong> Add{' '}
                          <code
                            className={`rounded px-1.5 py-0.5 font-mono text-xs ${isDarkMode ? 'bg-slate-600 text-amber-300' : 'bg-blue-100 text-amber-700'}`}>
                            OLLAMA_ORIGINS=chrome-extension://*
                          </code>{' '}
                          environment variable for the Ollama server.
                          <a
                            href="https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-expose-ollama-on-my-network"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`ml-1 underline transition-colors duration-150 ease-in-out ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}>
                            Learn more
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Add Provider button and dropdown */}
          <div className="provider-selector-container relative pt-6">
            <Button
              variant="secondary" // This might be overridden by className
              onClick={() => setIsProviderSelectorOpen(prev => !prev)}
              className={`flex w-full items-center justify-center py-3 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out ${
                isDarkMode
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-md hover:shadow-lg'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-md hover:shadow-lg'
              }`}>
              <span className="mr-2 text-base">+</span> Add New Provider
            </Button>

            {isProviderSelectorOpen && (
              <div
                className={`absolute z-10 mt-2 w-full overflow-hidden rounded-lg border shadow-2xl ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-800'
                    : 'border-gray-200 bg-white'
                }`}>
                <div className="py-1">
                  {Object.values(ProviderTypeEnum)
                    .filter(
                      type =>
                        type === ProviderTypeEnum.AzureOpenAI || 
                        (type !== ProviderTypeEnum.CustomOpenAI &&
                          !providersFromStorage.has(type) &&
                          !modifiedProviders.has(type)),
                    )
                    .map(type => (
                      <button
                        key={type}
                        type="button"
                        className={`flex w-full items-center px-4 py-3 text-left text-sm transition-colors duration-150 ease-in-out ${
                          isDarkMode
                            ? 'text-slate-200 hover:bg-blue-700/60 hover:text-white'
                            : 'text-gray-700 hover:bg-blue-100 hover:text-blue-800'
                        }`}
                        onClick={() => handleProviderSelection(type)}>
                        <span className="font-medium">{getDefaultDisplayNameFromProviderId(type)}</span>
                      </button>
                    ))}

                  <button
                    type="button"
                    className={`flex w-full items-center px-4 py-3 text-left text-sm transition-colors duration-150 ease-in-out ${
                      isDarkMode
                        ? 'text-slate-200 hover:bg-blue-700/60 hover:text-white'
                        : 'text-gray-700 hover:bg-blue-100 hover:text-blue-800'
                    }`}
                    onClick={() => handleProviderSelection(ProviderTypeEnum.CustomOpenAI)}>
                    <span className="font-medium">OpenAI-compatible API Provider</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Models Section */}
      <div
        className={`rounded-xl shadow-2xl ${isDarkMode ? 'border border-slate-700 bg-slate-800/70' : 'border border-gray-200 bg-gray-50'} p-6 text-left transition-all duration-200 ease-in-out`}>
        <h2 className={`mb-6 text-2xl font-semibold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>
          Agent Model Configuration
        </h2>
        <div className="space-y-6">
          {[AgentNameEnum.Planner, AgentNameEnum.Navigator, AgentNameEnum.Validator].map(agentName => (
            <div key={agentName}>{renderModelSelect(agentName)}</div>
          ))}
        </div>
      </div>

      {/* Speech-to-Text Model Selection */}
      <div
        className={`rounded-xl shadow-2xl ${isDarkMode ? 'border border-slate-700 bg-slate-800/70' : 'border border-gray-200 bg-gray-50'} p-6 text-left transition-all duration-200 ease-in-out`}>
        <h2 className={`mb-4 text-2xl font-semibold ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>
          Speech-to-Text Model
        </h2>
        <p className={`mb-6 text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
          Configure the model used for converting speech to text when using the microphone feature. Currently supports Gemini models.
        </p>

        <div
          className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-gray-50'} p-6`}>
          <div className="flex items-center">
            <label
              htmlFor="speech-to-text-model"
              className={`w-24 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              Model
            </label>
            <select
              id="speech-to-text-model"
              className={`flex-1 rounded-md border text-sm ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' : 'border-gray-300 bg-white text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} px-3 py-2.5 transition-colors duration-150 ease-in-out`}
              value={selectedSpeechToTextModel}
              onChange={e => handleSpeechToTextModelChange(e.target.value)}>
              <option value="">Choose Model</option>
              {availableModels
                .filter(({ provider }) => { // Removed model from filter as it's not used
                  const providerConfig = providers[provider];
                  return providerConfig?.type === ProviderTypeEnum.Gemini;
                })
                .map(({ provider, providerName, model }) => (
                  <option key={`${provider}>${model}`} value={`${provider}>${model}`}>\
                    {`${providerName} > ${model}`}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
};
