/**
 * Service Palette - Available services for dragging onto canvas
 */

import React, { useCallback } from 'react';
import { useDrag } from 'react-dnd';
import { useVisualBuilder } from '../context/VisualBuilderContext';
import { ServiceNode as ServiceNodeType } from '../types';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Card } from '../components/Card';

interface ServiceItemProps {
  service: ServiceTemplate;
  category: string;
}

interface ServiceTemplate {
  type: ServiceNodeType['type'];
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  technologies: string[];
  defaultConfig: Partial<ServiceNodeType['config']>;
}

const serviceTemplates: ServiceTemplate[] = [
  {
    type: 'worker',
    name: 'API Worker',
    description: 'Serverless API endpoints and business logic',
    icon: 'Code',
    color: '#6366f1',
    category: 'compute',
    technologies: ['Hono', 'Zod', 'Cloudflare Workers'],
    defaultConfig: {
      runtime: 'cloudflare:workers',
      environment: [],
      environmentVariables: {},
      secrets: [],
      resources: {
        cpu: '100ms',
        memory: '128MB',
        storage: '1GB',
        bandwidth: 'unlimited'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 100,
        autoScaling: true
      }
    }
  },
  {
    type: 'page',
    name: 'Static Page',
    description: 'Static website pages with edge caching',
    icon: 'Globe',
    color: '#10b981',
    category: 'frontend',
    technologies: ['HTML', 'CSS', 'JavaScript'],
    defaultConfig: {
      runtime: 'cloudflare:pages',
      environment: [],
      environmentVariables: {},
      secrets: [],
      resources: {
        cpu: '50ms',
        memory: '64MB',
        storage: '1GB',
        bandwidth: 'unlimited'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 50,
        autoScaling: true
      }
    }
  },
  {
    type: 'worker-pages',
    name: 'Full Page',
    description: 'Combines Workers with Pages for full-stack functionality',
    icon: 'Layers',
    color: '#8b5cf6',
    category: 'compute',
    technologies: ['Hono', 'Cloudflare Pages', 'Workers'],
    defaultConfig: {
      runtime: 'cloudflare:pages',
      environment: [],
      environmentVariables: {},
      secrets: [],
      resources: {
        cpu: '150ms',
        memory: '256MB',
        storage: '2GB',
        bandwidth: 'unlimited'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 100,
        autoScaling: true
      }
    }
  },
  {
    type: 'database',
    name: 'Database',
    description: 'Cloudflare D1 database for data storage',
    icon: 'Database',
    color: '#f59e0b',
    category: 'storage',
    technologies: ['SQLite', 'D1'],
    defaultConfig: {
      runtime: 'cloudflare:d1',
      environment: [],
      environmentVariables: {},
      secrets: [],
      resources: {
        cpu: '200ms',
        memory: '512MB',
        storage: '10GB',
        bandwidth: 'unlimited'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 1,
        autoScaling: false
      }
    }
  },
  {
    type: 'storage',
    name: 'Object Storage',
    description: 'Cloudflare R2 for file and object storage',
    icon: 'FolderOpen',
    color: '#06b6d4',
    category: 'storage',
    technologies: ['R2', 'S3 Compatible'],
    defaultConfig: {
      runtime: 'cloudflare:workers',
      environment: [],
      environmentVariables: {},
      secrets: [],
      resources: {
        cpu: '30ms',
        memory: '32MB',
        storage: 'unlimited',
        bandwidth: 'unlimited'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 20,
        autoScaling: true
      }
    }
  },
  {
    type: 'queue',
    name: 'Message Queue',
    description: 'Cloudflare Queues for background processing',
    icon: 'List',
    color: '#ec4899',
    category: 'compute',
    technologies: ['Cloudflare Queues'],
    defaultConfig: {
      runtime: 'cloudflare:workers',
      environment: [],
      environmentVariables: {},
      secrets: [],
      resources: {
        cpu: '100ms',
        memory: '64MB',
        storage: '1GB',
        bandwidth: 'unlimited'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 20,
        autoScaling: true
      }
    }
  },
  {
    type: 'cache',
    name: 'Cache',
    description: 'Cloudflare KV for global caching',
    icon: 'Database',
    color: '#84cc16',
    category: 'storage',
    technologies: ['KV Store'],
    defaultConfig: {
      runtime: 'cloudflare:workers',
      environment: [],
      environmentVariables: {},
      secrets: [],
      resources: {
        cpu: '20ms',
        memory: '32MB',
        storage: '1GB',
        bandwidth: 'unlimited'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 10,
        autoScaling: true
      }
    }
  },
  {
    type: 'auth',
    name: 'Auth Service',
    description: 'Authentication and authorization service',
    icon: 'Shield',
    color: '#ef4444',
    category: 'security',
    technologies: ['JWT', 'OAuth', 'bcrypt'],
    defaultConfig: {
      runtime: 'cloudflare:workers',
      environment: [],
      environmentVariables: {},
      secrets: ['JWT_SECRET'],
      resources: {
        cpu: '50ms',
        memory: '64MB',
        storage: '512MB',
        bandwidth: 'unlimited'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 50,
        autoScaling: true
      }
    }
  }
];

const categories = [
  { id: 'all', name: 'All Services' },
  { id: 'compute', name: 'Compute' },
  { id: 'storage', name: 'Storage' },
  { id: 'frontend', name: 'Frontend' },
  { id: 'security', name: 'Security' }
];

interface DragItem {
  type: string;
  service: ServiceTemplate;
}

export function ServicePalette({ activeCategory, onCategoryChange }: {
  activeCategory: string;
  onCategoryChange: (category: string) => void
}) {
  const { dispatch } = useVisualBuilder();

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'SERVICE',
    item: {} as DragItem,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const filteredServices = activeCategory === 'all'
    ? serviceTemplates
    : serviceTemplates.filter(s => s.category === activeCategory);

  const handleServiceClick = (service: ServiceTemplate) => {
    // Auto-add the service to canvas
    const newNode: ServiceNodeType = {
      id: `service-${Date.now()}`,
      type: service.type,
      name: service.name,
      description: service.description,
      position: { x: 100, y: 100 },
      config: {
        ...service.defaultConfig,
        environmentVariables: {},
        secrets: []
      } as ServiceNodeType['config'],
      status: 'idle',
      metadata: {
        icon: service.icon,
        color: service.color,
        category: service.category,
        technologies: service.technologies,
        resources: {
          cpu: { min: 50, max: 1000, default: 100, unit: 'ms' },
          memory: { min: 64, max: 1024, default: 128, unit: 'MB' },
          storage: { min: 0.1, max: 10, default: 1, unit: 'GB' },
          bandwidth: { min: 1, max: 100, default: 5, unit: 'GB' }
        }
      }
    };

    dispatch({ type: 'ADD_SERVICE', payload: newNode });
  };

  return (
    <div className="service-palette">
      {/* Category Tabs */}
      <div className="palette-categories">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={activeCategory === category.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onCategoryChange(category.id)}
          >
            {category.name}
          </Button>
        ))}
      </div>

      {/* Services Grid */}
      <div className="services-grid">
        {filteredServices.map((service) => (
          <ServiceItem
            key={service.type}
            service={service}
            category={service.category}
            onClick={() => handleServiceClick(service)}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceItem({ service, category, onClick }: ServiceItemProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'SERVICE',
    item: { service },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <Card
      ref={drag}
      className={`service-palette-item ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      style={{
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        borderLeft: `4px solid ${service.color}`
      }}
    >
      <div className="service-header">
        <Icon name={service.icon} size={24} style={{ color: service.color }} />
        <div className="service-info">
          <h4 className="service-name">{service.name}</h4>
          <p className="service-description">{service.description}</p>
        </div>
      </div>
      <div className="service-tags">
        {service.technologies.slice(0, 3).map((tech) => (
          <span key={tech} className="tech-tag">
            {tech}
          </span>
        ))}
      </div>
    </Card>
  );
}