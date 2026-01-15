/**
 * Properties Panel - Edit properties of selected service
 */

import React, { useState } from 'react';
import { useVisualBuilder } from '../context/VisualBuilderContext';
import { ServiceNode, ServiceConfig } from '../types';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Tabs } from '../components/Tab';
import { Icon } from '../components/Icon';

export function PropertiesPanel() {
  const { state, dispatch } = useVisualBuilder();
  const [activeTab, setActiveTab] = useState('basic');

  const selectedService = state.canvas.services.find(
    service => service.id === state.canvas.selectedNode
  );

  const handleUpdateService = (updates: Partial<ServiceNode>) => {
    if (!selectedService) return;
    dispatch({
      type: 'UPDATE_SERVICE',
      payload: {
        id: selectedService.id,
        updates,
      },
    });
  };

  const handleUpdateConfig = (updates: Partial<ServiceConfig>) => {
    if (!selectedService) return;
    dispatch({
      type: 'UPDATE_SERVICE',
      payload: {
        id: selectedService.id,
        updates: {
          config: { ...selectedService.config, ...updates },
        },
      },
    });
  };

  const handleAddEnvironmentVariable = () => {
    if (!selectedService) return;
    const envVars = { ...selectedService.config.environmentVariables };
    envVars[`VAR_${Date.now()}`] = '';
    handleUpdateConfig({ environmentVariables: envVars });
  };

  const handleRemoveEnvironmentVariable = (key: string) => {
    if (!selectedService) return;
    const envVars = { ...selectedService.config.environmentVariables };
    delete envVars[key];
    handleUpdateConfig({ environmentVariables: envVars });
  };

  const handleAddSecret = () => {
    if (!selectedService) return;
    handleUpdateConfig({
      secrets: [...selectedService.config.secrets, `SECRET_${Date.now()}`],
    });
  };

  const handleRemoveSecret = (secret: string) => {
    if (!selectedService) return;
    handleUpdateConfig({
      secrets: selectedService.config.secrets.filter(s => s !== secret),
    });
  };

  const handleAddTechnology = () => {
    const tech = prompt('Add technology:');
    if (tech && selectedService) {
      const technologies = [...selectedService.metadata.technologies, tech];
      dispatch({
        type: 'UPDATE_SERVICE',
        payload: {
          id: selectedService.id,
          updates: {
            metadata: { ...selectedService.metadata, technologies },
          },
        },
      });
    }
  };

  const handleRemoveTechnology = (tech: string) => {
    if (!selectedService) return;
    const technologies = selectedService.metadata.technologies.filter(t => t !== tech);
    dispatch({
      type: 'UPDATE_SERVICE',
      payload: {
        id: selectedService.id,
        updates: {
          metadata: { ...selectedService.metadata, technologies },
        },
      },
    });
  };

  if (!selectedService) {
    return (
      <div className="properties-panel">
        <div className="panel-header">
          <Icon name="Info" size={24} />
          <h2>Properties</h2>
        </div>
        <div className="no-selection">
          <Icon name="MousePointer" size={48} />
          <p>No service selected</p>
          <p>Click on a service to edit its properties</p>
        </div>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <div className="panel-header">
        <Icon name="Settings" size={24} />
        <h2>Properties</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: 'SELECT_NODE', payload: null })}
        >
          <Icon name="X" size={16} />
        </Button>
      </div>

      <Tabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="properties-tabs"
      >
        <Tab id="basic" label="Basic">
          <div className="tab-content">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <Input
                id="name"
                value={selectedService.name}
                onChange={(e) => handleUpdateService({ name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={selectedService.description}
                onChange={(e) => handleUpdateService({ description: e.target.value })}
                className="textarea"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <Select
                id="status"
                value={selectedService.status}
                onChange={(e) => handleUpdateService({ status: e.target.value as any })}
              >
                <option value="idle">Idle</option>
                <option value="deploying">Deploying</option>
                <option value="running">Running</option>
                <option value="error">Error</option>
              </Select>
            </div>

            <div className="form-group">
              <label htmlFor="runtime">Runtime</label>
              <Select
                id="runtime"
                value={selectedService.config.runtime}
                onChange={(e) => handleUpdateConfig({ runtime: e.target.value })}
              >
                <option value="cloudflare:workers">Cloudflare Workers</option>
                <option value="cloudflare:pages">Cloudflare Pages</option>
                <option value="cloudflare:d1">Cloudflare D1</option>
                <option value="cloudflare:r2">Cloudflare R2</option>
              </Select>
            </div>

            <div className="form-group">
              <label htmlFor="position">Position</label>
              <div className="position-inputs">
                <Input
                  id="position-x"
                  label="X"
                  type="number"
                  value={Math.round(selectedService.position.x)}
                  onChange={(e) => handleUpdateService({
                    position: { ...selectedService.position, x: parseInt(e.target.value) }
                  })}
                />
                <Input
                  id="position-y"
                  label="Y"
                  type="number"
                  value={Math.round(selectedService.position.y)}
                  onChange={(e) => handleUpdateService({
                    position: { ...selectedService.position, y: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>
          </div>
        </Tab>

        <Tab id="config" label="Configuration">
          <div className="tab-content">
            <div className="form-group">
              <label>Environment</label>
              <div className="environment-list">
                {selectedService.config.environment.map((env) => (
                  <div key={env} className="environment-item">
                    <span>{env}</span>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const env = prompt('Add environment variable:');
                    if (env) {
                      handleUpdateConfig({
                        environment: [...selectedService.config.environment, env],
                      });
                    }
                  }}
                >
                  <Icon name="Plus" size={14} />
                  Add
                </Button>
              </div>
            </div>

            <div className="form-group">
              <label>Environment Variables</label>
              <div className="env-vars-list">
                {Object.entries(selectedService.config.environmentVariables).map(([key, value]) => (
                  <div key={key} className="env-var-item">
                    <Input
                      value={key}
                      onChange={(e) => {
                        const newVars = { ...selectedService.config.environmentVariables };
                        const oldValue = newVars[key];
                        delete newVars[key];
                        newVars[e.target.value] = oldValue;
                        handleUpdateConfig({ environmentVariables: newVars });
                      }}
                      placeholder="Key"
                    />
                    <Input
                      value={value}
                      onChange={(e) => {
                        const newVars = { ...selectedService.config.environmentVariables };
                        newVars[key] = e.target.value;
                        handleUpdateConfig({ environmentVariables: newVars });
                      }}
                      placeholder="Value"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEnvironmentVariable(key)}
                    >
                      <Icon name="Trash2" size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddEnvironmentVariable}
                >
                  <Icon name="Plus" size={14} />
                  Add Variable
                </Button>
              </div>
            </div>

            <div className="form-group">
              <label>Secrets</label>
              <div className="secrets-list">
                {selectedService.config.secrets.map((secret) => (
                  <div key={secret} className="secret-item">
                    <span>{secret}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSecret(secret)}
                    >
                      <Icon name="Trash2" size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddSecret}
                >
                  <Icon name="Plus" size={14} />
                  Add Secret
                </Button>
              </div>
            </div>

            <div className="form-group">
              <label>Resources</label>
              <div className="resource-config">
                <div className="resource-item">
                  <label>CPU</label>
                  <Input
                    value={selectedService.config.resources.cpu}
                    onChange={(e) => handleUpdateConfig({
                      resources: { ...selectedService.config.resources, cpu: e.target.value }
                    })}
                  />
                </div>
                <div className="resource-item">
                  <label>Memory</label>
                  <Input
                    value={selectedService.config.resources.memory}
                    onChange={(e) => handleUpdateConfig({
                      resources: { ...selectedService.config.resources, memory: e.target.value }
                    })}
                  />
                </div>
                <div className="resource-item">
                  <label>Storage</label>
                  <Input
                    value={selectedService.config.resources.storage}
                    onChange={(e) => handleUpdateConfig({
                      resources: { ...selectedService.config.resources, storage: e.target.value }
                    })}
                  />
                </div>
                <div className="resource-item">
                  <label>Bandwidth</label>
                  <Input
                    value={selectedService.config.resources.bandwidth}
                    onChange={(e) => handleUpdateConfig({
                      resources: { ...selectedService.config.resources, bandwidth: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Scaling</label>
              <div className="scaling-config">
                <div className="scaling-item">
                  <label>Min Instances</label>
                  <Input
                    type="number"
                    value={selectedService.config.scaling.minInstances}
                    onChange={(e) => handleUpdateConfig({
                      scaling: { ...selectedService.config.scaling, minInstances: parseInt(e.target.value) }
                    })}
                  />
                </div>
                <div className="scaling-item">
                  <label>Max Instances</label>
                  <Input
                    type="number"
                    value={selectedService.config.scaling.maxInstances}
                    onChange={(e) => handleUpdateConfig({
                      scaling: { ...selectedService.config.scaling, maxInstances: parseInt(e.target.value) }
                    })}
                  />
                </div>
                <div className="scaling-item">
                  <label>Auto Scaling</label>
                  <div className="toggle-container">
                    <Button
                      variant={selectedService.config.scaling.autoScaling ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => handleUpdateConfig({
                        scaling: { ...selectedService.config.scaling, autoScaling: !selectedService.config.scaling.autoScaling }
                      })}
                    >
                      {selectedService.config.scaling.autoScaling ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Tab>

        <Tab id="tech" label="Technologies">
          <div className="tab-content">
            <div className="form-group">
              <label>Technologies</label>
              <div className="tech-list">
                {selectedService.metadata.technologies.map((tech) => (
                  <div key={tech} className="tech-item">
                    <span>{tech}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTechnology(tech)}
                    >
                      <Icon name="X" size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddTechnology}
                >
                  <Icon name="Plus" size={14} />
                  Add Technology
                </Button>
              </div>
            </div>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}