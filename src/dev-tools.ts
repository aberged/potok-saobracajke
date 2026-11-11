import './dev-theme.css';
import type { PotokMapConfig, PotokOwnGroup } from './potok';

// Dev only (main.ts imports it in its DEV block): the map config the guard
// reads, with the three pins accidents use, and a year group to import into.
// The pins are what potok-ide's `PinIcons.catalogue/0` gives in Serbian
// (`problem`, `transport`, and the new `warning`).
//
// - `?lang=en` or `?lang=sr-Cyrl` tries a language.
// - `?group=Nezgode%202015` names the group (the year comes from the name).
// - `?pins=old` plays a Potok without the `warning` pin, `?rights=none` a
//   viewer who may not make sub-groups.
//
// The dev mock keeps the groups it makes in `potok-dev:children`; a year is
// too big for localStorage, so they live until the next reload. To start over:
// localStorage.clear().

const MAP_CONFIG_KEY = 'potok-dev:map-config';
const GROUP_KEY = 'potok-dev:group';

const ICONS: PotokMapConfig['pins']['icons'] = [
  {
    key: 'problem',
    title: 'Problem za prijavu',
    tone: 'alert',
    paths: [
      {
        d: 'M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z',
        evenodd: true,
      },
    ],
  },
  {
    key: 'warning',
    title: 'Upozorenje',
    tone: 'reports',
    paths: [
      {
        d: 'M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z',
        evenodd: true,
      },
    ],
  },
  {
    key: 'transport',
    title: 'Prevoz i dostava',
    tone: 'places',
    paths: [
      {
        d: 'M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 1 1 6 0h3a.75.75 0 0 0 .75-.75V15Z',
        evenodd: false,
      },
      {
        d: 'M8.25 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0ZM15.75 6.75a.75.75 0 0 0-.75.75v11.25c0 .087.015.17.042.248a3 3 0 0 1 5.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 0 0-3.732-10.104 1.837 1.837 0 0 0-1.47-.725H15.75Z',
        evenodd: false,
      },
      { d: 'M19.5 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z', evenodd: false },
    ],
  },
];

function mapConfig(withWarning: boolean): Partial<PotokMapConfig> {
  return {
    pins: {
      drop: 'M16 38.5C11 33 2 24 2 15a14 14 0 1 1 28 0c0 9-9 18-14 23.5Z',
      glyph_transform: 'translate(7 6) scale(0.75)',
      mark_transform: 'translate(22.75 2.75) scale(0.46875)',
      tones: { alert: '#b91c1c', community: '#6d28d9', kind: '#0a5bc4', nature: '#15803d', places: '#0f766e', reports: '#c2410c' },
      kinds: [],
      icons: withWarning ? ICONS : ICONS.filter((look) => look.key !== 'warning'),
    },
  };
}

export function seedDev() {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang');
  if (lang) document.documentElement.lang = lang;

  const pins = params.get('pins');
  if (pins || !localStorage.getItem(MAP_CONFIG_KEY)) {
    localStorage.setItem(MAP_CONFIG_KEY, JSON.stringify(mapConfig(pins !== 'old')));
  }

  const group: Partial<PotokOwnGroup> = { name: params.get('group') ?? 'Nezgode 2025' };
  if (params.get('rights') === 'none') group.can_create_children = false;
  else group.can_create_children = true;
  localStorage.setItem(GROUP_KEY, JSON.stringify(group));
}
