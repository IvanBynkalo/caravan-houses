import React, { useMemo } from 'react';
import type { MapData }   from '@caravan/shared';
import { useMatchStore }  from '../../store/matchStore.js';

// ─────────────────────────────────────────────
//  COLORS
// ─────────────────────────────────────────────

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  start:      { fill: '#4CAF50', stroke: '#2E7D32' },
  market:     { fill: '#FF9800', stroke: '#E65100' },
  warehouse:  { fill: '#795548', stroke: '#4E342E' },
  hire:       { fill: '#9C27B0', stroke: '#6A1B9A' },
  archive:    { fill: '#3F51B5', stroke: '#1A237E' },
  build_slot: { fill: '#607D8B', stroke: '#37474F' },
  risky:      { fill: '#F44336', stroke: '#B71C1C' },
  hub:        { fill: '#FFD700', stroke: '#FF8F00' },
};

const NODE_ICONS: Record<string, string> = {
  start:      '🏠',
  market:     '🏪',
  warehouse:  '📦',
  hire:       '👥',
  archive:    '📚',
  build_slot: '🏗️',
  risky:      '⚠️',
  hub:        '🏛️',
};

const PLAYER_COLORS = ['#E91E63', '#2196F3', '#FF5722', '#009688'];

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────

type MapViewProps = {
  mapData:      MapData;
  onNodeClick:  (nodeId: string) => void;
};

export function MapView({ mapData, onNodeClick }: MapViewProps) {
  const { matchState, availableNodes, selectedNodeId } = useMatchStore();

  // Индекс: nodeId → данные узла
  const nodeIndex = useMemo(
    () => Object.fromEntries(mapData.nodes.map(n => [n.id, n])),
    [mapData],
  );

  // Порядок цветов игроков
  const playerColorMap = useMemo(() => {
    if (!matchState) return {};
    return Object.fromEntries(
      matchState.turnOrder.map((id, i) => [id, PLAYER_COLORS[i % PLAYER_COLORS.length]!]),
    );
  }, [matchState]);

  return (
    <svg
      viewBox={mapData.viewBox}
      className="w-full h-full"
      style={{ touchAction: 'none' }}
    >
      {/* ── Edges ── */}
      {mapData.edges.map((edge, i) => {
        const from = nodeIndex[edge.from];
        const to   = nodeIndex[edge.to];
        if (!from || !to) return null;
        return (
          <line
            key={i}
            x1={from.x} y1={from.y}
            x2={to.x}   y2={to.y}
            stroke="#9E9E9E"
            strokeWidth={2}
            strokeDasharray={to.type === 'hub' ? '6 3' : undefined}
          />
        );
      })}

      {/* ── Nodes ── */}
      {mapData.nodes.map(node => {
        const nodeState = matchState?.nodes[node.id];
        const status    = nodeState?.status ?? 'inactive';
        const isAvail   = availableNodes.includes(node.id);
        const isSelected = selectedNodeId === node.id;
        const colors    = NODE_COLORS[node.type] ?? NODE_COLORS['market']!;

        let fillColor   = colors.fill;
        let strokeColor = colors.stroke;
        let strokeWidth = 2;
        let opacity     = 1;
        let pulsate     = false;

        if (status === 'blocked') {
          fillColor   = '#9E9E9E';
          strokeColor = '#616161';
          opacity     = 0.5;
        } else if (isSelected) {
          strokeColor = '#FFD740';
          strokeWidth = 4;
        } else if (isAvail) {
          strokeColor = '#00E676';
          strokeWidth = 3;
          pulsate     = true;
        }

        const occupants = nodeState?.occupiedBy ?? [];

        return (
          <g
            key={node.id}
            onClick={() => isAvail && onNodeClick(node.id)}
            style={{ cursor: isAvail ? 'pointer' : 'default' }}
          >
            {/* Пульсация для доступных узлов */}
            {pulsate && (
              <circle cx={node.x} cy={node.y} r={node.r + 6}
                fill="none" stroke="#00E676" strokeWidth={1.5} opacity={0.4}>
                <animate attributeName="r"
                  values={`${node.r + 4};${node.r + 10};${node.r + 4}`}
                  dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity"
                  values="0.4;0;0.4" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Тень */}
            <circle cx={node.x + 2} cy={node.y + 2} r={node.r}
              fill="rgba(0,0,0,0.2)" />

            {/* Основной круг */}
            <circle
              cx={node.x} cy={node.y} r={node.r}
              fill={fillColor} stroke={strokeColor}
              strokeWidth={strokeWidth} opacity={opacity}
            />

            {/* Иконка */}
            <text
              x={node.x} y={node.y + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={node.r * 0.8}
            >
              {NODE_ICONS[node.type] ?? '●'}
            </text>

            {/* Метка */}
            <text
              x={node.x} y={node.y + node.r + 14}
              textAnchor="middle"
              fontSize={10}
              fill="#fff"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
            >
              {node.label}
            </text>

            {/* Жетоны игроков */}
            {occupants.map((pid, i) => {
              const color = playerColorMap[pid] ?? '#fff';
              const player = matchState?.players[pid];
              const initials = player?.displayName?.[0]?.toUpperCase() ?? '?';
              const offsetX = (i - (occupants.length - 1) / 2) * 16;
              return (
                <g key={pid} transform={`translate(${node.x + offsetX}, ${node.y - node.r - 10})`}>
                  <circle r={8} fill={color} stroke="#fff" strokeWidth={1.5} />
                  <text
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={8} fill="#fff" fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {initials}
                  </text>
                </g>
              );
            })}

            {/* Иконка постройки */}
            {nodeState?.buildingId && (
              <text
                x={node.x + node.r - 6} y={node.y - node.r + 6}
                fontSize={10} textAnchor="middle"
              >
                🏠
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
