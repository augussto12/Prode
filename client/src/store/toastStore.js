import { create } from "zustand";

const useToastStore = create((set) => ({
  toasts: [],
  confirmDialog: null,

  // Añade un toast y lo programa para morir en 3.5 segundos
  addToast: ({ type = "info", message }) => {
    const id = Date.now() + Math.random();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3500);
  },

  // Quitador manual si hace falta
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Acción estática para invocar el cartel grande al centro
  askConfirm: ({
    title,
    message,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    onConfirm,
  }) =>
    set({
      confirmDialog: { title, message, confirmText, cancelText, onConfirm },
    }),

  // Cierra el cartel al centro
  closeConfirm: () => set({ confirmDialog: null }),
}));

export default useToastStore;
