import React, { useState } from 'react';
import {
  ComplianceFramework,
  ComplianceControl,
  Policy,
} from '../types';
import { getComplianceScore, formatRelativeTime } from '../lib/utils';
import {
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  Download,
  Search,
  Filter,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ComplianceDashboardProps {
  frameworks: ComplianceFramework[];
  policies: Policy[];
  onFrameworkClick?: (framework: ComplianceFramework) => void;
  onControlClick?: (control: ComplianceControl) => void;
  className?: string;
}

export function ComplianceDashboard({
  frameworks,
  policies,
  onFrameworkClick,
  onControlClick,
  className,
}: ComplianceDashboardProps) {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'controls' | 'policies'>('overview');

  const overallCompliance = frameworks.length > 0
    ? Math.round(frameworks.reduce((sum, fw) => sum + fw.overallScore, 0) / frameworks.length)
    : 0;

  const statusCounts = {
    compliant: frameworks.filter((f) => f.status === 'compliant').length,
    'non-compliant': frameworks.filter((f) => f.status === 'non-compliant').length,
    partial: frameworks.filter((f) => f.status === 'partial').length,
    pending: frameworks.filter((f) => f.status === 'pending').length,
  };

  const pieData = [
    { name: 'Compliant', value: statusCounts.compliant, color: '#22c55e' },
    { name: 'Non-Compliant', value: statusCounts['non-compliant'], color: '#ef4444' },
    { name: 'Partial', value: statusCounts.partial, color: '#eab308' },
    { name: 'Pending', value: statusCounts.pending, color: '#6b7280' },
  ];

  return (
    <div className={className}>
      {/* Overview Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h2>
              <p className="text-sm text-gray-600">
                Track and manage compliance across multiple frameworks
              </p>
          </div>
          <button className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Overall Score Card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Overall Compliance Score</h3>
            <p className="text-sm text-gray-600">Average across all frameworks</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-4xl font-bold text-gray-900">{overallCompliance}%</div>
              <div className="text-sm text-gray-600">
                {overallCompliance >= 90 ? 'Excellent' :
                 overallCompliance >= 75 ? 'Good' :
                 overallCompliance >= 60 ? 'Fair' : 'Needs Improvement'}
              </div>
            </div>
            <div className="h-20 w-20">
              <svg viewBox="0 0 36 36" className="h-full w-full">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={overallCompliance >= 90 ? '#22c55e' :
                          overallCompliance >= 75 ? '#3b82f6' :
                          overallCompliance >= 60 ? '#eab308' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={`${overallCompliance}, 100`}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Framework Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {frameworks.map((framework) => (
          <FrameworkCard
            key={framework.id}
            framework={framework}
            onClick={() => {
              setSelectedFramework(framework.id);
              onFrameworkClick?.(framework);
            }}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Status Distribution */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Compliance Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Framework Scores */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Framework Scores
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={frameworks}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar
                dataKey="overallScore"
                fill="#3b82f6"
                name="Compliance Score %"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming Audits */}
      <div className="mb-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Upcoming Audits</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {frameworks
            .filter((f) => f.nextAudit > new Date())
            .sort((a, b) => a.nextAudit.getTime() - b.nextAudit.getTime())
            .slice(0, 6)
            .map((framework) => (
              <AuditCard key={framework.id} framework={framework} />
            ))}
        </div>
      </div>

      {/* Recent Policies */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Recent Policies</h3>
          <button className="text-sm text-blue-600 hover:text-blue-800">
            View All
          </button>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Version
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Last Updated
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {policies.slice(0, 5).map((policy) => (
                <tr key={policy.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {policy.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {policy.category}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {policy.version}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        policy.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : policy.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {policy.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatRelativeTime(policy.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-sm text-blue-600 hover:text-blue-800">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface FrameworkCardProps {
  framework: ComplianceFramework;
  onClick: () => void;
}

function FrameworkCard({ framework, onClick }: FrameworkCardProps) {
  const statusIcons = {
    compliant: <CheckCircle className="h-5 w-5 text-green-500" />,
    'non-compliant': <AlertCircle className="h-5 w-5 text-red-500" />,
    partial: <Clock className="h-5 w-5 text-yellow-500" />,
    pending: <Clock className="h-5 w-5 text-gray-500" />,
  };

  const statusColors = {
    compliant: 'border-green-200 bg-green-50',
    'non-compliant': 'border-red-200 bg-red-50',
    partial: 'border-yellow-200 bg-yellow-50',
    pending: 'border-gray-200 bg-gray-50',
  };

  const daysUntilAudit = Math.ceil(
    (framework.nextAudit.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border ${statusColors[framework.status]} p-4 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-gray-600" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              {framework.name}
            </h4>
            <p className="text-xs text-gray-600">v{framework.version}</p>
          </div>
        </div>
        {statusIcons[framework.status]}
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Compliance Score</span>
          <span className="text-sm font-semibold text-gray-900">
            {framework.overallScore}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className={`h-2 rounded-full ${
              framework.overallScore >= 90
                ? 'bg-green-500'
                : framework.overallScore >= 75
                ? 'bg-blue-500'
                : framework.overallScore >= 60
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${framework.overallScore}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{framework.status.replace('-', ' ').toUpperCase()}</span>
        <span>
          {daysUntilAudit > 0 ? `${daysUntilAudit}d until audit` : 'Audit overdue'}
        </span>
      </div>
    </div>
  );
}

interface AuditCardProps {
  framework: ComplianceFramework;
}

function AuditCard({ framework }: AuditCardProps) {
  const daysUntilAudit = Math.ceil(
    (framework.nextAudit.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const urgencyColor =
    daysUntilAudit <= 7
      ? 'border-red-200 bg-red-50'
      : daysUntilAudit <= 30
      ? 'border-yellow-200 bg-yellow-50'
      : 'border-blue-200 bg-blue-50';

  return (
    <div
      className={`rounded-lg border ${urgencyColor} p-4`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            {framework.name}
          </h4>
          <p className="text-xs text-gray-600">v{framework.version}</p>
        </div>
        <Calendar className="h-4 w-4 text-gray-400" />
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Next Audit:</span>
          <span className="font-medium text-gray-900">
            {framework.nextAudit.toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Days Remaining:</span>
          <span
            className={`font-semibold ${
              daysUntilAudit <= 7
                ? 'text-red-600'
                : daysUntilAudit <= 30
                ? 'text-yellow-600'
                : 'text-blue-600'
            }`}
          >
            {daysUntilAudit} days
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Current Score:</span>
          <span className="font-medium text-gray-900">
            {framework.overallScore}%
          </span>
        </div>
      </div>
    </div>
  );
}
