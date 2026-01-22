// @ts-nocheck
/**
 * Settings page
 */

'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { useDashboardStore } from '@/lib/store';
import { User, Bell, CreditCard, Key, Palette } from 'lucide-react';

export default function SettingsPage() {
  const { user, theme, setTheme } = useDashboardStore();
  const [loading, setLoading] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Profile settings
  const [name, setName] = React.useState(user?.name || '');
  const [email, setEmail] = React.useState(user?.email || '');

  // Editor settings
  const [fontSize, setFontSize] = React.useState(14);
  const [tabSize, setTabSize] = React.useState(2);
  const [wordWrap, setWordWrap] = React.useState<'on' | 'off'>('on');
  const [minimap, setMinimap] = React.useState(true);
  const [lineNumbers, setLineNumbers] = React.useState<'on' | 'off'>('on');
  const [autoSave, setAutoSave] = React.useState(true);

  const handleSave = async () => {
    setLoading(true);
    setSaveStatus('saving');

    try {
      // Save settings via API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout title="Settings">
      <div className="max-w-4xl space-y-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="editor">
              <Palette className="mr-2 h-4 w-4" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="api">
              <Key className="mr-2 h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Manage your account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={theme} onValueChange={(value: 'light' | 'dark') => setTheme(value)}>
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={loading}>
                    {saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Editor Settings */}
          <TabsContent value="editor">
            <Card>
              <CardHeader>
                <CardTitle>Editor Settings</CardTitle>
                <CardDescription>Customize your code editor experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fontSize">Font Size</Label>
                    <Select
                      value={fontSize.toString()}
                      onValueChange={(value) => setFontSize(parseInt(value))}
                    >
                      <SelectTrigger id="fontSize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12px</SelectItem>
                        <SelectItem value="14">14px</SelectItem>
                        <SelectItem value="16">16px</SelectItem>
                        <SelectItem value="18">18px</SelectItem>
                        <SelectItem value="20">20px</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tabSize">Tab Size</Label>
                    <Select
                      value={tabSize.toString()}
                      onValueChange={(value) => setTabSize(parseInt(value))}
                    >
                      <SelectTrigger id="tabSize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 spaces</SelectItem>
                        <SelectItem value="4">4 spaces</SelectItem>
                        <SelectItem value="8">8 spaces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Word Wrap</Label>
                      <p className="text-sm text-muted-foreground">
                        Wrap long lines of code
                      </p>
                    </div>
                    <Select
                      value={wordWrap}
                      onValueChange={(value: 'on' | 'off') => setWordWrap(value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">On</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Minimap</Label>
                      <p className="text-sm text-muted-foreground">
                        Show code minimap on the right
                      </p>
                    </div>
                    <Select
                      value={minimap ? 'on' : 'off'}
                      onValueChange={(value) => setMinimap(value === 'on')}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">On</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Line Numbers</Label>
                      <p className="text-sm text-muted-foreground">
                        Show line numbers in the gutter
                      </p>
                    </div>
                    <Select
                      value={lineNumbers}
                      onValueChange={(value: 'on' | 'off') => setLineNumbers(value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">On</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Save</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically save files as you edit
                      </p>
                    </div>
                    <Select
                      value={autoSave ? 'on' : 'off'}
                      onValueChange={(value) => setAutoSave(value === 'on')}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">On</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={loading}>
                    {saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage your API keys for external access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Production Key</div>
                    <div className="text-xs text-muted-foreground">Last used 2 hours ago</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 rounded bg-muted px-2 py-1 text-sm">
                      sk-••••••••••••••••
                    </code>
                    <Button variant="outline" size="sm">
                      Copy
                    </Button>
                    <Button variant="outline" size="sm">
                      Rotate
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Development Key</div>
                    <div className="text-xs text-muted-foreground">Last used 1 day ago</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 rounded bg-muted px-2 py-1 text-sm">
                      sk-••••••••••••••••
                    </code>
                    <Button variant="outline" size="sm">
                      Copy
                    </Button>
                    <Button variant="outline" size="sm">
                      Rotate
                    </Button>
                  </div>
                </div>

                <Button className="w-full">
                  <Key className="mr-2 h-4 w-4" />
                  Generate New API Key
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing */}
          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Billing & Plans</CardTitle>
                <CardDescription>Manage your subscription and payment methods</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Current Plan</p>
                      <p className="text-sm text-muted-foreground">Pro Plan</p>
                    </div>
                    <Button variant="outline">Upgrade</Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Requests</p>
                      <p className="text-2xl font-bold">12,450</p>
                      <p className="text-xs text-muted-foreground">of 50,000</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tokens</p>
                      <p className="text-2xl font-bold">2.4M</p>
                      <p className="text-xs text-muted-foreground">of 10M</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cost</p>
                      <p className="text-2xl font-bold">$24.50</p>
                      <p className="text-xs text-muted-foreground">this month</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Payment Methods</h3>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
                          VISA
                        </div>
                        <div>
                          <p className="font-medium">•••• •••• •••• 4242</p>
                          <p className="text-xs text-muted-foreground">Expires 12/2025</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full">
                    Add Payment Method
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
