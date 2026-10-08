import { useState } from "react";
import type { LngLat, Venue } from "../types";

interface Props {
  pendingPoint: LngLat | null;
  venues: Venue[];
  onAdd: (v: Venue) => void;
  onRemove: (id: string) => void;
}

const CATEGORIES: { id: Venue["category"]; label: string }[] = [
  { id: "pharmacy", label: "Pharmacy" },
  { id: "cafe", label: "Café" },
  { id: "green_building", label: "Certified green building" },
  { id: "clinic", label: "Clinic" },
  { id: "other", label: "Other" },
];

/**
 * The "Inclusive Business" side — our paying customer.
 * A small business registers itself as an inclusive stop. In return it appears
 * as a trusted rest/refuge point on travellers' comfort routes (the marketing
 * upside they pay for).
 */
export default function BusinessPanel({
  pendingPoint,
  venues,
  onAdd,
  onRemove,
}: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Venue["category"]>("cafe");
  const [stepFree, setStepFree] = useState(true);
  const [hasRestSeating, setHasRestSeating] = useState(true);
  const [hasAccessibleToilet, setHasAccessibleToilet] = useState(false);
  const [airConditioned, setAirConditioned] = useState(true);

  const canSubmit = name.trim() && pendingPoint;

  function submit() {
    if (!canSubmit || !pendingPoint) return;
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      category,
      lngLat: pendingPoint,
      stepFree,
      hasRestSeating,
      hasAccessibleToilet,
      airConditioned,
    });
    setName("");
  }

  /** Inclusivity score a business earns — used to pitch the badge/tier. */
  function inclusivityScore(v: Venue): number {
    return (
      (v.stepFree ? 30 : 0) +
      (v.hasRestSeating ? 25 : 0) +
      (v.hasAccessibleToilet ? 25 : 0) +
      (v.airConditioned ? 20 : 0)
    );
  }

  return (
    <section className="biz">
      <p className="biz__intro">
        Register your venue as an <strong>Inclusive Stop</strong>. You appear as
        a trusted rest &amp; refuge point on vulnerable travellers' comfort
        routes — accessibility becomes footfall.
      </p>

      <div className="biz__form">
        <label>
          Venue name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Guardian Pharmacy, Setia City"
          />
        </label>

        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Venue["category"])}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="biz__checks">
          <label className="chk">
            <input
              type="checkbox"
              checked={stepFree}
              onChange={(e) => setStepFree(e.target.checked)}
            />
            Step-free entrance
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={hasRestSeating}
              onChange={(e) => setHasRestSeating(e.target.checked)}
            />
            Rest seating
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={hasAccessibleToilet}
              onChange={(e) => setHasAccessibleToilet(e.target.checked)}
            />
            Accessible toilet
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={airConditioned}
              onChange={(e) => setAirConditioned(e.target.checked)}
            />
            Air-conditioned / cool refuge
          </label>
        </div>

        <p className="biz__hint">
          {pendingPoint
            ? "✓ Location set — click the map again to move it."
            : "Click on the map to drop your venue's location."}
        </p>
        <button disabled={!canSubmit} onClick={submit}>
          Add Inclusive Stop
        </button>
      </div>

      <h4>Registered venues ({venues.length})</h4>
      <ul className="biz__list">
        {venues.length === 0 && (
          <li className="muted">No venues yet. Add one above.</li>
        )}
        {venues.map((v) => (
          <li key={v.id}>
            <div>
              <strong>{v.name}</strong>
              <span className="muted">
                {" "}
                · {CATEGORIES.find((c) => c.id === v.category)?.label}
              </span>
              <div className="biz__badge">
                Inclusivity {inclusivityScore(v)}/100
              </div>
            </div>
            <button className="link" onClick={() => onRemove(v.id)}>
              remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
