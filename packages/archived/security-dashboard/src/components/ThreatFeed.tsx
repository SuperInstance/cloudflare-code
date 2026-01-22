import React, { useState } from 'react';
import { ThreatIndicator, ThreatFeed } from '../types';
import { getSeverityColor, formatRelativeTime } from '../lib/utils';
import { Search, Filter, Eye, ExternalLink, AlertCircle, Info } from 'lucide-react';

interface ThreatFeedProps {
  feeds: ThreatFeed[];
  indicators: ThreatIndicator[];
  onIndicatorClick?: (indicator: ThreatIndicator) => void;
  className?: string;
}

export function ThreatFeedComponent({ feeds, indicators, onIndicatorClick, className }: ThreatFeedProps) {
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredIndicators = indicators.filter((indicator) => {
    if (selectedFeed && !feeds.find(f => f.id === selectedFeed)?.indicators.includes(indicator)) {
      return false;
    }
    if (filterSeverity !== 'all' && indicator.severity !== filterSeverity) {
      return false;
    }
    if (filterType !== 'all' && indicator.type !== filterType) {
      return false;
    }
    if (
      searchQuery &&
      !indicator.value.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !indicator.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const severityCounts = {
    critical: filteredIndicators.filter((i) => i.severity === 'critical').length,
    high: filteredIndicators.filter((i) => i.severity === 'high').length,
    medium: filteredIndicators.filter((i) => i.severity === 'medium').length,
    low: filteredIndicators.filter((i) => i.severity === 'low').length,
  };

  return (
    <div className={className}>
      {/* Feed Selection */}
      <div className="mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Threat Feeds</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {feeds.map((feed) => (
            <FeedCard
              key={feed.id}
              feed={feed}
              selected={selectedFeed === feed.id}
              onClick={() => setSelectedFeed(selectedFeed === feed.id ? null : feed.id)}
            />
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search indicators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm"
          />
        </div>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Types</option>
          <option value="ipv4">IPv4</option>
          <option value="ipv6">IPv6</option>
          <option value="domain">Domain</option>
          <option value="url">URL</option>
          <option value="email">Email</option>
          <option value="hash">Hash</option>
          <option value="cve">CVE</option>
        </select>

        <span className="ml-auto flex items-center text-sm text-gray-500">
          {filteredIndicators.length} indicators
        </span>
      </div>

      {/* Severity Summary */}
      <div className="mb-4 grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{severityCounts.critical}</div>
          <div className="text-sm text-red-600">Critical</div>
        </div>
        <div className="rounded-lg bg-orange-50 p-3 text-center">
          <div className="text-2xl font-bold text-orange-700">{severityCounts.high}</div>
          <div className="text-sm text-orange-600">High</div>
        </div>
        <div className="rounded-lg bg-yellow-50 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700">{severityCounts.medium}</div>
          <div className="text-sm text-yellow-600">Medium</div>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{severityCounts.low}</div>
          <div className="text-sm text-blue-600">Low</div>
        </div>
      </div>

      {/* Indicators List */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Value
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Severity
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Confidence
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                First Seen
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredIndicators.map((indicator) => (
              <tr key={indicator.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700">
                    {indicator.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-gray-900">{indicator.value}</code>
                    {indicator.relatedIndicators.length > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        +{indicator.relatedIndicators.length}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getSeverityColor(indicator.severity)}`}>
                    {indicator.severity.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-gray-200">
                      <div
                        className={`h-2 rounded-full ${
                          indicator.confidence >= 90
                            ? 'bg-green-500'
                            : indicator.confidence >= 70
                            ? 'bg-blue-500'
                            : 'bg-yellow-500'
                        }`}
                        style={{ width: `${indicator.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{indicator.confidence}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{indicator.source}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatRelativeTime(indicator.firstSeen)}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onIndicatorClick?.(indicator)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredIndicators.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            <AlertCircle className="mx-auto mb-2 h-12 w-12" />
            <p>No indicators found matching the filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface FeedCardProps {
  feed: ThreatFeed;
  selected: boolean;
  onClick: () => void;
}

function FeedCard({ feed, selected, onClick }: FeedCardProps) {
  const statusColors = {
    active: 'bg-green-100 text-green-700 border-green-200',
    inactive: 'bg-gray-100 text-gray-700 border-gray-200',
    error: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border-2 bg-white p-4 transition-all hover:shadow-md ${
        selected ? 'border-blue-500 shadow-md' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">{feed.name}</h3>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[feed.status]}`}>
          {feed.status}
        </span>
      </div>

      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="font-medium capitalize">{feed.type}</span>
        </div>
        <div className="flex justify-between">
          <span>Update:</span>
          <span className="font-medium">{feed.updateFrequency}</span>
        </div>
        <div className="flex justify-between">
          <span>Last Update:</span>
          <span className="font-medium">{formatRelativeTime(feed.lastUpdate)}</span>
        </div>
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Indicators</span>
            <span className="font-semibold text-gray-900">{feed.indicators.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
