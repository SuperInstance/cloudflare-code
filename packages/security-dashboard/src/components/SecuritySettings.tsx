import React, { useState } from 'react';
import { NotificationSettings } from '../types';
import { Save, Bell, Shield, Lock, Key, AlertTriangle, Globe } from 'lucide-react';

interface SecuritySettingsProps {
  settings: SecuritySettings;
  onSave?: (settings: NotificationSettings) => void;
  className?: string;
}

export function SecuritySettings({ settings: initialSettings, onSave, className }: SecuritySettingsProps) {
  const [settings, setSettings] = useState<NotificationSettings>(initialSettings);
  const [activeTab, setActiveTab] = useState<'notifications' | 'alerts' | 'access' | 'api'>('notifications');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const tabs = [
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'alerts' as const, label: 'Alerts', icon: AlertTriangle },
    { id: 'access' as const, label: 'Access Control', icon: Shield },
    { id: 'api' as const, label: 'API Security', icon: Key },
  ];

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onSave?.(settings);
    setSaving(false);
    setSaved(true);

    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Security Settings</h2>
        <p className="text-sm text-gray-600">
          Configure your security dashboard preferences and alert settings
        </p>
      </div>

      <div className="flex gap-6">
        {/* Settings Navigation */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 rounded-lg border border-gray-200 bg-white p-6">
          {activeTab === 'notifications' && <NotificationSettingsPanel settings={settings} onChange={setSettings} />}
          {activeTab === 'alerts' && <AlertSettingsPanel settings={settings} onChange={setSettings} />}
          {activeTab === 'access' && <AccessControlPanel />}
          {activeTab === 'api' && <APISecurityPanel />}

          {/* Save Button */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
            {saved && (
              <span className="text-sm text-green-600">Settings saved successfully!</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationSettingsPanel({
  settings,
  onChange,
}: {
  settings: NotificationSettings;
  onChange: (settings: NotificationSettings) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>

        <div className="space-y-4">
          <SettingItem
            label="Email Notifications"
            description="Receive security alerts via email"
            checked={settings.email}
            onChange={(checked) => onChange({ ...settings, email: checked })}
          />

          <SettingItem
            label="Push Notifications"
            description="Receive push notifications in your browser"
            checked={settings.push}
            onChange={(checked) => onChange({ ...settings, push: checked })}
          />

          <SettingItem
            label="Slack Integration"
            description="Send alerts to Slack channels"
            checked={settings.slack}
            onChange={(checked) => onChange({ ...settings, slack: checked })}
          />

          {settings.slack && (
            <div className="ml-4 mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slack Webhook URL
              </label>
              <input
                type="url"
                value={settings.webhook || ''}
                onChange={(e) => onChange({ ...settings, webhook: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alert Severity Levels
            </label>
            <div className="space-y-2">
              {(['critical', 'high', 'medium', 'low'] as const).map((severity) => (
                <label key={severity} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.severity.includes(severity)}
                    onChange={(e) => {
                      const newSeverity = e.target.checked
                        ? [...settings.severity, severity]
                        : settings.severity.filter((s) => s !== severity);
                      onChange({ ...settings, severity: newSeverity });
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm capitalize text-gray-700">{severity}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertSettingsPanel({
  settings,
  onChange,
}: {
  settings: NotificationSettings;
  onChange: (settings: NotificationSettings) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Thresholds</h3>

        <div className="space-y-4">
          <ThresholdItem
            label="Threat Attempts Warning"
            description="Alert when threat attempts exceed this threshold"
            defaultValue={1000}
            unit="attempts/hour"
          />

          <ThresholdItem
            label="Failed Login Warning"
            description="Alert when failed logins exceed this threshold"
            defaultValue={300}
            unit="attempts/hour"
          />

          <ThresholdItem
            label="API Abuse Warning"
            description="Alert when API abuse attempts exceed this threshold"
            defaultValue={100}
            unit="attempts/hour"
          />

          <ThresholdItem
            label="Anomaly Score Warning"
            description="Alert when anomaly score exceeds this threshold"
            defaultValue={50}
            unit="score"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Escalation</h3>

        <div className="space-y-4">
          <SettingItem
            label="Auto-escalate critical alerts"
            description="Automatically escalate critical alerts to senior security team"
            checked={true}
            onChange={() => {}}
          />

          <SettingItem
            label="Require acknowledgment for high severity"
            description="Require manual acknowledgment for high severity alerts"
            checked={true}
            onChange={() => {}}
          />

          <SettingItem
            label="Enable alert aggregation"
            description="Group similar alerts to reduce notification fatigue"
            checked={true}
            onChange={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

function AccessControlPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Control</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
              <p className="text-xs text-gray-600">Require 2FA for all dashboard access</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" className="peer sr-only" defaultChecked />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Session Timeout</h4>
              <p className="text-xs text-gray-600">Automatically log out after inactivity</p>
            </div>
            <select className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option>15 minutes</option>
              <option selected>30 minutes</option>
              <option>1 hour</option>
              <option>4 hours</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">IP Whitelist</h4>
              <p className="text-xs text-gray-600">Restrict access to specific IP addresses</p>
            </div>
            <button className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
              Configure
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Logging</h3>

        <div className="space-y-4">
          <SettingItem
            label="Log all user actions"
            description="Record all user activities for audit purposes"
            checked={true}
            onChange={() => {}}
          />

          <SettingItem
            label="Log API access"
            description="Record all API requests and responses"
            checked={true}
            onChange={() => {}}
          />

          <SettingItem
            label="Export logs regularly"
            description="Automatically export and archive audit logs"
            checked={true}
            onChange={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

function APISecurityPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">API Security</h3>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">API Keys</h4>
            <p className="text-xs text-gray-600 mb-3">
              Manage API keys for programmatic access to the security dashboard
            </p>
            <button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Generate New Key
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Rate Limiting</h4>
              <p className="text-xs text-gray-600">Limit API requests to prevent abuse</p>
            </div>
            <select className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option>100 requests/minute</option>
              <option selected>1000 requests/minute</option>
              <option>10000 requests/minute</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">CORS Configuration</h4>
              <p className="text-xs text-gray-600">Control cross-origin access to API</p>
            </div>
            <button className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
              Configure
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Protection</h3>

        <div className="space-y-4">
          <SettingItem
            label="Encrypt data at rest"
            description="Use encryption for stored security data"
            checked={true}
            onChange={() => {}}
          />

          <SettingItem
            label="Encrypt data in transit"
            description="Require TLS for all API communications"
            checked={true}
            onChange={() => {}}
          />

          <SettingItem
            label="Anonymize logs"
            description="Remove sensitive information from logs"
            checked={true}
            onChange={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

interface SettingItemProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingItem({ label, description, checked, onChange }: SettingItemProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-900">{label}</label>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
      </label>
    </div>
  );
}

interface ThresholdItemProps {
  label: string;
  description: string;
  defaultValue: number;
  unit: string;
}

function ThresholdItem({ label, description, defaultValue, unit }: ThresholdItemProps) {
  const [value, setValue] = useState(defaultValue.toString());

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-900">{label}</label>
          <p className="text-xs text-gray-600">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
          />
          <span className="text-xs text-gray-600 w-16">{unit}</span>
        </div>
      </div>
    </div>
  );
}
