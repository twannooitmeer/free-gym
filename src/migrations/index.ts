import * as migration_20260928_211949_initial from './20260928_211949_initial';

export const migrations = [
  {
    up: migration_20260928_211949_initial.up,
    down: migration_20260928_211949_initial.down,
    name: '20260928_211949_initial'
  },
];
