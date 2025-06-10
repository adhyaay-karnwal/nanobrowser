import { useState, useEffect } from 'react';
import '@src/Options.css'; // We'll update or replace this CSS
import { Button } from '@extension/ui'; // Assuming this is a pre-styled button
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ModelSettings } from './components/ModelSettings'; // This will be heavily refactored
import { FiUser, FiGrid, FiDollarSign, FiLink, FiSettings, FiBookOpen, FiMail, FiSun, FiMoon } from 'react-icons/fi';

type TabId = 'overview' | 'usage' | 'billing' | 'integrations' | 'appSettings' | 'docs' | 'contact';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: FiGrid },
  { id: 'usage', label: 'Usage', icon: FiDollarSign }, // Placeholder icon
  { id: 'billing', label: 'Billing & Invoices', icon: FiDollarSign }, // Placeholder icon
  { id: 'integrations', label: 'Integrations', icon: FiLink },
  { id: 'appSettings', label: 'Settings', icon: FiSettings },
  { id: 'docs', label: 'Docs', icon: FiBookOpen },
  { id: 'contact', label: 'Contact Us', icon: FiMail },
];

// Placeholder components for content to keep Options.tsx cleaner
const OverviewContent = ({ isLightMode }: { isLightMode: boolean }) => (
  <div className={`p-6 rounded-lg ${isLightMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-slate-100'}`}>
    <h2 className="text-2xl font-semibold mb-4">Overview</h2>
    <p>Welcome to Monarch. Your AI-powered browser assistant.</p>
    <p className="mt-2">Usage statistics and quick actions will appear here.</p>
  </div>
);

const UsageContent = ({ isLightMode }: { isLightMode: boolean }) => (
  <div className={`p-6 rounded-lg ${isLightMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-slate-100'}`}>
    <h2 className="text-2xl font-semibold mb-4">Usage</h2>
    <p>Detailed usage statistics for your Monarch account.</p>
    {/* Placeholder for charts or data */}
  </div>
);

const BillingContent = ({ isLightMode }: { isLightMode: boolean }) => (
  <div className={`p-6 rounded-lg ${isLightMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-slate-100'}`}>
    <h2 className="text-2xl font-semibold mb-4">Billing & Invoices</h2>
    <p>Manage your subscription, payment methods, and view invoices.</p>
    {/* Placeholder for billing details */}
  </div>
);

const IntegrationsContent = ({ isLightMode }: { isLightMode: boolean }) => {
  // Placeholder state for connection
  const [isWorkspaceConnected, setIsWorkspaceConnected] = useState(false);

  const handleConnectWorkspace = () => {
    // In a real app, this would initiate OAuth flow
    setIsWorkspaceConnected(true);
    // Potentially send a message to background script to start auth
    // chrome.runtime.sendMessage({ type: 'INITIATE_GOOGLE_AUTH' });
  };

  return (
    <div className={`p-8 rounded-lg ${isLightMode ? 'bg-white text-slate-800' : 'bg-slate-800 text-slate-100'} shadow-xl`}>
      <h2 className="text-3xl font-semibold mb-6">Google Workspace Integration</h2>
      <p className={`mb-4 text-lg ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
        Connect Monarch to your Google Workspace to supercharge your productivity.
      </p>
      <p className={`mb-8 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
        Enable seamless access to your Gmail, Google Drive, Calendar, and Contacts. Monarch can help you draft emails, summarize documents, schedule meetings, and much more, all within your browser.
      </p>
      {isWorkspaceConnected ? (
        <div className="text-center">
          <p className={`text-xl font-medium mb-4 ${isLightMode ? 'text-green-600' : 'text-green-400'}`}>
            Successfully Connected to Google Workspace!
          </p>
          <Button
            onClick={() => setIsWorkspaceConnected(false)} // Placeholder for disconnect
            className={`w-full max-w-xs mx-auto py-3 text-base font-medium rounded-lg transition-colors duration-150 ease-in-out
              ${isLightMode ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
          >
            Disconnect Google Workspace
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleConnectWorkspace}
          className={`w-full max-w-xs mx-auto py-3 text-base font-medium rounded-lg transition-colors duration-150 ease-in-out
            ${isLightMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white'}`}
        >
          Connect Google Workspace
        </Button>
      )}
      <div className="mt-10 pt-6 border-t border-slate-700">
        <h3 className={`text-xl font-semibold mb-3 ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>Permissions Overview:</h3>
        <ul className={`space-y-2 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <li>Access to read Gmail messages (for summarization and drafting replies).</li>
          <li>Access to read Google Drive files (for analysis and context).</li>
          <li>Access to read Google Calendar events (for scheduling and reminders).</li>
          <li>Access to read Google Contacts (for email drafting and meeting invites).</li>
        </ul>
        <p className={`mt-4 text-xs ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Monarch only accesses data when explicitly requested by you for a specific task. All data is processed locally or securely transmitted.
        </p>
      </div>
    </div>
  );
};


const Options = () => {
  const [activeTab, setActiveTab] = useState<TabId>('appSettings');
  // Settings page itself will be dark, but we need a toggle for the main extension UI (handled in SidePanel)
  // For this page, we'll assume a dark theme as per the screenshot.
  const isLightMode = false; // Settings page is dark themed
  const isSettingsPageDark = true; // Explicitly for this page's styling

  const handleTabClick = (tabId: TabId) => {
    if (tabId === 'docs') {
      window.open('https://monarch.ai/docs', '_blank'); // Placeholder URL
    } else if (tabId === 'contact') {
      window.open('mailto:support@monarch.ai', '_blank'); // Placeholder email
    } else {
      setActiveTab(tabId);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewContent isLightMode={isSettingsPageDark ? false : isLightMode} />;
      case 'usage':
        return <UsageContent isLightMode={isSettingsPageDark ? false : isLightMode} />;
      case 'billing':
        return <BillingContent isLightMode={isSettingsPageDark ? false : isLightMode} />;
      case 'integrations':
        return <IntegrationsContent isLightMode={isSettingsPageDark ? false : isLightMode} />;
      case 'appSettings':
        // Pass isLightMode (which is false for this dark settings page)
        return <ModelSettings isLightMode={isSettingsPageDark ? false : isLightMode} />;
      default:
        return <OverviewContent isLightMode={isSettingsPageDark ? false : isLightMode} />; // Default to overview
    }
  };

  // Main container style based on the screenshot (always dark for settings)
  const containerBg = 'bg-slate-900';
  const textColor = 'text-slate-100';
  const sidebarBg = 'bg-slate-800';
  const sidebarBorder = 'border-slate-700';
  const activeTabBg = 'bg-gradient-to-r from-sky-500 to-blue-600'; // Blue gradient for active tab
  const activeTabTextColor = 'text-white';
  const inactiveTabTextColor = 'text-slate-400';
  const hoverTabBg = 'hover:bg-slate-700';
  const hoverTabTextColor = 'hover:text-slate-100';

  return (
    <div className={`flex min-h-screen min-w-[1024px] ${containerBg} ${textColor}`}>
      {/* Sidebar Navigation */}
      <nav className={`w-64 ${sidebarBg} border-r ${sidebarBorder} flex flex-col shadow-2xl`}>
        <div className="p-6">
          <div className="flex items-center mb-10">
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
            <h1 className="text-2xl font-bold text-white">Monarch</h1>
          </div>

          {/* User Profile Placeholder */}
          <div className="mb-10 flex items-center">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center mr-3">
              <FiUser className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-100">King AK</p>
              <p className="text-xs text-sky-400">Pro Trial</p>
            </div>
          </div>

          <ul className="space-y-2">
            {TABS.map(item => (
              <li key={item.id}>
                <Button
                  onClick={() => handleTabClick(item.id)}
                  className={`flex w-full items-center space-x-3 rounded-md px-4 py-2.5 text-left text-sm font-medium transition-all duration-150 ease-in-out
                    ${activeTab === item.id
                      ? `${activeTabBg} ${activeTabTextColor} shadow-md`
                      : `${inactiveTabTextColor} ${hoverTabBg} ${hoverTabTextColor}`
                    }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-auto p-6">
          {/* Light/Dark mode toggle could go here if settings page wasn't always dark */}
          <p className="text-xs text-slate-500 text-center">&copy; {new Date().getFullYear()} Monarch. All rights reserved.</p>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header for the content area - can be dynamic based on tab */}
        {/* <h1 className="text-3xl font-semibold mb-8 text-slate-100">
          {TABS.find(t => t.id === activeTab)?.label || 'Settings'}
        </h1> */}
        <div className="mx-auto max-w-4xl">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
};

// Suspense and ErrorBoundary wrappers
const SuspenseFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
    <div className="flex items-center space-x-2">
      <svg className="animate-spin h-5 w-5 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Loading Monarch Settings...</span>
    </div>
  </div>
);

const ErrorFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-900 text-red-400">
    <div className="text-center">
      <h2 className="text-xl font-semibold mb-2">Oops! Something went wrong.</h2>
      <p>An error occurred while loading the settings page. Please try again later.</p>
    </div>
  </div>
);

export default withErrorBoundary(withSuspense(Options, <SuspenseFallback />), <ErrorFallback />);
