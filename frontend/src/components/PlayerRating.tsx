import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { UI_ICONS } from "../lib/visualAssets";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { useWalletStr } from "../lib/useWalletStr";
import { useLocale } from "../i18n/LocaleProvider";
import { ratingCopy } from "../i18n/ratingCopy";

interface PlayerRatingProps {
  toUser: string;
  context: "trade" | "craft" | "guild";
  referenceId?: string;
  onSubmitted?: () => void;
}

export function PlayerRating({ toUser, context, referenceId, onSubmitted }: PlayerRatingProps) {
  const fromUser = useWalletStr();
  const { language } = useLocale();
  const text = ratingCopy[language];
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit() {
    if (rating === 0 || !fromUser) return;
    
    setLoading(true);
    setError(false);
    try {
      await api.rating.submit({
        fromUser,
        toUser,
        context,
        referenceId,
        rating,
        comment: comment || undefined,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (e) {
      console.error("Rating failed:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="p-4 bg-sprout-500/10 border border-sprout-500/30 rounded-lg text-center">
        <p className="text-sprout-500 font-semibold inline-flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.noticeSuccess} alt="" className="w-4 h-4" /> {text.submitted}</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-soil-800/60 rounded-lg">
      <h3 className="text-parchment font-semibold text-sm mb-3">
        {text.rateTitle}
      </h3>
      
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => { setRating(star); setError(false); }}
            type="button"
            aria-label={text.chooseStar(star)}
            aria-pressed={rating === star}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="text-3xl transition-transform hover:scale-110 active:scale-95"
          >
            <span className={(hover || rating) >= star ? "text-accent-500" : "text-soil-600"}>
              ★
            </span>
          </button>
        ))}
      </div>
      
      {!fromUser && <p className="text-straw text-sm mb-3 [overflow-wrap:anywhere]">{text.connect}</p>}
      {error && <p role="alert" className="text-ember-400 text-sm mb-3 [overflow-wrap:anywhere]">{text.submitUnavailable}</p>}
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={text.commentPlaceholder}
            aria-label={text.commentPlaceholder}
            className="w-full p-2 bg-soil-900 border border-straw/20 rounded text-parchment text-sm resize-none"
            rows={2}
          />
          
          <button
            onClick={handleSubmit}
            type="button"
            disabled={loading || !fromUser}
            className="w-full mt-3 py-2 bg-accent-600 text-white text-sm font-semibold rounded-lg hover:bg-accent-700 transition disabled:opacity-50"
          >
            {loading ? text.sending : text.submit}
          </button>
        </>
      )}
    </div>
  );
}
