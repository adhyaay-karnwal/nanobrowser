import { useState, useEffect } from 'react';
import '@src/Options.css'; // Styles for Options page
import { Button } from '@extension/ui'; // Assuming this is a pre-styled button
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ModelSettings } from './components/ModelSettings'; // This will render the detailed model configurations
import { FiUser, FiGrid, FiLink, FiSettings, FiTwitter, FiSun, FiMoon, FiZap, FiShield, FiLifeBuoy } from 'react-icons/fi'; // Updated icons

type TabId = 'appSettings' | 'integrations' | 'appearance' | 'security' | 'contact';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

// Revised TABS to be more like a typical settings page, bringing back old sections with better UI
const TABS_CONFIG: TabItem[] = [
  { id: 'appSettings', label: 'Model Configuration', icon: FiZap }, // Was 'Models', now more specific
  { id: 'integrations', label: 'Integrations', icon: FiLink }, // For Google Workspace, etc.
  { id: 'appearance', label: 'Appearance', icon: FiSun }, // For theme settings
  { id: 'security', label: 'Security & Privacy', icon: FiShield }, // Was 'Firewall'
  { id: 'contact', label: 'Support', icon: FiLifeBuoy }, // Updated contact
];

// Placeholder components for content sections
const IntegrationsContent = ({ isLightMode }: { isLightMode: boolean }) => {
  const [isWorkspaceConnected, setIsWorkspaceConnected] = useState(false); // Example state

  const handleConnectWorkspace = () => {
    // Placeholder: In a real app, this would initiate OAuth flow
    setIsWorkspaceConnected(true);
    // Example: chrome.runtime.sendMessage({ type: 'INITIATE_GOOGLE_AUTH' });
  };

  const themeClasses = {
    container: isLightMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-slate-100',
    title: isLightMode ? 'text-slate-700' : 'text-slate-100',
    text: isLightMode ? 'text-slate-600' : 'text-slate-300',
    subtleText: isLightMode ? 'text-slate-500' : 'text-slate-400',
    buttonPrimary: isLightMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-sky-600 hover:bg-sky-700 text-white',
    buttonSecondary: isLightMode ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    connectedPill: 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100',
    disconnectedPill: 'bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300',
    listItem: isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-700/50 border-slate-600',
  };

  return (
    <div className={`p-6 md:p-8 rounded-lg shadow-sm ${themeClasses.container}`}>
      <h2 className={`text-2xl font-semibold mb-6 ${themeClasses.title}`}>Google Workspace Integration</h2>
      <p className={`mb-4 text-base ${themeClasses.text}`}>
        Connect Monarch to your Google Workspace to enhance your productivity. Access Gmail, Drive, Calendar, and Contacts seamlessly.
      </p>
      
      {isWorkspaceConnected ? (
        <div className="text-center p-4 rounded-md border border-green-500 bg-green-500/10">
          <p className={`text-lg font-medium mb-2 ${isLightMode ? 'text-green-700' : 'text-green-300'}`}>
            Successfully Connected to Google Workspace!
          </p>
          <Button
            onClick={() => setIsWorkspaceConnected(false)} // Placeholder for disconnect
            className={`w-full max-w-xs mx-auto py-2.5 px-5 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out
              ${isLightMode ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
          >
            Disconnect Google Workspace
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleConnectWorkspace}
          className={`w-full max-w-xs mx-auto py-2.5 px-5 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out
            ${themeClasses.buttonPrimary}`}
        >
          Connect Google Workspace
        </Button>
      )}

      <div className="mt-8 pt-6 border-t_transparent dark:border-slate-700">
        <h3 className={`text-lg font-semibold mb-3 ${themeClasses.title}`}>Permissions Overview:</h3>
        <ul className={`space-y-1.5 text-sm ${themeClasses.subtleText}`}>
          <li>Read Gmail messages (for summarization and drafting).</li>
          <li>Read Google Drive files (for analysis and context).</li>
          <li>Read Google Calendar events (for scheduling).</li>
          <li>Read Google Contacts (for email drafting).</li>
        </ul>
        <p className={`mt-3 text-xs ${themeClasses.subtleText}`}>
          Monarch only accesses data when explicitly requested by you.
        </p>
      </div>
    </div>
  );
};

const AppearanceSettings = ({ isLightMode, toggleTheme }: { isLightMode: boolean, toggleTheme: () => void }) => {
  const themeClasses = {
    container: isLightMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-slate-100',
    title: isLightMode ? 'text-slate-700' : 'text-slate-100',
    text: isLightMode ? 'text-slate-600' : 'text-slate-300',
    button: isLightMode ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    activeButton: isLightMode ? 'bg-blue-600 text-white' : 'bg-sky-600 text-white',
  };
  return (
    <div className={`p-6 md:p-8 rounded-lg shadow-sm ${themeClasses.container}`}>
      <h2 className={`text-2xl font-semibold mb-6 ${themeClasses.title}`}>Appearance</h2>
      <div className="space-y-4">
        <div>
          <h3 className={`text-md font-medium mb-2 ${themeClasses.title}`}>Theme</h3>
          <p className={`text-sm mb-3 ${themeClasses.text}`}>Choose your preferred theme for the Monarch extension.</p>
          <div className="flex space-x-2">
            <Button
              onClick={toggleTheme}
              className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium w-1/2 transition-colors
                ${!isLightMode ? themeClasses.activeButton : themeClasses.button}`}
            >
              <FiMoon className="h-4 w-4" />
              <span>Dark Mode</span>
            </Button>
            <Button
              onClick={toggleTheme}
              className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium w-1/2 transition-colors
                ${isLightMode ? themeClasses.activeButton : themeClasses.button}`}
            >
              <FiSun className="h-4 w-4" />
              <span>Light Mode</span>
            </Button>
          </div>
        </div>
        {/* Add other appearance settings here if needed */}
      </div>
    </div>
  );
};

const SecuritySettings = ({ isLightMode }: { isLightMode: boolean }) => {
   const themeClasses = {
    container: isLightMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-slate-100',
    title: isLightMode ? 'text-slate-700' : 'text-slate-100',
    text: isLightMode ? 'text-slate-600' : 'text-slate-300',
  };
  return (
    <div className={`p-6 md:p-8 rounded-lg shadow-sm ${themeClasses.container}`}>
      <h2 className={`text-2xl font-semibold mb-6 ${themeClasses.title}`}>Security & Privacy</h2>
      <p className={`mb-4 text-base ${themeClasses.text}`}>
        Review your security settings and privacy preferences.
      </p>
      {/* Placeholder for firewall/security settings */}
      <p className={`text-sm ${themeClasses.text}`}>
        Advanced security options and data handling preferences will be available here.
        Monarch prioritizes your privacy. API keys are stored locally in your browser's storage.
      </p>
    </div>
  );
};


const Options = () => {
  const [activeTab, setActiveTab] = useState<TabId>('appSettings');
  // Theme state for the settings page itself, to be consistent with the extension's theme
  const [isLightMode, setIsLightMode] = useState(false); // Default to dark mode for settings page

  useEffect(() => {
    // Attempt to load theme preference from localStorage or chrome.storage
    // For simplicity, this example uses localStorage. A robust solution would use chrome.storage.
    const savedTheme = localStorage.getItem('monarch-theme');
    if (savedTheme === 'light') {
      setIsLightMode(true);
    } else if (savedTheme === 'dark') {
      setIsLightMode(false);
    } else {
      // Fallback to system preference if no theme is saved
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      setIsLightMode(prefersLight);
    }
  }, []);

  const toggleTheme = () => {
    setIsLightMode(prev => {
      const newMode = !prev;
      localStorage.setItem('monarch-theme', newMode ? 'light' : 'dark');
      // You might want to send a message to the background script or side panel
      // to update their themes as well if they don't listen to localStorage changes.
      return newMode;
    });
  };


  const handleTabClick = (tabId: TabId) => {
    if (tabId === 'contact') {
      window.open('https://x.com/AdhyaayK', '_blank');
    } else {
      setActiveTab(tabId);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'appSettings':
        return <ModelSettings isLightMode={isLightMode} />;
      case 'integrations':
        return <IntegrationsContent isLightMode={isLightMode} />;
      case 'appearance':
        return <AppearanceSettings isLightMode={isLightMode} toggleTheme={toggleTheme} />;
      case 'security':
        return <SecuritySettings isLightMode={isLightMode} />;
      default:
        return <ModelSettings isLightMode={isLightMode} />; // Default to appSettings
    }
  };

  // Dynamic styling based on isLightMode
  const containerBg = isLightMode ? 'bg-slate-100' : 'bg-slate-900';
  const textColor = isLightMode ? 'text-slate-800' : 'text-slate-100';
  const sidebarBg = isLightMode ? 'bg-white' : 'bg-slate-800';
  const sidebarBorder = isLightMode ? 'border-slate-200' : 'border-slate-700';
  const activeTabBg = isLightMode ? 'bg-blue-500' : 'bg-sky-600'; // Subtle blue for active
  const activeTabTextColor = 'text-white';
  const inactiveTabTextColor = isLightMode ? 'text-slate-600' : 'text-slate-400';
  const hoverTabBg = isLightMode ? 'hover:bg-slate-200' : 'hover:bg-slate-700';
  const hoverTabTextColor = isLightMode ? 'hover:text-slate-900' : 'hover:text-slate-100';
  const contentAreaBg = isLightMode ? 'bg-slate-50' : 'bg-slate-800/30';


  return (
    <div className={`flex min-h-screen min-w-[768px] ${containerBg} ${textColor} transition-colors duration-300`}>
      {/* Sidebar Navigation */}
      <nav className={`w-60 ${sidebarBg} border-r ${sidebarBorder} flex flex-col shadow-lg transition-colors duration-300`}>
        <div className="p-5">
          <div className="flex items-center mb-8">
            {isLightMode ? (
                <img src={chrome.runtime.getURL('icons/icon-dark.svg')} alt="Monarch Logo" className="h-7 w-7 mr-2.5" />
            ) : (
                <img src={chrome.runtime.getURL('icons/icon-light.svg')} alt="Monarch Logo" className="h-7 w-7 mr-2.5" />
            )}
            <h1 className={`text-xl font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Monarch Settings</h1>
          </div>

          {/* Simplified User Info - No specific name/trial */}
          <div className="mb-8 flex items-center p-3 rounded-md_transparent dark:bg-slate-700/50">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2.5 ${isLightMode ? 'bg-slate-200' : 'bg-slate-700'}`}>
              <FiUser className={`h-4 w-4 ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>User Account</p>
              {/* <p className={`text-xs ${isLightMode ? 'text-blue-600' : 'text-sky-400'}`}>Manage Settings</p> */}
            </div>
          </div>

          <ul className="space-y-1.5">
            {TABS_CONFIG.map(item => (
              <li key={item.id}>
                <Button
                  onClick={() => handleTabClick(item.id)}
                  className={`flex w-full items-center space-x-2.5 rounded-md px-3.5 py-2 text-left text-sm font-medium transition-all duration-150 ease-in-out
                    ${activeTab === item.id
                      ? `${activeTabBg} ${activeTabTextColor} shadow-sm`
                      : `${inactiveTabTextColor} ${hoverTabBg} ${hoverTabTextColor}`
                    }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div className={`mt-auto p-5 border-t ${sidebarBorder} transition-colors duration-300`}>
            <Button
                onClick={toggleTheme}
                className={`flex w-full items-center justify-center space-x-2 rounded-md px-3.5 py-2 text-left text-sm font-medium transition-all duration-150 ease-in-out
                    ${inactiveTabTextColor} ${hoverTabBg} ${hoverTabTextColor}`}
            >
                {isLightMode ? <FiMoon className="h-4 w-4" /> : <FiSun className="h-4 w-4" />}
                <span>{isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</span>
            </Button>
          <p className={`mt-3 text-xs text-center ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>&copy; {new Date().getFullYear()} Monarch</p>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className={`flex-1 ${contentAreaBg} p-6 md:p-8 overflow-y-auto transition-colors duration-300`}>
        <div className="mx-auto max-w-3xl"> 
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
};

const SuspenseFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
    <div className="flex items-center space-x-2">
      <svg className="animate-spin h-5 w-5 text-blue-500 dark:text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Loading Monarch Settings...</span>
    </div>
  </div>
);

const ErrorFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900 text-red-600 dark:text-red-400">
    <div className="text-center p-4">
      <h2 className="text-xl font-semibold mb-2">Oops! Something went wrong.</h2>
      <p className="text-sm">An error occurred while loading the settings page. Please try refreshing the page or contact support if the issue persists.</p>
    </div>
  </div>
);

export default withErrorBoundary(withSuspense(Options, <SuspenseFallback />), <ErrorFallback />);
