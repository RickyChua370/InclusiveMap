import { BAND_COLOR, BAND_LABEL, band } from "../engine/comfort";
import type { HourlyComfort, RouteResult } from "../types";

interface Props {
  route: RouteResult;
  now: HourlyComfort | null;
}

/** Summary card: comfort score for the current/selected hour + the "why". */
export default function RoutePanel({ route, now }: Props) {
  const score = now?.score ?? 0;
  const b = band(score);
  const km = (route.distanceM / 1000).toFixed(2);
  const mins = Math.round(route.durationS / 60);
  const shadePct = Math.round(route.shadeFraction * 100);
  const a = route.amenities;

  return (
    <section className="panel">
      <div className="score" style={{ borderColor: BAND_COLOR[b] }}>
        <div className="score__num" style={{ color: BAND_COLOR[b] }}>
          {score}
        </div>
        <div className="score__meta">
          <strong>Comfort score</strong>
          <span style={{ color: BAND_COLOR[b] }}>{BAND_LABEL[b]}</span>
          {now && <span className="muted">{now.reason}</span>}
        </div>
      </div>

      <ul className="facts">
        <li>
          <span>Distance</span>
          <strong>{km} km</strong>
        </li>
        <li>
          <span>Est. walk time</span>
          <strong>~{mins} min</strong>
        </li>
        <li>
          <span>Shaded now</span>
          <strong>{shadePct}%</strong>
        </li>
        <li>
          <span>Benches</span>
          <strong>{a.benches}</strong>
        </li>
        <li>
          <span>Water points</span>
          <strong>{a.water}</strong>
        </li>
        <li>
          <span>Toilets</span>
          <strong>{a.toilets}</strong>
        </li>
        <li className={a.steps > 0 ? "warn" : ""}>
          <span>Steps / stairs</span>
          <strong>{a.steps}</strong>
        </li>
      </ul>

      {route.isFallback && (
        <p className="fallback-note">
          ⚠︎ Demo mode: using an estimated path (no routing key set). Add a free
          OpenRouteService key in <code>.env</code> for real streets.
        </p>
      )}
    </section>
  );
}
