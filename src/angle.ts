/**
 * İki açı arasındaki en kısa (yönlü) farkı döndürür, (-π, π] aralığında.
 * Gezegen çevresi bir daire olduğu için "sağa mı sola mı dönmek daha kısa" sorusunu
 * bununla cevaplıyoruz (davranış AI'sı ve hedefe ulaşma kontrolü için gerekli).
 */
export function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
