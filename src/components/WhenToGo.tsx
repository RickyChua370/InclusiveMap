import { BAND_COLOR, BAND_LABEL, bestWindow } from "../engine/comfort";
import type { HourlyComfort } from "../types";

interface Props {
  hours: HourlyComfort[];
}

/**
 * The "When to Go" hourly comfort strip — the signature feature.
 * Shows a color-coded bar per hour and highlights the best departure window.
 */
export default function WhenToGo({ hours }: Props) {
  if (hours.length === 0) return null;
  const best = bestWindow(hours);
  const waking = hours.filter((h) => h.hour >= 6 && h.hour <= 21);
  const maxScore = Math.max(...waking.map((h) => h.score), 1);

  const fmt = (h: number) =>
    `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

  return (
    <section className="whentogo">
      <div className="whentogo__head">
        <h3>When to go</h3>
        {best && (
          <p className="whentogo__best">
            Best window: <strong>{fmt(best.hour)}</strong> ·{" "}
            <span style={{ color: BAND_COLOR[best.band] }}>
              {BAND_LABEL[best.band]}
            </span>{" "}
            <span className="muted">({best.reason})</span>
          </p>
        )}
      </div>

      <div className="strip" role="list">
        {waking.map((h) => {
          const height = 20 + (h.score / maxScore) * 70;
          const isBest = best?.hour === h.hour;
          return (
            <div
              className={"strip__col" + (isBest ? " strip__col--best" : "")}
              key={h.hour}
              role="listitem"
              title={`${fmt(h.hour)} — comfort ${h.score}/100 · ${h.reason}`}
            >
              <div
                className="strip__bar"
                style={{
                  height: `${height}px`,
                  background: BAND_COLOR[h.band],
                }}
              />
              <span className="strip__hour">{fmt(h.hour)}</span>
            </div>
          );
        })}
      </div>

      <div className="legend">
        {(["good", "ok", "warm", "hot", "severe"] as const).map((b) => (
          <span key={b} className="legend__item">
            <i style={{ background: BAND_COLOR[b] }} />
            {BAND_LABEL[b]}
          </span>
        ))}
      </div>
    </section>
  );
}
