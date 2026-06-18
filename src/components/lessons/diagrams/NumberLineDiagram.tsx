import { getDiagramDataNumber } from "@/lib/lessons/diagrams";

type Props = {
  data?: Record<string, unknown>;
  className?: string;
};

export function NumberLineDiagram({ data, className }: Props) {
  const min = getDiagramDataNumber(data, "min", 0);
  const max = getDiagramDataNumber(data, "max", 10);
  const mark = getDiagramDataNumber(data, "mark", min);
  const span = Math.max(1, max - min);
  const position = ((mark - min) / span) * 280 + 20;

  const ticks = Array.from({ length: span + 1 }, (_, index) => min + index);

  return (
    <svg viewBox="0 0 320 64" className={className} role="img" aria-hidden="true">
      <line x1={16} y1={32} x2={304} y2={32} stroke="rgba(255,255,255,0.45)" strokeWidth={2} />
      {ticks.map((value, index) => {
        const x = (index / span) * 280 + 20;
        return (
          <g key={value}>
            <line x1={x} y1={24} x2={x} y2={40} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
            <text x={x} y={54} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize={10}>
              {value}
            </text>
          </g>
        );
      })}
      <circle cx={position} cy={32} r={6} fill="rgba(45,212,191,0.9)" />
    </svg>
  );
}
