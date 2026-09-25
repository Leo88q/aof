import { useEffect, useState } from "react";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./ui/Card";
import { api } from "../lib/api";
import { useWalletStr } from "../lib/useWalletStr";
import {UI_ICONS, resourceIcon} from "../lib/visualAssets";

interface DailyStatus {
  canClaim: boolean;
  currentStreak: number;
  longestStreak: number;
  daysSinceLast: number;
  nextReward: {
    day: number;
    potato: number;
    bonus: string;
  };
}

export function DailyRewardButton() {
  const user = useWalletStr();
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(false);
  const [claimedReward, setClaimedReward] = useState<any>(null);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadStatus();
  }, [user]);

  async function loadStatus() {
    try {
      const data = await api.daily.status(user);
      setStatus(data);
    } catch (e) {
      console.error("Daily status failed:", e);
    } finally {
      setLoading(false);
    }
  }

  async function claim() {
    if (!user || claimed) return;
    
    try {
      const result = await api.daily.claim({ user });
      if (result.success) {
        setClaimed(true);
        setClaimedReward(result.reward);
        setConfetti(true);
        
        // Проигрываем звук награды
        playRewardSound();
        
        // Убираем конфетти через 3 сек
        setTimeout(() => setConfetti(false), 3000);
        
        // Перезагружаем статус
        setTimeout(loadStatus, 1000);
      }
    } catch (e: any) {
      console.error("Claim failed:", e);
    }
  }

  if (loading || !user) return null;

  return (
    <Card className="relative overflow-hidden mb-4 bg-gradient-to-br from-gold/10 via-soil-850 to-soil-900 border border-gold/30">
      {/* Конфетти эффект */}
      <AnimatePresence>
        {confetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-10"
          >
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: "50%", 
                  y: "50%",
                  scale: 0,
                  opacity: 1,
                }}
                animate={{ 
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                  scale: 1,
                  opacity: 0,
                }}
                transition={{ 
                  duration: 1.5,
                  delay: i * 0.05,
                  ease: "easeOut"
                }}
                className="absolute text-2xl"
              >
                {[UI_ICONS.rewardStar, UI_ICONS.rewardStar, UI_ICONS.rewardTrophy, resourceIcon("potato") || "", UI_ICONS.noticeSuccess][Math.floor(Math.random() * 5)] && <img src={[UI_ICONS.rewardStar, UI_ICONS.rewardTrophy, resourceIcon("potato") || "", UI_ICONS.noticeSuccess][Math.floor(Math.random() * 4)]} alt="" className="w-6 h-6 object-contain" />}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-20 flex items-center gap-3">
        <motion.div
          animate={{ 
            rotate: claimed ? 360 : [0, -10, 10, -10, 0],
            scale: claimed ? [1, 1.2, 1] : 1,
          }}
          transition={{ 
            rotate: { duration: claimed ? 0.5 : 2, repeat: claimed ? 0 : Infinity },
            scale: { duration: 0.3 }
          }}
          className="text-5xl"
        >
          {claimed ? <img src={UI_ICONS.noticeSuccess} alt="" className="w-12 h-12 object-contain" /> : <img src={UI_ICONS.rewardDaily} alt="" className="w-12 h-12 object-contain" />}
        </motion.div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-parchment font-bold text-sm">Ежедневная награда</h3>
            {status && status.currentStreak > 0 && (
              <span className="px-2 py-0.5 bg-gold/20 text-gold text-xs rounded-full font-bold">
                <ResourceGlyph icon={UI_ICONS.chartsUp} alt="" className="w-4 h-4 inline-block align-text-bottom" /> {status.currentStreak} {status.currentStreak === 1 ? "день" : "дней"}
              </span>
            )}
          </div>
          
          {status?.nextReward && !claimed && (
            <p className="text-straw text-xs">
              День {status.nextReward.day}: <span className="text-wheat-500 font-bold">+{status.nextReward.potato}</span> POTATO
              {status.nextReward.bonus && (
                <span className="ml-1 text-gold">• {status.nextReward.bonus}</span>
              )}
            </p>
          )}
          
          {claimed && claimedReward && (
            <p className="text-sprout-500 text-xs font-bold">
              ✓ Получено: +{claimedReward.potato} POTATO!
            </p>
          )}
        </div>

        <button
          onClick={claim}
          disabled={!status?.canClaim || claimed}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            status?.canClaim && !claimed
              ? "bg-gold text-soil-950 hover:bg-gold/90 shadow-lg shadow-gold/30"
              : "bg-soil-700 text-straw/50 cursor-not-allowed"
          }`}
        >
          {claimed ? "✓" : status?.canClaim ? "Забрать" : "Завтра"}
        </button>
      </div>

      {/* Прогресс недели */}
      {status && (
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const current = status.currentStreak % 7 || 7;
            const isClaimed = day <= current && claimed;
            const isCurrent = day === (current % 7 || 7) + (claimed ? 1 : 0);
            const isPast = day < current || (day === current && claimed);
            
            return (
              <div
                key={day}
                className={`flex-1 h-1 rounded-full ${
                  isPast ? "bg-gold" : isCurrent ? "bg-gold/50 animate-pulse" : "bg-soil-700"
                }`}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

// Web Audio API — генерация звука награды без внешних файлов
function playRewardSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Арпеджио из 4 нот (мажорный аккорд)
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.1 + 0.5);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(audioCtx.currentTime + i * 0.1);
      osc.stop(audioCtx.currentTime + i * 0.1 + 0.5);
    });
  } catch (e) {
    console.warn("Audio not supported:", e);
  }
}
