import type { Formation, GameMode, TeamPreset } from './types';

export const TEAM_PRESETS: TeamPreset[] = [
  {
    id: 'crveni_zmaj',
    name: 'Crveni Zmaj',
    shortCode: 'CZM',
    primaryColor: '#dc2626',
    secondaryColor: '#f8fafc',
    shortsColor: '#f8fafc',
    accentColor: '#fbbf24',
    gkColor: '#16a34a',
  },
  {
    id: 'plavi_talas',
    name: 'Plavi Talas',
    shortCode: 'PLT',
    primaryColor: '#2563eb',
    secondaryColor: '#f8fafc',
    shortsColor: '#0f172a',
    accentColor: '#38bdf8',
    gkColor: '#f59e0b',
  },
  {
    id: 'crno_beli',
    name: 'Crno-Beli',
    shortCode: 'CRB',
    primaryColor: '#1e293b',
    secondaryColor: '#f8fafc',
    shortsColor: '#0f172a',
    accentColor: '#e2e8f0',
    gkColor: '#eab308',
  },
  {
    id: 'zeleni_bor',
    name: 'Zeleni Bor',
    shortCode: 'ZLB',
    primaryColor: '#059669',
    secondaryColor: '#ecfdf5',
    shortsColor: '#064e3b',
    accentColor: '#a3e635',
    gkColor: '#f97316',
  },
  {
    id: 'narandzasti',
    name: 'Amiga Orlovi',
    shortCode: 'AMO',
    primaryColor: '#ea580c',
    secondaryColor: '#fff7ed',
    shortsColor: '#1e1b4b',
    accentColor: '#fde047',
    gkColor: '#06b6d4',
  },
];

export interface PitchDimensions {
  length: number; // X axis (-length/2 .. +length/2)
  width: number;  // Z axis (-width/2 .. +width/2)
  goalWidth: number;
  goalHeight: number;
  goalDepth: number;
  penaltyBoxDepth: number;
  penaltyBoxWidth: number;
  centerCircleRadius: number;
}

export const PITCH_DIMENSIONS: Record<GameMode, PitchDimensions> = {
  arena5v5: {
    length: 38,
    width: 24,
    goalWidth: 5.0,
    goalHeight: 2.2,
    goalDepth: 1.6,
    penaltyBoxDepth: 6.5,
    penaltyBoxWidth: 11.5,
    centerCircleRadius: 4.0,
  },
  classic11v11: {
    length: 68,
    width: 44,
    goalWidth: 7.32,
    goalHeight: 2.44,
    goalDepth: 2.1,
    penaltyBoxDepth: 11.0,
    penaltyBoxWidth: 22.0,
    centerCircleRadius: 6.5,
  },
};

export const BALL_RADIUS = 0.24;
export const PLAYER_RADIUS = 0.36;
export const GRAVITY = 20.0;
export const AFTERTOUCH_WINDOW = 0.35; // 350ms aftertouch window

export const PLAYER_NAMES_HOME = [
  'Stojković',
  'Mijatović',
  'Savićević',
  'Prosinečki',
  'Jugović',
  'Mihajlović',
  'Piksi',
  'Kovačević',
  'Milošević',
  'Đukić',
  'Stanković',
];

export const PLAYER_NAMES_AWAY = [
  'Kralj',
  'Batić',
  'Petrović',
  'Vidić',
  'Ivanović',
  'Jokanović',
  'Tadić',
  'Mitrović',
  'Kolarov',
  'Matić',
  'Žigić',
];

/**
 * Normalized formation slots for home team attacking +X (placed on left half: -0.95..0).
 * Coordinates: [normX (-1..0), normZ (-1..1), role]
 */
export const FORMATIONS_11V11: Record<
  Formation,
  Array<{ nx: number; nz: number; role: 'GK' | 'DEF' | 'MID' | 'FWD' }>
> = {
  '4-4-2': [
    { nx: -0.94, nz: 0, role: 'GK' },
    { nx: -0.72, nz: -0.66, role: 'DEF' },
    { nx: -0.74, nz: -0.22, role: 'DEF' },
    { nx: -0.74, nz: 0.22, role: 'DEF' },
    { nx: -0.72, nz: 0.66, role: 'DEF' },
    { nx: -0.42, nz: -0.68, role: 'MID' },
    { nx: -0.45, nz: -0.22, role: 'MID' },
    { nx: -0.45, nz: 0.22, role: 'MID' },
    { nx: -0.42, nz: 0.68, role: 'MID' },
    { nx: -0.14, nz: -0.24, role: 'FWD' },
    { nx: -0.14, nz: 0.24, role: 'FWD' },
  ],
  '4-3-3': [
    { nx: -0.94, nz: 0, role: 'GK' },
    { nx: -0.72, nz: -0.66, role: 'DEF' },
    { nx: -0.75, nz: -0.22, role: 'DEF' },
    { nx: -0.75, nz: 0.22, role: 'DEF' },
    { nx: -0.72, nz: 0.66, role: 'DEF' },
    { nx: -0.44, nz: -0.46, role: 'MID' },
    { nx: -0.48, nz: 0, role: 'MID' },
    { nx: -0.44, nz: 0.46, role: 'MID' },
    { nx: -0.16, nz: -0.58, role: 'FWD' },
    { nx: -0.12, nz: 0, role: 'FWD' },
    { nx: -0.16, nz: 0.58, role: 'FWD' },
  ],
  '4-2-4': [
    { nx: -0.94, nz: 0, role: 'GK' },
    { nx: -0.72, nz: -0.66, role: 'DEF' },
    { nx: -0.75, nz: -0.22, role: 'DEF' },
    { nx: -0.75, nz: 0.22, role: 'DEF' },
    { nx: -0.72, nz: 0.66, role: 'DEF' },
    { nx: -0.46, nz: -0.28, role: 'MID' },
    { nx: -0.46, nz: 0.28, role: 'MID' },
    { nx: -0.18, nz: -0.68, role: 'FWD' },
    { nx: -0.13, nz: -0.22, role: 'FWD' },
    { nx: -0.13, nz: 0.22, role: 'FWD' },
    { nx: -0.18, nz: 0.68, role: 'FWD' },
  ],
  '5-3-2': [
    { nx: -0.94, nz: 0, role: 'GK' },
    { nx: -0.70, nz: -0.72, role: 'DEF' },
    { nx: -0.76, nz: -0.36, role: 'DEF' },
    { nx: -0.78, nz: 0, role: 'DEF' },
    { nx: -0.76, nz: 0.36, role: 'DEF' },
    { nx: -0.70, nz: 0.72, role: 'DEF' },
    { nx: -0.44, nz: -0.44, role: 'MID' },
    { nx: -0.48, nz: 0, role: 'MID' },
    { nx: -0.44, nz: 0.44, role: 'MID' },
    { nx: -0.15, nz: -0.24, role: 'FWD' },
    { nx: -0.15, nz: 0.24, role: 'FWD' },
  ],
};

export const FORMATION_5V5: Array<{
  nx: number;
  nz: number;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
}> = [
  { nx: -0.92, nz: 0, role: 'GK' },
  { nx: -0.62, nz: -0.45, role: 'DEF' },
  { nx: -0.62, nz: 0.45, role: 'DEF' },
  { nx: -0.32, nz: 0, role: 'MID' },
  { nx: -0.12, nz: 0, role: 'FWD' },
];

export const COMMENTARY_LINES = {
  kickoff: [
    'Sudija je dao znak — lopta kreće sa centra! Pravi Amiga tempo!',
    'Počinje bitka na travnatom tepihu! Držite palčeve i čuvajte loptu u nogama!',
    'Pištaljka je odjeknula! Neka bolji dribler pobedi!',
  ],
  goalHome: [
    'GOOOOL! Skida paučinu iz rašalja! Publika je u transu!',
    'AU, KAKAV EVROGOL! Golman je ostao ukopan kao spomenik!',
    'BOMBA U MREŽU! Lopta je pocepala vazduh i završila iza leđa čuvara mreže!',
    'MAJSTORIJA! Kao na Amigi 500 u najboljim danima — čista poezija!',
  ],
  goalAway: [
    'Gol za goste! Odbrana je zaspala kao posle nedeljnog ručka!',
    'Šok na stadionu! Gosti pogađaju iz kontre, lopta se jedva zaustavila u mreži!',
    'Au, kakav hladan tuš! Moraćemo mnogo čvršće u nastavku!',
  ],
  woodwork: [
    'STATIVA! Trese se konstrukcija gola kao u finalu ‘91!',
    'PREČKA! Kakva šteta, falilo je pola centimetra za evrogol!',
    'ZVONI STATIVA! Golman već može da zapali sveću od sreće!',
  ],
  missedSitter: [
    'AU! Promašen zicer iz snova — lopta ode na parking iza stadiona!',
    'Neverovatno! Svi su već videli loptu u golu, ali je odletela pored stative!',
  ],
  yellowCard: [
    'Sudija vadi žuti karton! Ovo nije ragbi, majstore!',
    'Opomena! Još jedan ovakav klizeći start i ideš pod tuš ranije!',
    'Čist prekršaj za žuti! Sudija sve vidi na ovom terenu.',
  ],
  redCard: [
    'CRVENI KARTON! Brutalan start — direktno u svlačionicu!',
    'DRUGI ŽUTI I KRAJ! Sudija ga šalje na hlađenje do kraja meča!',
  ],
  sinBin5v5: [
    'Grub start s leđa! 20 sekundi hlađenja van arene — čuvaj zglobove!',
    'Isključenje na 20 sekundi! U Brzoj Areni se ovakvi startovi ne praštaju!',
  ],
  mudSplash: [
    'Kakva kaljuga na sredini terena! Lopta staje u blatu kao u živom pesku!',
    'Pršti blato na sve strane! Pravi ostrvski fudbal po teškom terenu!',
  ],
  corner: [
    'Korner! Gužva u šesnaestercu, svi skaču na centaršut!',
    'Udarac iz ugla — odlična prilika za promenu rezultata!',
  ],
  throwIn: [
    'Lopta je prešla aut-liniju — brz povratak u igru!',
  ],
  goalKick: [
    'Gol-aut! Golman vraća loptu u igru dugim ispucavanjem.',
  ],
  halftime: [
    'Kraj prvog poluvremena! Vreme je za kratak predah i taktičke korekcije.',
  ],
  fulltime: [
    'SUDIJA SVIRA KRAJ! Kakva utakmica, kakav spektakl!',
  ],
};
