'use client';

// @ts-nocheck
import React, { useState } from 'react';
import { X, Save, TestTube } from 'lucide-react';
import { BaseWidget, WidgetType, WidgetSize, DataSource } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface WidgetConfigPanelProps {
  widget: BaseWidget;
  onUpdate: (widget: BaseWidget) => void;
  onClose: () => void;
}

export const WidgetConfigPanel: React.FC<WidgetConfigPanelProps> = ({
  widget,
  onUpdate,
  onClose,
}) => {
  const [editedWidget, setEditedWidget] = useState<BaseWidget>(widget);
  const [testingQuery, setTestingQuery] = useState(false);

  const handleSave = () => {
    onUpdate(editedWidget);
  };

  const handleTestQuery = async () => {
    setTestingQuery(true);
    try {
      // Simulate query test
      await new Promise(resolve => setTimeout(resolve, 1000));
      // In real implementation, this would test the data source
    } finally {
      setTestingQuery(false);
    }
  };

  const updateWidget = (updates: Partial<BaseWidget>) => {
    setEditedWidget((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Widget Configuration</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Config Content */}
      <ScrollArea className="flex-1">
        <Tabs defaultValue="general" className="p-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editedWidget.title}
                onChange={(e) => updateWidget({ title: e.target.value })}
                placeholder="Widget title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editedWidget.description || ''}
                onChange={(e) => updateWidget({ description: e.target.value })}
                placeholder="Widget description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Widget Type</Label>
              <Select
                value={editedWidget.type}
                onValueChange={(value: WidgetType) => updateWidget({ type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line-chart">Line Chart</SelectItem>
                  <SelectItem value="bar-chart">Bar Chart</SelectItem>
                  <SelectItem value="area-chart">Area Chart</SelectItem>
                  <SelectItem value="pie-chart">Pie Chart</SelectItem>
                  <SelectItem value="gauge-chart">Gauge Chart</SelectItem>
                  <SelectItem value="counter">Counter</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                  <SelectItem value="heatmap">Heatmap</SelectItem>
                  <SelectItem value="status-indicator">Status Indicator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Widget Size</Label>
              <Select
                value={editedWidget.size}
                onValueChange={(value: WidgetSize) => updateWidget({ size: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xlarge">Extra Large</SelectItem>
                  <SelectItem value="full">Full Width</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Data Source Settings */}
          <TabsContent value="data" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataSourceType">Data Source Type</Label>
              <Select
                value={editedWidget.dataSource.type}
                onValueChange={(value: DataSource['type']) =>
                  updateWidget({
                    dataSource: { ...editedWidget.dataSource, type: value },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric</SelectItem>
                  <SelectItem value="query">Query</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="stream">Stream</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editedWidget.dataSource.type === 'query' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="queryLanguage">Query Language</Label>
                  <Select
                    value={editedWidget.dataSource.queryLanguage}
                    onValueChange={(value: 'SQL' | 'PromQL' | 'GraphQL' | 'Custom') =>
                      updateWidget({
                        dataSource: {
                          ...editedWidget.dataSource,
                          queryLanguage: value,
                        } as any,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SQL">SQL</SelectItem>
                      <SelectItem value="PromQL">PromQL</SelectItem>
                      <SelectItem value="GraphQL">GraphQL</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="query">Query</Label>
                  <Textarea
                    id="query"
                    value={editedWidget.dataSource.query || ''}
                    onChange={(e) =>
                      updateWidget({
                        dataSource: {
                          ...editedWidget.dataSource,
                          query: e.target.value,
                        } as any,
                      })
                    }
                    placeholder="Enter your query..."
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestQuery}
                  disabled={testingQuery || !editedWidget.dataSource.query}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {testingQuery ? 'Testing...' : 'Test Query'}
                </Button>
              </>
            )}

            {editedWidget.dataSource.type === 'metric' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="metricName">Metric Name</Label>
                  <Input
                    id="metricName"
                    value={editedWidget.dataSource.metricName || ''}
                    onChange={(e) =>
                      updateWidget({
                        dataSource: {
                          ...editedWidget.dataSource,
                          metricName: e.target.value,
                        } as any,
                      })
                    }
                    placeholder="e.g., cpu_usage"
                  />
                </div>
              </>
            )}

            {editedWidget.dataSource.type === 'api' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="endpoint">API Endpoint</Label>
                  <Input
                    id="endpoint"
                    value={editedWidget.dataSource.endpoint || ''}
                    onChange={(e) =>
                      updateWidget({
                        dataSource: {
                          ...editedWidget.dataSource,
                          endpoint: e.target.value,
                        } as any,
                      })
                    }
                    placeholder="https://api.example.com/data"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">HTTP Method</Label>
                  <Select
                    value={editedWidget.dataSource.method || 'GET'}
                    onValueChange={(value: 'GET' | 'POST' | 'PUT' | 'DELETE') =>
                      updateWidget({
                        dataSource: {
                          ...editedWidget.dataSource,
                          method: value,
                        } as any,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
              <Input
                id="refreshInterval"
                type="number"
                value={editedWidget.refreshInterval || 30}
                onChange={(e) =>
                  updateWidget({ refreshInterval: parseInt(e.target.value) })
                }
                min={5}
                step={5}
              />
            </div>
          </TabsContent>

          {/* Display Settings */}
          <TabsContent value="display" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={editedWidget.theme?.mode || 'auto'}
                onValueChange={(value: 'light' | 'dark' | 'auto') =>
                  updateWidget({
                    theme: { ...editedWidget.theme, mode: value },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editedWidget.theme && (
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <Input
                  id="primaryColor"
                  type="color"
                  value={editedWidget.theme.primaryColor || '#000000'}
                  onChange={(e) =>
                    updateWidget({
                      theme: {
                        ...editedWidget.theme,
                        primaryColor: e.target.value,
                      },
                    })
                  }
                />
              </div>
            )}
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-2">
              <Label>Position</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="posX" className="text-xs">X</Label>
                  <Input
                    id="posX"
                    type="number"
                    value={editedWidget.position.x}
                    onChange={(e) =>
                      updateWidget({
                        position: {
                          ...editedWidget.position,
                          x: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="posY" className="text-xs">Y</Label>
                  <Input
                    id="posY"
                    type="number"
                    value={editedWidget.position.y}
                    onChange={(e) =>
                      updateWidget({
                        position: {
                          ...editedWidget.position,
                          y: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="posW" className="text-xs">Width</Label>
                  <Input
                    id="posW"
                    type="number"
                    value={editedWidget.position.w}
                    onChange={(e) =>
                      updateWidget({
                        position: {
                          ...editedWidget.position,
                          w: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="posH" className="text-xs">Height</Label>
                  <Input
                    id="posH"
                    type="number"
                    value={editedWidget.position.h}
                    onChange={(e) =>
                      updateWidget({
                        position: {
                          ...editedWidget.position,
                          h: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Created</Label>
              <p className="text-sm text-muted-foreground">
                {new Date(editedWidget.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Last Updated</Label>
              <p className="text-sm text-muted-foreground">
                {new Date(editedWidget.updatedAt).toLocaleString()}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
};

export default WidgetConfigPanel;
