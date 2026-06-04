// platform.js — Detección de plataforma Capacitor vs Web
// Todos los módulos consultan isNative() para ramificar comportamiento

export const isNative = () => !!(window.Capacitor?.isNativePlatform?.());

export const getPlugin = name => window.Capacitor?.Plugins?.[name];

export const hapticImpact = (style = 'MEDIUM') => {
  if (isNative()) {
    getPlugin('Haptics')?.impact({ style });
  } else {
    navigator.vibrate?.(style === 'LIGHT' ? 40 : style === 'HEAVY' ? 120 : 80);
  }
};
