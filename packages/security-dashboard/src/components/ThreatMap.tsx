import React, { useState } from 'react';
import { ThreatMapData } from '../types';
import { getSeverityColor } from '../lib/utils';

interface ThreatMapProps {
  data: ThreatMapData[];
  onRegionClick?: (region: string) => void;
  className?: string;
}

export function ThreatMap({ data, onRegionClick, className }: ThreatMapProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const maxCount = Math.max(...data.map(d => d.count));

  const getRegionSize = (count: number) => {
    const size = (count / maxCount) * 60 + 10;
    return size;
  };

  const getRegionOpacity = (count: number) => {
    const opacity = (count / maxCount) * 0.8 + 0.2;
    return opacity;
  };

  const handleRegionClick = (region: ThreatMapData) => {
    setSelectedRegion(region.country);
    onRegionClick?.(region.country);
  };

  return (
    <div className={className}>
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 to-slate-800">
        {/* Simplified world map representation */}
        <svg
          viewBox="0 0 1000 500"
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background grid */}
          <defs>
            <pattern
              id="grid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Threat circles positioned approximately */}
          {data.map((threat) => {
            // Simplified coordinate mapping
            const x = ((threat.longitude + 180) / 360) * 1000;
            const y = ((90 - threat.latitude) / 180) * 500;
            const size = getRegionSize(threat.count);
            const opacity = getRegionOpacity(threat.count);

            return (
              <g
                key={`${threat.latitude}-${threat.longitude}`}
                onClick={() => handleRegionClick(threat)}
                className="cursor-pointer transition-transform hover:scale-110"
              >
                {/* Outer glow */}
                <circle
                  cx={x}
                  cy={y}
                  r={size * 1.5}
                  fill="none"
                  stroke={threat.severity === 'critical' ? '#ef4444' :
                         threat.severity === 'high' ? '#f97316' :
                         threat.severity === 'medium' ? '#eab308' : '#22c55e'}
                  strokeWidth="2"
                  opacity={opacity * 0.3}
                >
                  <animate
                    attributeName="r"
                    values={`${size * 1.5};${size * 2};${size * 1.5}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values={`${opacity * 0.3};${opacity * 0.1};${opacity * 0.3}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Main circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={size}
                  fill={threat.severity === 'critical' ? '#ef4444' :
                         threat.severity === 'high' ? '#f97316' :
                         threat.severity === 'medium' ? '#eab308' : '#22c55e'}
                  opacity={opacity}
                />

                {/* Count label */}
                <text
                  x={x}
                  cy={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={Math.max(size / 3, 10)}
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {threat.count}
                </text>

                {/* Country label */}
                <text
                  x={x}
                  cy={y + size + 15}
                  textAnchor="middle"
                  fill="white"
                  fontSize={12}
                  pointerEvents="none"
                >
                  {threat.country}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 rounded-lg bg-black/50 p-4 backdrop-blur-sm">
          <h4 className="mb-2 text-sm font-semibold text-white">Severity Legend</h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-xs text-white">Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-500" />
              <span className="text-xs text-white">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="text-xs text-white">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-xs text-white">Low</span>
            </div>
          </div>
        </div>

        {/* Stats overlay */}
        <div className="absolute top-4 right-4 rounded-lg bg-black/50 p-4 backdrop-blur-sm">
          <div className="text-sm text-white">
            <div className="flex justify-between gap-4">
              <span className="font-semibold">Total Threats:</span>
              <span>{data.reduce((sum, d) => sum + d.count, 0)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold">Countries:</span>
              <span>{data.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold">Critical:</span>
              <span className="text-red-400">
                {data.filter(d => d.severity === 'critical').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ThreatMapTooltipProps {
  threat: ThreatMapData;
  position: { x: number; y: number };
}

export function ThreatMapTooltip({ threat, position }: ThreatMapTooltipProps) {
  return (
    <div
      className="absolute z-50 rounded-lg bg-gray-900 p-3 text-white shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="font-semibold">{threat.country}</div>
      {threat.city && <div className="text-sm text-gray-300">{threat.city}</div>}
      <div className="mt-1 text-sm">
        <span className={`font-medium ${getSeverityColor(threat.severity)}`}>
          {threat.severity.toUpperCase()}
        </span>
        {' '} - {threat.count} threats
      </div>
    </div>
  );
}
