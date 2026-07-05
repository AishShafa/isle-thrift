import React, { useState } from "react";

type Props = {
  onSubmit: (payload: { rating: number; comment: string }) => Promise<void>;
};

export function ReviewForm({ onSubmit }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
          await onSubmit({ rating, comment });
          setComment("");
          setRating(5);
        } catch (err: any) {
          setError(err?.message || "Could not submit review");
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-xs font-semibold">Rating</label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="w-full rounded-xl border px-3 py-2 mt-1"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={4}
          className="w-full rounded-xl border px-3 py-2 mt-1"
          placeholder="How was your experience?"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl py-2.5 text-white font-semibold"
        style={{ background: "#FF5A4E", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? "Submitting..." : "Submit review"}
      </button>
    </form>
  );
}
