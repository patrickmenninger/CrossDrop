import React from 'react';

interface ConnectionArcProps {
  youX: number;
  youY: number;
  clientX: number;
  clientY: number;
  status: 'connected' | 'connecting' | 'failed' | 'disconnected';
  animationTick?: number;
  arcIndex?: number;
  totalArcs?: number;
}

const ConnectionArc: React.FC<ConnectionArcProps> = ({
  youX,
  youY,
  clientX,
  clientY,
  status,
  animationTick = 0,
  arcIndex = 0,
  totalArcs = 4,
}) => {
  if (status === 'failed') {
    // Line and X
    const midX = (youX + clientX) / 2;
    const midY = (youY + clientY) / 2;
    const dx = clientX - youX;
    const dy = clientY - youY;
    const norm = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / norm * 20;
    const perpY = dx / norm * 20;
    return (
      <g>
        <line x1={youX} y1={youY} x2={clientX} y2={clientY} stroke="#e11d48" strokeWidth="4" strokeDasharray="8 6" />
        <line x1={midX - perpX} y1={midY - perpY} x2={midX + perpX} y2={midY + perpY} stroke="#e11d48" strokeWidth="5" />
        <line x1={midX + perpX} y1={midY - perpY} x2={midX - perpX} y2={midY + perpY} stroke="#e11d48" strokeWidth="5" />
      </g>
    );
  } else if (status === 'connecting') {
    // Only one arc at a time
    const n = totalArcs;
    const duration = 1600;
    const now = Date.now() + animationTick * 16;
    const totalElapsed = now / duration;
    const activeArc = Math.floor(totalElapsed) % n;
    if (arcIndex !== activeArc) return null;
    const t = totalElapsed % 1;
    const flip = arcIndex % 2 === 0 ? 1 : -1;
    const arcHeight = 60 + 30 * Math.sin(now / 600 + arcIndex);
    const midX = (youX + clientX) / 2;
    const midY = (youY + clientY) / 2;
    const dx = clientX - youX;
    const dy = clientY - youY;
    const norm = Math.sqrt(dx * dx + dy * dy);
    const perpX = (-dy / norm) * flip;
    const perpY = (dx / norm) * flip;
    const cx = midX + perpX * arcHeight;
    const cy = midY + perpY * arcHeight;
    const x1 = youX;
    const y1 = youY;
    const x2 = clientX;
    const y2 = clientY;
    const bx = (1-t)*(1-t)*x1 + 2*(1-t)*t*cx + t*t*x2;
    const by = (1-t)*(1-t)*y1 + 2*(1-t)*t*cy + t*t*y2;
    const path = `M ${x1} ${y1} Q ${cx} ${cy} ${bx} ${by}`;
    return (
      <path
        d={path}
        stroke="#fbbf24"
        strokeWidth="4"
        strokeDasharray="10 8"
        opacity={0.7}
        fill="none"
      />
    );
  } else if (status === 'connected') {
    return (
      <line x1={youX} y1={youY} x2={clientX} y2={clientY} stroke="#22c55e" strokeWidth="8" />
    );
  }
  return null;
};

export default ConnectionArc;
