/**
 * Settings Page
 *
 * User and app settings.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Info,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
} from 'lucide-react';
import { TopNav } from '@/components/ui/BottomNav';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePWAInstall } from '@/lib/pwa/pwa-install';
import { useNetworkStatus } from '@/lib/pwa/network-manager';
import { useServiceWorker } from '@/lib/pwa/registerSW';

interface SettingSection {
  title: string;
  items: SettingItem[];
}

interface SettingItem {
  label: string;
  icon: React.ReactNode;
  value?: string;
  badge?: string | number;
  onPress: () => void;
  destructive?: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const { canInstall, promptInstall } = usePWAInstall();
  const { updateAvailable, activateUpdate } = useServiceWorker();
  const [isDark, setIsDark] = React.useState(false);

  const settingSections: SettingSection[] = [
    {
      title: 'Account',
      items: [
        {
          label: 'Profile',
          icon: <User className="w-5 h-5" />,
          onPress: () => router.push('/settings/profile'),
        },
        {
          label: 'Notifications',
          icon: <Bell className="w-5 h-5" />,
          badge: 3,
          onPress: () => router.push('/settings/notifications'),
        },
        {
          label: 'Security',
          icon: <Shield className="w-5 h-5" />,
          onPress: () => router.push('/settings/security'),
        },
      ],
    },
    {
      title: 'App Settings',
      items: [
        {
          label: 'Appearance',
          icon: isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />,
          value: isDark ? 'Dark' : 'Light',
          onPress: () => {
            setIsDark(!isDark);
            // Toggle theme
            document.documentElement.classList.toggle('dark');
          },
        },
        {
          label: 'Storage & Cache',
          icon: <Database className="w-5 h-5" />,
          onPress: () => router.push('/settings/storage'),
        },
      ],
    },
    {
      title: 'App',
      items: [
        ...(canInstall
          ? [
              {
                label: 'Install App',
                icon: <span className="text-lg">📲</span>,
                onPress: () => promptInstall(),
              } as SettingItem,
            ]
          : []),
        ...(updateAvailable
          ? [
              {
                label: 'Update Available',
                icon: <span className="text-lg">🔄</span>,
                badge: 'New',
                onPress: () => activateUpdate(),
              } as SettingItem,
            ]
          : []),
        {
          label: 'About',
          icon: <Info className="w-5 h-5" />,
          value: 'v1.0.0',
          onPress: () => router.push('/settings/about'),
        },
      ],
    },
    {
      title: 'Danger Zone',
      items: [
        {
          label: 'Log Out',
          icon: <LogOut className="w-5 h-5" />,
          onPress: () => {
            // Handle logout
            console.log('Logging out...');
          },
          destructive: true,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <TopNav title="Settings" onBack={() => router.back()} />

      {/* Main Content */}
      <div className="p-4 space-y-4 pb-safe">
        {/* Connection Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-success-500' : 'bg-error-500'}`} />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              {isOnline ? (
                <Badge size="sm" variant="success">Connected</Badge>
              ) : (
                <Badge size="sm" variant="danger">Offline Mode</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Setting Sections */}
        {settingSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 px-1">
              {section.title}
            </h3>
            <Card>
              <CardContent className="p-0">
                {section.items.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    onClick={item.onPress}
                    className={`w-full flex items-center justify-between p-4 transition-colors active:bg-gray-50 dark:active:bg-gray-800 ${
                      itemIndex < section.items.length - 1
                        ? 'border-b border-gray-100 dark:border-gray-800'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`${
                          item.destructive ? 'text-error-600 dark:text-error-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {item.icon}
                      </div>
                      <span
                        className={`font-medium ${
                          item.destructive
                            ? 'text-error-600 dark:text-error-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.value && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {item.value}
                        </span>
                      )}
                      {item.badge !== undefined && (
                        <Badge size="sm" variant="primary">
                          {item.badge}
                        </Badge>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* PWA Install Prompt */}
        {canInstall && (
          <Card className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl">📲</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Install ClaudeFlare
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Get the full experience with offline support and push notifications
                  </p>
                  <Button size="sm" onClick={promptInstall}>
                    Install Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
