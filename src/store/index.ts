import { create } from 'zustand';

import { createUISlice, type UISlice } from './ui';
import { createPreferencesSlice, type PreferencesSlice } from './preferences';

export type Store = UISlice & PreferencesSlice;

export const useStore = create<Store>()((...args) => ({
  ...createUISlice(...args),
  ...createPreferencesSlice(...args),
}));
