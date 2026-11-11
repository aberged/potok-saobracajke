// An accident as the sub-group `createChildren` makes: public, not inheriting
// the year group's members, with its place, pin and key.

import type { Accident } from '../data/accidents';
import { descriptionOf, nameOf, pinOf } from '../describe/describe';
import type { PotokNewChild } from '../potok';

export type AccidentChild = PotokNewChild & { key: string; name: string; lat: number; lng: number; pin: string };

export function childOf(accident: Accident): AccidentChild {
  return {
    key: accident.key,
    name: nameOf(accident),
    description: descriptionOf(accident),
    descriptionFormat: 'markdown',
    lat: accident.lat,
    lng: accident.lng,
    pin: pinOf(accident.severity),
    isPublic: true,
    inheritsMembers: false,
  };
}
