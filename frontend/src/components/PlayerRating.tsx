import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { UI_ICONS } from "../lib/visualAssets";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { useWalletStr } from "../lib/useWalletStr";

interface PlayerRatingProps {
  toUser: string;
  context: "trade" | "craft" | "guild";
  referenceId?: string;
  onSubmitted?: () => void;
}

export function PlayerRating({ toUser, context, referenceId, onSubmitted }: PlayerRatingProps) {
  const fromUser = useWalletStr();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (rating === 0 || !fromUser) return;
    
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="p-4 bg-sprout-500/10 border border-sprout-500/30 rounded-lg text-center">
        <p className="text-sprout-500 font-semibold inline-flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.noticeSuccess} alt="" className="w-4 h-4" /> Спасибо за оценку!</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-soil-800/60 rounded-lg">
      <h3 className="text-parchment font-semibold text-sm mb-3">
        Оцените игрока
      </h3>
      
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="text-3xl transition-transform hover:scale-110 active:scale-95"
          >
            <span className={(hover || rating) >= star ? "text-wheat-500" : "text-soil-600"}>
              ★
            </span>
          </button>
        ))}
      </div>
      
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий (опционально)..."
            className="w-full p-2 bg-soil-900 border border-straw/20 rounded text-parchment text-sm resize-none"
            rows={2}
          />
          
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-3 py-2 bg-wheat-600 text-white text-sm font-semibold rounded-lg hover:bg-wheat-700 transition disabled:opacity-50"
          >
            {loading ? "Отправка..." : "Отправить оценку"}
          </button>
        </>
      )}
    </div>
  );
}
