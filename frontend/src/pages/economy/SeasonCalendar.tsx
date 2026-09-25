import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { UI_ICONS } from "../../lib/visualAssets";

const DAYS_PER_SEASON = 42;
const SEASONS = [
  { name: "spring", icon: "🌸", color: "from-pink-500/20 to-green-500/20", label: "Весна" },
  { name: "summer", icon: "☀️", color: "from-yellow-500/20 to-orange-500/20", label: "Лето" },
  { name: "autumn", icon: "🍂", color: "from-orange-500/20 to-red-500/20", label: "Осень" },
  { name: "winter", icon: "❄️", color: "from-blue-500/20 to-cyan-500/20", label: "Зима" },
];

const WEATHER_TYPES = [
  { type: "sunny", icon: UI_ICONS.weatherNominal, name: "Номинал", effect: "Еда +10%" },
  { type: "rain", icon: UI_ICONS.weatherSurge, name: "Скачок", effect: "Схема +10%" },
  { type: "drought", icon: UI_ICONS.weatherBlackout, name: "Блэкаут", effect: "Всё -15%, редкий лут +50%" },
  { type: "harvest_festival", icon: UI_ICONS.weatherFrenzy, name: "Френзи", effect: "Множитель" },
];

interface CalendarDay {
  dayId: number;
  date: string;
  season: string;
  seasonIndex: number;
  dayOfSeason: number;
  weather: string;
  isToday: boolean;
}

export function SeasonCalendar() {
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const epoch = new Date("2024-01-01").getTime();
    const today = new Date();
    const todayMs = today.getTime();
    const todayDayId = Math.floor((todayMs - epoch) / 86400000);
    const todayDayOfSeason = todayDayId % DAYS_PER_SEASON;

    const startDayId = todayDayId - todayDayOfSeason;
    const days: CalendarDay[] = [];

    // Текущий сезон (42 дня)
    for (let i = 0; i < DAYS_PER_SEASON; i++) {
      const dayId = startDayId + i;
      const date = new Date(epoch + dayId * 86400000);
      const seasonIndex = Math.floor((dayId / DAYS_PER_SEASON) % 4);
      const dayOfSeason = dayId % DAYS_PER_SEASON;
      
      const hash = dayId * 0x9E3779B9;
      const roll = (hash >>> 0) % 100;
      let weather = "sunny";
      if (roll < 20) weather = "drought";
      else if (roll < 50) weather = "rain";
      else if (roll < 90) weather = "sunny";
      else weather = "harvest_festival";

      days.push({
        dayId,
        date: date.toISOString().split("T")[0],
        season: SEASONS[seasonIndex].name,
        seasonIndex,
        dayOfSeason,
        weather,
        isToday: dayId === todayDayId,
      });
    }

    // Следующий сезон (42 дня)
    for (let i = 0; i < DAYS_PER_SEASON; i++) {
      const dayId = startDayId + DAYS_PER_SEASON + i;
      const date = new Date(epoch + dayId * 86400000);
      const seasonIndex = Math.floor((dayId / DAYS_PER_SEASON) % 4);
      const dayOfSeason = dayId % DAYS_PER_SEASON;
      
      const hash = dayId * 0x9E3779B9;
      const roll = (hash >>> 0) % 100;
      let weather = "sunny";
      if (roll < 20) weather = "drought";
      else if (roll < 50) weather = "rain";
      else if (roll < 90) weather = "sunny";
      else weather = "harvest_festival";

      days.push({
        dayId,
        date: date.toISOString().split("T")[0],
        season: SEASONS[seasonIndex].name,
        seasonIndex,
        dayOfSeason,
        weather,
        isToday: false,
      });
    }

    setCalendar(days);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-parchment">Loading календаря...</div>
      </div>
    );
  }

  const currentSeason = calendar.find(d => d.isToday)?.season || "spring";
  const currentSeasonData = SEASONS.find(s => s.name === currentSeason);

  return (
    <div className="space-y-6">
      {/* Заголовок сезона */}
      <Card className={`p-6 bg-gradient-to-br ${currentSeasonData?.color || ""} border border-straw/10`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-parchment capitalize">
              {currentSeasonData?.icon} {currentSeasonData?.label}
            </h2>
            <p className="text-straw text-sm mt-1">
              42 дня • Смена погоды каждый день
            </p>
          </div>
          <motion.div
            className="text-6xl"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            {currentSeasonData?.icon}
          </motion.div>
        </div>
      </Card>

      {/* Легенда погоды */}
      <Card className="p-4 bg-soil-800 border border-straw/10">
        <h3 className="text-lg font-semibold text-parchment mb-3">
          Типы погоды
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {WEATHER_TYPES.map(w => (
            <div key={w.type} className="flex items-center gap-3 p-2 bg-soil-700/50 rounded-lg">
              <img src={w.icon} alt="" className="w-6 h-6 object-contain" />
              <div>
                <div className="text-parchment text-sm font-medium">{w.name}</div>
                <div className="text-straw text-xs">{w.effect}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Календарь */}
      <div>
        <h3 className="text-lg font-semibold text-parchment mb-3">
          Календарь эпох
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {calendar.map((day, i) => {
            const weatherData = WEATHER_TYPES.find(w => w.type === day.weather);
            
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.01 }}
                className={`
                  aspect-square p-2 rounded-lg border transition-all
                  ${day.isToday 
                    ? "border-gold bg-gold/20 ring-2 ring-gold/50" 
                    : "border-straw/10 bg-soil-800 hover:bg-soil-700"
                  }
                `}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <img src={weatherData?.icon || UI_ICONS.weatherNominal} alt="" className="w-6 h-6 object-contain mx-auto mb-1" />
                  <div className="text-xs text-straw">
                    {day.dayOfSeason + 1}
                  </div>
                  {day.isToday && (
                    <div className="text-xs text-gold font-bold mt-1">
                      Сегодня
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Информация о сезонах */}
      <Card className="p-4 bg-soil-800 border border-straw/10">
        <h3 className="text-lg font-semibold text-parchment mb-3">
          Об эпохах
        </h3>
        <div className="space-y-3 text-sm text-straw">
          <p>
            Каждая эпоха длится <span className="text-parchment font-semibold">42 дня</span>.
            Всего 4 эпохи в цикле (42 дня каждая).
          </p>
          <p>
            Погода меняется каждый день и влияет на добычу ресурсов:
          </p>
          <ul className="space-y-1">
            <li className="flex items-center gap-2"><img src={UI_ICONS.weatherNominal} alt="" className="w-4 h-4 object-contain" /> Номинал: еда +10%</li>
            <li className="flex items-center gap-2"><img src={UI_ICONS.weatherSurge} alt="" className="w-4 h-4 object-contain" /> Скачок: дерево +10%</li>
            <li className="flex items-center gap-2"><img src={UI_ICONS.weatherBlackout} alt="" className="w-4 h-4 object-contain" /> Блэкаут: всё -15%, но редкий лут +50%</li>
            <li className="flex items-center gap-2"><img src={UI_ICONS.weatherFrenzy} alt="" className="w-4 h-4 object-contain" /> Френзи: множитель на все ресурсы</li>
          </ul>
          <p className="text-xs text-straw/60 mt-3">
            Погода детерминирована — одинакова для всех игроков в один день.
          </p>
        </div>
      </Card>
    </div>
  );
}
