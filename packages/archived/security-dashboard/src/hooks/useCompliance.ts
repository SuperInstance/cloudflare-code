import { useState, useEffect, useCallback } from 'react';
import { ComplianceFramework, ComplianceControl, Policy, ComplianceEvidence } from '../types';

export function useComplianceFrameworks() {
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFrameworks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/security/compliance/frameworks');
      if (!response.ok) throw new Error('Failed to fetch frameworks');
      const data = await response.json();
      setFrameworks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setFrameworks(generateMockFrameworks());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFrameworks();
  }, [fetchFrameworks]);

  return { frameworks, loading, error, refetch: fetchFrameworks };
}

export function useComplianceFramework(id: string) {
  const [framework, setFramework] = useState<ComplianceFramework | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFramework = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/security/compliance/frameworks/${id}`);
        if (!response.ok) throw new Error('Failed to fetch framework');
        const data = await response.json();
        setFramework(data);
      } catch (err) {
        setFramework(generateMockFrameworks().find(f => f.id === id) || null);
      } finally {
        setLoading(false);
      }
    };
    fetchFramework();
  }, [id]);

  return { framework, loading };
}

export function useComplianceControls(frameworkId?: string) {
  const [controls, setControls] = useState<ComplianceControl[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchControls = useCallback(async () => {
    try {
      setLoading(true);
      const url = frameworkId
        ? `/api/security/compliance/controls?frameworkId=${frameworkId}`
        : '/api/security/compliance/controls';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch controls');
      const data = await response.json();
      setControls(data);
    } catch (err) {
      setControls([]);
    } finally {
      setLoading(false);
    }
  }, [frameworkId]);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  const updateControl = useCallback(async (id: string, updates: Partial<ComplianceControl>) => {
    try {
      const response = await fetch(`/api/security/compliance/controls/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update control');
      await fetchControls();
      return true;
    } catch (err) {
      return false;
    }
  }, [fetchControls]);

  return { controls, loading, updateControl };
}

export function usePolicies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/security/compliance/policies');
        if (!response.ok) throw new Error('Failed to fetch policies');
        const data = await response.json();
        setPolicies(data);
      } catch (err) {
        setPolicies(generateMockPolicies());
      } finally {
        setLoading(false);
      }
    };
    fetchPolicies();
  }, []);

  const createPolicy = useCallback(async (policy: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await fetch('/api/security/compliance/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      if (!response.ok) throw new Error('Failed to create policy');
      const data = await response.json();
      setPolicies(prev => [...prev, data]);
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  const updatePolicy = useCallback(async (id: string, updates: Partial<Policy>) => {
    try {
      const response = await fetch(`/api/security/compliance/policies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update policy');
      await fetchPolicies();
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/security/compliance/policies');
      if (!response.ok) throw new Error('Failed to fetch policies');
      const data = await response.json();
      setPolicies(data);
    } catch (err) {
      setPolicies(generateMockPolicies());
    } finally {
      setLoading(false);
    }
  };

  return { policies, loading, createPolicy, updatePolicy };
}

export function useComplianceEvidence(controlId: string) {
  const [evidence, setEvidence] = useState<ComplianceEvidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvidence = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/security/compliance/evidence?controlId=${controlId}`);
        if (!response.ok) throw new Error('Failed to fetch evidence');
        const data = await response.json();
        setEvidence(data);
      } catch (err) {
        setEvidence([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvidence();
  }, [controlId]);

  const uploadEvidence = useCallback(async (file: File, metadata: Omit<ComplianceEvidence, 'id' | 'uploadedAt' | 'uploadedBy'>) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch(`/api/security/compliance/evidence?controlId=${controlId}`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload evidence');
      const data = await response.json();
      setEvidence(prev => [...prev, data]);
      return true;
    } catch (err) {
      return false;
    }
  }, [controlId]);

  const verifyEvidence = useCallback(async (evidenceId: string) => {
    try {
      const response = await fetch(`/api/security/compliance/evidence/${evidenceId}/verify`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to verify evidence');
      setEvidence(prev => prev.map(e =>
        e.id === evidenceId
          ? { ...e, verified: true, verifiedAt: new Date() }
          : e
      ));
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  return { evidence, loading, uploadEvidence, verifyEvidence };
}

function generateMockFrameworks(): ComplianceFramework[] {
  return [
    {
      id: 'soc2',
      name: 'SOC 2 Type II',
      version: '2017',
      description: 'Service Organization Control 2 Type II compliance for security, availability, and confidentiality',
      status: 'compliant',
      lastAudit: new Date(Date.now() - 15552000000),
      nextAudit: new Date(Date.now() + 7776000000),
      controls: [],
      overallScore: 94,
    },
    {
      id: 'iso27001',
      name: 'ISO 27001',
      version: '2013',
      description: 'Information Security Management System standard',
      status: 'partial',
      lastAudit: new Date(Date.now() - 31104000000),
      nextAudit: new Date(Date.now() + 15552000000),
      controls: [],
      overallScore: 87,
    },
    {
      id: 'gdpr',
      name: 'GDPR',
      version: '2016',
      description: 'General Data Protection Regulation compliance',
      status: 'compliant',
      lastAudit: new Date(Date.now() - 7776000000),
      nextAudit: new Date(Date.now() + 15552000000),
      controls: [],
      overallScore: 92,
    },
    {
      id: 'hipaa',
      name: 'HIPAA',
      version: '2013',
      description: 'Health Insurance Portability and Accountability Act',
      status: 'non-compliant',
      lastAudit: new Date(Date.now() - 43200000000),
      nextAudit: new Date(Date.now() + 2592000000),
      controls: [],
      overallScore: 72,
    },
    {
      id: 'pci-dss',
      name: 'PCI DSS',
      version: '4.0',
      description: 'Payment Card Industry Data Security Standard',
      status: 'compliant',
      lastAudit: new Date(Date.now() - 12960000000),
      nextAudit: new Date(Date.now() + 10368000000),
      controls: [],
      overallScore: 96,
    },
  ];
}

function generateMockPolicies(): Policy[] {
  return [
    {
      id: 'policy-1',
      name: 'Information Security Policy',
      description: 'High-level policy governing information security practices',
      category: 'Governance',
      version: '3.2',
      status: 'active',
      content: 'This policy establishes the framework for ensuring information security...',
      createdAt: new Date(Date.now() - 15552000000),
      updatedAt: new Date(Date.now() - 2592000000),
      reviewedAt: new Date(Date.now() - 2592000000),
      approvedBy: 'CISO',
      controls: ['soc2-cc1.1', 'iso27001-a.5.1'],
    },
    {
      id: 'policy-2',
      name: 'Access Control Policy',
      description: 'Policy governing user access and authentication',
      category: 'Access Control',
      version: '2.1',
      status: 'active',
      content: 'This policy defines requirements for managing user access...',
      createdAt: new Date(Date.now() - 25920000000),
      updatedAt: new Date(Date.now() - 5184000000),
      reviewedAt: new Date(Date.now() - 5184000000),
      approvedBy: 'CISO',
      controls: ['soc2-cc6.1', 'iso27001-a.9.1'],
    },
    {
      id: 'policy-3',
      name: 'Incident Response Policy',
      description: 'Policy for responding to security incidents',
      category: 'Incident Management',
      version: '1.8',
      status: 'active',
      content: 'This policy outlines the procedures for incident response...',
      createdAt: new Date(Date.now() - 31104000000),
      updatedAt: new Date(Date.now() - 7776000000),
      reviewedAt: new Date(Date.now() - 7776000000),
      approvedBy: 'CISO',
      controls: ['soc2-cc7.2', 'iso27001-a.16.1'],
    },
  ];
}
