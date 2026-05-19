export interface UserProfile {
  uid: string;
  email: string;
  username?: string;
  password?: string;
  displayName: string;
  role: 'admin' | 'socio' | 'quotista';
  isActive: boolean;
  assignedDaysOfWeek: number[]; // Array of 0-6
  seasonalQuota?: number;
  bio?: string;
  location?: string;
  photoURL?: string;
  createdAt?: string;
}

export interface PhotoItem {
  url: string;
  caption?: string;
}

export interface HuntingPhoto {
  id: string;
  images: PhotoItem[];
  date: string;
  userUid: string;
  userName: string;
  createdAt: string;
  albumCaption?: string;
  url?: string; // Legacy field
  caption?: string; // Legacy field
}

export interface LakeSettings {
  latitude: number;
  longitude: number;
  seasonStart: string;
  seasonEnd: string;
  weekdaySeasonQuotas?: Record<number, number>;
}

export interface HuntingTime {
  id: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

export interface HuntingDay {
  id: string; // YYYY-MM-DD
  date: string;
  assignedToUid: string;
  assignedToName: string;
  type: 'socio' | 'quotista';
  notes?: string;
  overrideQuota?: number;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'entrata' | 'uscita';
  category: string;
  amount: number;
  description?: string;
  createdBy: string;
  huntingDayId?: string;
  payerUid?: string;
  payerName?: string;
  memberUid?: string;
  memberName?: string;
}

export interface Harvest {
  id: string;
  date: string;
  species: string;
  count: number;
  hunterUid: string;
  hunterName: string;
}

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
  type: 'entrata' | 'uscita';
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string;
  imageUrl?: string;
  authorUid: string;
  authorName: string;
  createdAt: string;
  category: string;
  courseType: 'Antipasto' | 'Primo' | 'Secondo' | 'Altro';
}

export interface HourlyForecast {
  time: string;
  temp: number;
  windSpeed: number;
  windDirection: string;
  rainProb: number;
  rainAmount: number;
  condition: string;
}

export interface WeatherData {
  date: string;
  temp: number;
  tempMin: number;
  condition: string;
  windSpeed: number;
  windDirection: string;
  rainProb: number;
  rainAmount: number;
  icon: string;
  moonPhase: string;
  hourly: HourlyForecast[];
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'harvest' | 'transaction' | 'system' | 'photo';
  targetUid: string;
  read: boolean;
  createdAt: string;
  link?: string;
  metadata?: any;
}

export interface HuntingLimit {
  id: string;
  species: string;
  dailyLimit: number;
  seasonalLimit: number;
  huntingPeriod?: string;
  notes?: string;
  updatedAt: string;
}
