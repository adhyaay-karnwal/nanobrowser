import { useState } from 'react';
import '@src/Options.css';
import { Button } from '@extension/ui';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { GeneralSettings } from './components/GeneralSettings';
import { ModelSettings } from './components/ModelSettings';
import { FirewallSettings } from './components/FirewallSettings';

type TabTypes = 'general' | 'models' | 'workspace' | 'firewall' | 'help';

const TABS: { id: TabTypes; icon: string; label: string }[] = [
  { id: 'general', icon: '⚙️', label: 'General' },
  { id: 'models', icon: '📊', label: 'Models' },
  { id: 'workspace', icon: '🏢', label: 'Workspace' },
  { id: 'firewall', icon: '🔒', label: 'Firewall' },
  { id: 'help', icon: '📚', label: 'Help' },
];

// Placeholder for Workspace Settings component
const WorkspaceSettings = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className={`p-6 rounded-lg shadow-xl ${isDarkMode ? 'bg-slate-800/70 text-slate-100' : 'bg-white text-gray-800'}`}>
    <h2 className={`text-3xl font-semibold mb-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>Workspace Integration</h2>
    <p className="mb-4 text-lg">
      Connect Monarch to your Google Workspace to supercharge your productivity.
    </p>
    <p className="mb-6 text-slate-300">
      Enable seamless access to your Gmail, Google Drive, Calendar, and Contacts. Monarch can help you draft emails, summarize documents, schedule meetings, and much more, all within your browser.
    </p>
    <Button className={`w-full py-3 text-lg font-medium ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg transition-colors duration-150`}>
      Connect Google Workspace
    </Button>
    <div className="mt-8">
      <h3 className="text-xl font-semibold mb-3 text-slate-200">Connected Services:</h3>
      <ul className="space-y-2 text-slate-300">
        {/* Placeholder for connected services list */}
        <li className="flex items-center"><span className="w-3 h-3 mr-2 rounded-full bg-red-500"></span>Gmail (Not Connected)</li>
        <li className="flex items-center"><span className="w-3 h-3 mr-2 rounded-full bg-red-500"></span>Google Drive (Not Connected)</li>
        <li className="flex items-center"><span className="w-3 h-3 mr-2 rounded-full bg-red-500"></span>Google Calendar (Not Connected)</li>
      </ul>
    </div>
  </div>
);


const Options = () => {
  const [activeTab, setActiveTab] = useState<TabTypes>('models');
  const isDarkMode = true; // Default to dark mode and enforce it

  const handleTabClick = (tabId: TabTypes) => {
    if (tabId === 'help') {
      window.open('https://monarch.ai/docs', '_blank'); // Updated placeholder URL
    } else {
      setActiveTab(tabId);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings isDarkMode={isDarkMode} />;
      case 'models':
        return <ModelSettings isDarkMode={isDarkMode} />;
      case 'workspace':
        return <WorkspaceSettings isDarkMode={isDarkMode} />;
      case 'firewall':
        return <FirewallSettings isDarkMode={isDarkMode} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex min-h-screen min-w-[768px] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-slate-100`}>
      {/* Vertical Navigation Bar */}
      <nav
        className={`w-56 border-r border-blue-800/50 bg-slate-800/60 backdrop-blur-lg shadow-2xl`}>
        <div className="p-6">
          <div className="flex items-center mb-10">
            {/* Placeholder for Monarch Logo */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-8 w-8 mr-3 text-white">
              <path 
                d="M4 18L7 10L12 14L17 10L20 18H4Z M7 10L12 5L17 10" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                fill="currentColor"
              />
            </svg>
            <h1 className={`text-3xl font-bold text-slate-100`}>Monarch</h1>
          </div>
          <ul className="space-y-3">
            {TABS.map(item => (
              <li key={item.id}>
                <Button
                  onClick={() => handleTabClick(item.id)}
                  className={`flex w-full items-center space-x-3 rounded-lg px-4 py-3 text-left text-base transition-all duration-150 ease-in-out
                    ${
                      activeTab === item.id
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-slate-100 hover:shadow-sm'
                    } backdrop-blur-sm`}>
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 mt-auto">
            <p className="text-xs text-slate-500 text-center">&copy; {new Date().getFullYear()} Monarch. All rights reserved.</p>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className={`flex-1 bg-slate-900/30 p-10 backdrop-blur-sm overflow-y-auto`}>
        <div className="mx-auto min-w-[512px] max-w-screen-xl">{renderTabContent()}</div>
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div>Loading Monarch Settings...</div>), <div>An error occurred while loading settings.</div>);
