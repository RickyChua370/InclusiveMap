import { BAND_COLOR, BAND_LABEL, bestWindow } from "../engine/comfort";
import type { HourlyComfort } from "../types";

interface Props {
  hours: HourlyComfort[];
  /** The location's current local hour — recommendations start from here. */
  nowHour: number;
}

/**
 * The "When to Go" hourly comfort strip — the signature feature.
 * Shows a color-coded bar per upcoming hour and highlights the best window,
 * only considering times from NOW onward.
 */
export default function WhenToGo({ hours, nowHour }: Props) {
  if (hours.length === 0) return null;
  const best = bestWindow(hours, nowHour);

  // Show from the current hour to end of waking day (21:00).
  const upcoming = hours.filter((h) => h.hour >= nowHour && h.hour <= 21);
  const strip = upcoming.length > 0 ? upcoming : hours.filter((h) => h.hour >= nowHour);
  const maxScore = Math.max(...strip.map((h) => h.score), 1);

  const fmt = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

  return (
    <section className="whentogo">
      <div className="whentogo__head">
        <h3>When to go</h3>
        {best && (
          <p className="whentogo__best">
            Best upcoming window: <strong>{fmt(best.hour)}</strong>
            {best.hour === nowHour && <span className="now-tag"> (now)</span>} ·{" "}
            <span style={{ color: BAND_COLOR[best.band] }}>
              {BAND_LABEL[best.band]}
            </span>{" "}
            <span className="muted">({best.reason})</span>
          </p>
        )}
      </div>

      <div className="strip" role="list">
        {strip.map((h) => {
          const height = 14 + (h.score / maxScore) * 72;
          const isBest = best?.hour === h.hour;
          const isNow = h.hour === nowHour;
          return (
            <div
              className={
                "strip__col" +
                (isBest ? " strip__col--best" : "") +
                (isNow ? " strip__col--now" : "")
              }
              key={h.hour}
              role="listitem"
              title={`${fmt(h.hour)} — comfort ${h.score}/100 · ${h.reason}`}
            >
              <span className="strip__score">{h.score}</span>
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
