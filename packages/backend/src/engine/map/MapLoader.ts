import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { MapData, MapNodeData } from '@caravan/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const mapCache = new Map<string, MapData>();

export function loadMap(mapId: string): MapData {
  if (mapCache.has(mapId)) return mapCache.get(mapId)!;

  let filePath: string;
  if (mapId === 'map-mvp') {
    filePath = join(__dirname, '../data/maps/map-mvp.json');
  } else {
    throw new Error(`Unknown map: ${mapId}`);
  }

  const raw  = readFileSync(filePath, 'utf-8');
  const map  = JSON.parse(raw) as MapData;
  mapCache.set(mapId, map);
  return map;
}

export function buildAdjacency(map: MapData): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const node of map.nodes) {
    if (!adj.has(node.id)) adj.set(node.id, new Set());
    for (const conn of node.connections) {
      adj.get(node.id)!.add(conn);
    }
  }
  return adj;
}

export function getReachableNodes(
  map: MapData,
  fromNodeId: string,
  maxSteps: number,
  allowBackward = false,
): string[] {
  const adj = buildAdjacency(map);

  const revAdj = new Map<string, Set<string>>();
  if (allowBackward) {
    for (const node of map.nodes) {
      for (const conn of node.connections) {
        if (!revAdj.has(conn)) revAdj.set(conn, new Set());
        revAdj.get(conn)!.add(node.id);
      }
    }
  }

  const visited = new Set<string>([fromNodeId]);
  let frontier  = new Set<string>([fromNodeId]);
  const reachable = new Set<string>();

  for (let step = 1; step <= maxSteps; step++) {
    const next = new Set<string>();
    for (const nodeId of frontier) {
      const neighbours = new Set(adj.get(nodeId) ?? []);
      if (allowBackward) {
        for (const n of revAdj.get(nodeId) ?? []) neighbours.add(n);
      }
      for (const neighbour of neighbours) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          next.add(neighbour);
          reachable.add(neighbour);
        }
      }
    }
    frontier = next;
  }

  return Array.from(reachable);
}

export function getNodeById(map: MapData, nodeId: string): MapNodeData {
  const node = map.nodes.find((n: MapNodeData) => n.id === nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  return node;
}

export function getStartNode(map: MapData): MapNodeData {
  const node = map.nodes.find((n: MapNodeData) => n.startingNode || n.type === 'start');
  if (!node) throw new Error('No starting node in map');
  return node;
}
