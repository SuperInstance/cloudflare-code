import React, { useState } from 'react';
import { SecurityReport, SecurityMetricsData } from '../types';
import { formatRelativeTime, downloadFile } from '../lib/utils';
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Calendar,
  User,
  FileJson,
  FileSpreadsheet,
  FileImage,
  Plus,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';

interface SecurityReportsProps {
  reports: SecurityReport[];
  metrics: SecurityMetricsData | null;
  onGenerateReport?: (type: SecurityReport['type'], period: { start: Date; end: Date }) => void;
  onDeleteReport?: (id: string) => void;
  onViewReport?: (report: SecurityReport) => void;
  className?: string;
}

export function SecurityReports({
  reports,
  metrics,
  onGenerateReport,
  onDeleteReport,
  onViewReport,
  className,
}: SecurityReportsProps) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<SecurityReport['type']>('executive');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReports = reports.filter((report) => {
    if (
      searchQuery &&
      !report.title.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const now = new Date();
      const startDate = new Date();
      if (period === '7d') startDate.setDate(now.getDate() - 7);
      else if (period === '30d') startDate.setDate(now.getDate() - 30);
      else if (period === '90d') startDate.setDate(now.getDate() - 90);

      await onGenerateReport?.(reportType, { start: startDate, end: now });
      setShowGenerateModal(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (report: SecurityReport) => {
    if (!report.fileUrl) return;

    // Simulate download based on format
    const content = generateReportContent(report, metrics);
    const blob = new Blob([content], {
      type:
        report.format === 'pdf'
          ? 'application/pdf'
          : report.format === 'json'
          ? 'application/json'
          : report.format === 'csv'
          ? 'text/csv'
          : 'text/html',
    });
    downloadFile(blob, `${report.title}.${report.format}`);
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Security Reports</h2>
          <p className="text-sm text-gray-600">
            Generate and manage security reports
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      {/* Search and Filter */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm"
          />
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredReports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onDownload={() => handleDownload(report)}
            onView={() => onViewReport?.(report)}
            onDelete={() => onDeleteReport?.(report.id)}
          />
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <FileText className="mb-2 h-12 w-12" />
          <p>No reports found</p>
        </div>
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <GenerateReportModal
          open={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
          generating={generating}
          reportType={reportType}
          period={period}
          onReportTypeChange={setReportType}
          onPeriodChange={setPeriod}
        />
      )}
    </div>
  );
}

interface ReportCardProps {
  report: SecurityReport;
  onDownload: () => void;
  onView: () => void;
  onDelete: () => void;
}

function ReportCard({ report, onDownload, onView, onDelete }: ReportCardProps) {
  const formatIcons = {
    pdf: <FileImage className="h-4 w-4 text-red-500" />,
    html: <FileText className="h-4 w-4 text-blue-500" />,
    json: <FileJson className="h-4 w-4 text-yellow-500" />,
    csv: <FileSpreadsheet className="h-4 w-4 text-green-500" />,
  };

  const typeColors = {
    executive: 'bg-purple-100 text-purple-700',
    technical: 'bg-blue-100 text-blue-700',
    compliance: 'bg-green-100 text-green-700',
    incident: 'bg-red-100 text-red-700',
    trend: 'bg-yellow-100 text-yellow-700',
    audit: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {formatIcons[report.format]}
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              {report.title}
            </h4>
            <p className="text-xs text-gray-600">{report.description}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${typeColors[report.type]}`}
        >
          {report.type}
        </span>
      </div>

      <div className="space-y-2 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <User className="h-3 w-3" />
          <span>{report.generatedBy}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3" />
          <span>{formatRelativeTime(report.generatedAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            {report.period.start.toLocaleDateString()} -{' '}
            {report.period.end.toLocaleDateString()}
          </span>
        </div>
      </div>

      {report.status === 'generating' ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating report...</span>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            onClick={onView}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Eye className="h-3 w-3" />
            View
          </button>
          <button
            onClick={onDownload}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
          <button
            onClick={onDelete}
            className="rounded-md border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

interface GenerateReportModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: () => void;
  generating: boolean;
  reportType: SecurityReport['type'];
  period: '7d' | '30d' | '90d' | 'custom';
  onReportTypeChange: (type: SecurityReport['type']) => void;
  onPeriodChange: (period: '7d' | '30d' | '90d' | 'custom') => void;
}

function GenerateReportModal({
  open,
  onClose,
  onGenerate,
  generating,
  reportType,
  period,
  onReportTypeChange,
  onPeriodChange,
}: GenerateReportModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Generate Security Report
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) =>
                onReportTypeChange(e.target.value as SecurityReport['type'])
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="executive">Executive Summary</option>
              <option value="technical">Technical Details</option>
              <option value="compliance">Compliance Report</option>
              <option value="incident">Incident Report</option>
              <option value="trend">Trend Analysis</option>
              <option value="audit">Audit Report</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Time Period
            </label>
            <select
              value={period}
              onChange={(e) =>
                onPeriodChange(e.target.value as '7d' | '30d' | '90d' | 'custom')
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom range</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Format
            </label>
            <div className="flex gap-2">
              <button className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                PDF
              </button>
              <button className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                HTML
              </button>
              <button className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                JSON
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            disabled={generating}
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </span>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function generateReportContent(
  report: SecurityReport,
  metrics: SecurityMetricsData | null
): string {
  if (report.format === 'json') {
    return JSON.stringify({ report, metrics }, null, 2);
  }

  if (report.format === 'csv') {
    const headers = ['Metric', 'Value', 'Change', 'Status'];
    const rows = metrics?.realTime
      ? Object.values(metrics.realTime).map(
          (m) =>
            `${m.name},${m.value},${m.change > 0 ? '+' : ''}${m.change}%,${m.trend}`
        )
      : [];
    return [headers.join(','), ...rows].join('\n');
  }

  // HTML format
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${report.title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #1f2937; }
    .metric { margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 8px; }
    .summary { background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <p class="summary"><strong>Overall Score:</strong> ${report.summary.overallScore}%</p>
  <p><strong>Period:</strong> ${report.period.start.toLocaleDateString()} - ${report.period.end.toLocaleDateString()}</p>
  <p><strong>Generated:</strong> ${report.generatedAt.toLocaleString()}</p>

  <h2>Executive Summary</h2>
  <ul>
    ${report.summary.highlights.map((h) => `<li>${h}</li>`).join('')}
  </ul>

  <h2>Key Metrics</h2>
  ${metrics?.realTime
    ? Object.values(metrics.realTime)
        .map(
          (m) => `
    <div class="metric">
      <h3>${m.name}</h3>
      <p><strong>Value:</strong> ${m.value} ${m.unit}</p>
      <p><strong>Change:</strong> ${m.change > 0 ? '+' : ''}${m.change}%</p>
      <p><strong>Status:</strong> ${m.trend}</p>
    </div>
      `
        )
        .join('')
    : ''}

  <h2>Recommendations</h2>
  <ul>
    ${report.summary.recommendations.map((r) => `<li>${r}</li>`).join('')}
  </ul>
</body>
</html>
  `;
}
