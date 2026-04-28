import React, { useState, useEffect } from 'react';
import { useWeather } from '../hooks/useWeather';
import { CloudRain, Sun, Wind, Cloud, Thermometer, Droplets, MapPin, Calendar as CalendarIcon, ShieldAlert, Compass, Moon, ChevronRight, X, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { subscribeToSettings } from '../services';
import { LakeSettings, WeatherData } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const WeatherIcon = ({ condition, size = 24 }: { condition: string, size?: number }) => {
  if (condition.includes('Pioggia')) return <CloudRain size={size} className="text-blue-400" />;
  if (condition.includes('Sereno')) return <Sun size={size} className="text-amber-400" />;
  if (condition.includes('Vento')) return <Wind size={size} className="text-slate-400" />;
  return <Cloud size={size} className="text-slate-300" />;
};

export function WeatherPage() {
  const [settings, setSettings] = useState<LakeSettings | null>(null);
  const { weather, loading: weatherLoading } = useWeather(settings?.latitude, settings?.longitude);
  const [selectedDay, setSelectedDay] = useState<WeatherData | null>(null);

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  // Set today as default selection if not set
  useEffect(() => {
    if (weather.length > 0 && !selectedDay) {
      setSelectedDay(weather[0]);
    }
  }, [weather, selectedDay]);

  if (weatherLoading || !settings || !selectedDay) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lake-green"></div>
    </div>
  );

  const today = weather[0];

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 max-w-full overflow-x-hidden">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 sm:gap-4 px-1 sm:px-0">
        <div>
          <div className="flex items-center gap-2 text-lake-green mb-1">
            <MapPin size={14} className="sm:size-4" />
            <span className="text-[10px] sm:text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-gray">
              Lago ({settings.latitude.toFixed(4)}, {settings.longitude.toFixed(4)})
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-lake-green leading-tight">Metereologia</h1>
          <p className="text-slate-gray text-xs sm:text-base font-medium">Previsioni orarie e fasi lunari per la caccia</p>
        </div>
      </header>

      {/* Primary Detail Section (Moved to the top) */}
      <div className="space-y-6 w-full">
        <motion.div 
          key={selectedDay.date}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 w-full"
        >
          {/* Overview Card */}
          <div className="bg-lake-green rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8 text-white relative overflow-hidden shadow-xl w-full">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
            <div className="relative z-10 w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 sm:mb-8">
                <div className="w-full sm:w-auto">
                  <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter mb-1 leading-tight break-words">
                    {format(new Date(selectedDay.date), 'EEEE dd MMMM', { locale: it })}
                  </h2>
                  <p className="text-accent-gold font-bold uppercase tracking-[0.2em] text-[8px] sm:text-[9px]">Oggi al Lago</p>
                </div>
                <div className="w-full sm:w-auto">
                  <div className="bg-white/10 px-3 py-2 rounded-lg border border-white/10 flex items-center gap-3 sm:justify-end">
                    <Moon size={16} className="text-accent-gold shrink-0" />
                    <div>
                      <p className="text-[7px] font-black uppercase tracking-widest text-white/50 leading-none mb-1">Luna</p>
                      <p className="text-[10px] sm:text-xs font-bold leading-none">{selectedDay.moonPhase}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-8 md:gap-10">
                <div className="flex flex-wrap items-center gap-8 sm:gap-12">
                  <div className="flex items-center gap-5">
                    <div className="bg-white/10 p-4 rounded-full border border-white/10 shrink-0 shadow-inner">
                      <WeatherIcon condition={selectedDay.condition} size={40} />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-none tracking-tighter text-white">
                          {selectedDay.tempMin.toFixed(0)}°
                        </span>
                        <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-none tracking-tighter text-white">
                          / {selectedDay.temp.toFixed(1)}°
                        </span>
                      </div>
                      <span className="text-[10px] sm:text-xs font-black text-white/50 uppercase tracking-[0.2em]">Temperatura Min / Max</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row flex-wrap items-center gap-3 sm:gap-6">
                  <div className="flex items-center gap-4 bg-white/10 px-4 py-4 sm:px-6 rounded-xl border border-white/10 backdrop-blur-sm flex-1 min-w-[140px] max-w-[220px]">
                    <Wind size={24} className="text-accent-gold shrink-0" />
                    <div>
                      <p className="text-lg sm:text-2xl font-black leading-none mb-1">
                        {selectedDay.windSpeed.toFixed(1)} 
                        <span className="text-[9px] sm:text-xs font-normal opacity-50 ml-1">km/h</span>
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/40">{selectedDay.windDirection}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-white/10 px-4 py-4 sm:px-6 rounded-xl border border-white/10 backdrop-blur-sm flex-1 min-w-[140px] max-w-[220px]">
                    <Droplets size={24} className="text-blue-300 shrink-0" />
                    <div>
                      <p className="text-lg sm:text-2xl font-black leading-none mb-1">
                        {selectedDay.rainProb}% 
                        <span className="text-[9px] sm:text-xs font-normal opacity-50 ml-1">{selectedDay.rainAmount.toFixed(1)}mm</span>
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Pioggia</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Detail */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden w-full max-w-full">
            <div className="p-3 sm:p-4 bg-off-white border-b border-slate-100 flex items-center gap-3">
              <Clock size={16} className="text-lake-green" />
              <h4 className="text-[0.6rem] sm:text-[0.65rem] font-black text-lake-green uppercase tracking-[0.2em]">Dettaglio Orario Previsioni</h4>
            </div>
            <div className="overflow-x-auto scrollbar-hide w-full">
              <div className="flex min-w-max p-4 sm:p-6 gap-8 sm:gap-10">
                {selectedDay.hourly.map((hour, h) => (
                  <div key={h} className="flex flex-col items-center gap-4 sm:gap-6 text-center">
                    <span className={cn(
                      "text-xs sm:text-sm font-black uppercase tracking-wider",
                      h % 4 === 0 ? "text-lake-green" : "text-slate-400"
                    )}>{hour.time}</span>
                    <WeatherIcon condition={hour.condition} size={32} />
                    <span className="text-base sm:text-xl font-bold text-slate-900">{hour.temp.toFixed(0)}°</span>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex flex-col items-center opacity-60">
                        <Compass size={18} className="text-accent-gold mb-0.5" />
                        <span className="text-[10px] sm:text-[11px] font-black leading-none">{hour.windDirection}</span>
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 whitespace-nowrap">{hour.windSpeed.toFixed(0)} km/h</span>
                      </div>
                      <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden relative mx-auto">
                        <div 
                          className="bg-blue-400 h-full absolute left-0 top-0 transition-all" 
                          style={{ width: `${hour.rainProb}%` }}
                        />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] sm:text-[13px] font-black text-blue-500 leading-none">{hour.rainProb}%</span>
                        <span className="text-[9px] font-bold text-slate-400 mt-0.5">{hour.rainAmount.toFixed(1)}mm</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Daily Selection Tabs (Moved below) */}
      <div className="space-y-4 w-full max-w-full overflow-hidden">
        <h3 className="text-[0.6rem] sm:text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] px-2 text-center sm:text-left">Seleziona Giorno per Dettagli</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {weather.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "p-3 sm:px-4 sm:py-3 rounded-lg border transition-all flex items-center justify-between group",
                selectedDay.date === day.date 
                  ? "bg-lake-green border-lake-green text-white shadow-lg ring-1 ring-accent-gold" 
                  : "bg-white border-slate-100 text-slate-600 hover:border-lake-green/30"
              )}
            >
              <div className="flex flex-col items-start text-left">
                <span className={cn(
                  "text-[0.6rem] sm:text-[0.65rem] font-black uppercase tracking-widest leading-none mb-1",
                  selectedDay.date === day.date ? "text-white/60" : "text-slate-400"
                )}>
                  {format(new Date(day.date), 'EEE', { locale: it })} {format(new Date(day.date), 'dd', { locale: it })}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base sm:text-lg font-black leading-none">{day.temp.toFixed(0)}°</span>
                  <span className={cn(
                    "text-[10px] sm:text-[11px] font-bold",
                    selectedDay.date === day.date ? "text-white/40" : "text-slate-300"
                  )}>
                     {day.tempMin.toFixed(0)}°
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end opacity-40">
                  {day.rainProb > 30 && <Droplets size={12} className={selectedDay.date === day.date ? "text-blue-200" : "text-blue-400"} />}
                  {day.windSpeed > 15 && <Wind size={12} className={selectedDay.date === day.date ? "text-white" : "text-slate-400"} />}
                </div>
                <WeatherIcon condition={day.condition} size={28} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Note Section */}
      <div className="bg-white p-5 sm:p-6 rounded-lg border-l-4 border-accent-gold shadow-sm flex items-start gap-3 sm:gap-4 mx-auto max-w-4xl w-full">
        <ShieldAlert size={18} className="text-accent-gold shrink-0 mt-1" />
        <div>
          <h4 className="text-[0.6rem] sm:text-[0.65rem] font-black uppercase tracking-widest text-slate-gray mb-1">Informazioni per la Cacciata</h4>
          <p className="text-[11px] sm:text-xs text-slate-gray leading-relaxed font-medium">
            Le finestre di attività del selvatico sono spesso correlate ai cambi di luce (alba/tromonto) e ai cali bruschi della pressione barometrica.
            {selectedDay.rainProb > 50 && " Alta probabilità di pioggia: assicurarsi che i capanni siano ben coperti e le esche posizionate in zone di corrente ridotta."}
            {selectedDay.windSpeed > 15 && " Vento sostenuto previsto: monitorare la direzione per il posizionamento degli stampi sopravento."}
          </p>
        </div>
      </div>
    </div>
  );
}
