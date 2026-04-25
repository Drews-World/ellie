import { create } from 'zustand'

export const useWorldStore = create((set) => ({
  activeWidget: null,
  openWidget: (widget) => set({ activeWidget: widget }),
  closeWidget: () => set({ activeWidget: null }),
}))
