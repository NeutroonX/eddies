import { create } from 'zustand';

import { createUISlice, type UISlice } from './ui';

export type Store = UISlice;

export const useStore = create<Store>()((...args) => ({
  ...createUISlice(...args),
}));
