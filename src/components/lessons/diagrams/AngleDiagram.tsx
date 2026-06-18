import { getDiagramDataNumber } from "@/lib/lessons/diagrams";

type Props = {
  data?: Record<string, unknown>;
  className?: string;
};

export function AngleDiagram({ data, className }: Props) {
  const degrees = Math.min(180, Math.max(0, getDiagramDataNumber(data, "degrees", 45)));
  const radians = (degrees * Math.PI) / 180;
  const endX = 120 + Math.cos(-radians) * 90;
  const endY = 80 - Math.sin(-radians) * 90;

  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-hidden="true">
      <line x1={30} y1={80} x2={170} y2={80} stroke="rgba(255,255,255,0.45)" strokeWidth={2} />
      <line x1={30} y1={80} x2={endX} y2={endY} stroke="rgba(45,212,191,0.9)" strokeWidth={2.5} />
      <path
        d={`M 55 80 A 25 25 0 0 0 ${55 + Math.cos(-radians) * 25} ${80 - Math.sin(-radians) * 25}`}
        fill="none"
        stroke="rgba(251,191,36,0.85)"
        strokeWidth={2}
      />
      <text x={70} y={72} fill="rgba(255,255,255,0.75)" fontSize={12}>
        {degrees}°
      </text>
    </svg>
  );
}
