import { useState, useEffect } from 'react';
import { WeatherData, HourlyForecast } from '../types';

const getWindDirection = (degree: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(degree / 45) % 8];
};

const getMoonPhase = (date: Date): string => {
  const lp = 2551443; 
  const now = new Date(date);
  const newMoon = new Date('1970-01-07T20:35:00Z');
  const phase = ((now.getTime() - newMoon.getTime()) / 1000) % lp;
  const res = Math.floor((phase / lp) * 8);
  
  const phases = [
    'Luna Nuova', 
    'Luna Crescente', 
    'Primo Quarto', 
    'Gibbosa Crescente', 
    'Luna Piena', 
    'Gibbosa Calante', 
    'Ultimo Quarto', 
    'Luna Calante'
  ];
  return phases[res];
};

export function useWeather(lat?: number, lon?: number) {
  const [weather, setWeather] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we have valid-looking coordinates
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

    const fetchWeather = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/weather?latitude=${lat}&longitude=${lon}`
        );
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();

        const dailyData: WeatherData[] = data.daily.time.map((dateStr: string, i: number) => {
          const date = new Date(dateStr);
          const startIdx = i * 24;
          const endIdx = startIdx + 24;
          
          const hourly: HourlyForecast[] = data.hourly.time.slice(startIdx, endIdx).map((timeStr: string, h: number) => {
            const idx = startIdx + h;
            return {
              time: timeStr.split('T')[1],
              temp: data.hourly.temperature_2m[idx],
              windSpeed: data.hourly.wind_speed_10m[idx],
              windDirection: getWindDirection(data.hourly.wind_direction_10m[idx]),
              rainProb: data.hourly.precipitation_probability[idx],
              rainAmount: data.hourly.precipitation[idx],
              condition: data.hourly.weather_code[idx] > 50 ? 'Pioggia' : 
                         data.hourly.weather_code[idx] > 0 ? 'Nuvoloso' : 'Sereno'
            };
          });

          return {
            date: dateStr,
            temp: data.daily.temperature_2m_max[i],
            tempMin: data.daily.temperature_2m_min[i],
            condition: data.daily.weather_code[i] > 50 ? 'Pioggia' : 
                       data.daily.weather_code[i] > 0 ? 'Nuvoloso' : 'Sereno',
            windSpeed: data.daily.wind_speed_10m_max[i],
            windDirection: getWindDirection(data.daily.wind_direction_10m_dominant[i]),
            rainProb: data.daily.precipitation_probability_max[i],
            rainAmount: data.daily.precipitation_sum[i],
            icon: data.daily.weather_code[i] > 50 ? 'cloud-rain' : 'sun',
            moonPhase: getMoonPhase(date),
            hourly
          };
        });

        setWeather(dailyData);
      } catch (error) {
        console.error("Error fetching weather:", error);
        
        // Fallback to mock data to keep UI functional
        const mockData: WeatherData[] = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          return {
            date: dateStr,
            temp: 15 + Math.random() * 5,
            tempMin: 8 + Math.random() * 4,
            condition: 'Offline',
            windSpeed: 10,
            windDirection: 'N',
            rainProb: 0,
            rainAmount: 0,
            icon: 'sun',
            moonPhase: getMoonPhase(d),
            hourly: Array.from({ length: 24 }).map((_, h) => ({
              time: `${h.toString().padStart(2, '0')}:00`,
              temp: 12 + Math.random() * 6,
              windSpeed: 8,
              windDirection: 'N',
              rainProb: 0,
              rainAmount: 0,
              condition: 'N/A'
            }))
          };
        });
        setWeather(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [lat, lon]);

  return { weather, loading };
}
