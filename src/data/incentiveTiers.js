// Canada - Excluding Outlets (DFO)
export const fourWeekTiers = [
  { tier: 0, benchmark: 0, commission: 0, incentive: 0 },
  { tier: 1, benchmark: 3800, commission: 0.5, incentive: 19 },
  { tier: 2, benchmark: 6400, commission: 1.0, incentive: 64 },
  { tier: 3, benchmark: 13000, commission: 1.5, incentive: 195 },
  { tier: 4, benchmark: 19000, commission: 2.0, incentive: 380 },
  { tier: 5, benchmark: 25400, commission: 2.5, incentive: 635 },
  { tier: 6, benchmark: 31800, commission: 5.0, incentive: 1590 },
  { tier: 7, benchmark: 44500, commission: 7.0, incentive: 3115 },
  { tier: 8, benchmark: 57200, commission: 9.0, incentive: 5148 },
]

export const fiveWeekTiers = [
  { tier: 0, benchmark: 0, commission: 0, incentive: 0 },
  { tier: 1, benchmark: 4560, commission: 0.5, incentive: 22.80 },
  { tier: 2, benchmark: 7680, commission: 1.0, incentive: 76.80 },
  { tier: 3, benchmark: 15600, commission: 1.5, incentive: 234 },
  { tier: 4, benchmark: 22800, commission: 2.0, incentive: 456 },
  { tier: 5, benchmark: 30480, commission: 2.5, incentive: 762 },
  { tier: 6, benchmark: 38160, commission: 5.0, incentive: 1908 },
  { tier: 7, benchmark: 53400, commission: 7.0, incentive: 3738 },
  { tier: 8, benchmark: 68640, commission: 9.0, incentive: 6177.60 },
]

// GP% qualifier tiers — non-DFO (all 100% once threshold is met)
export const gpPercentTiers = [
  { tier: 0, gpRange: 0, accelerator: 0 },
  { tier: 1, gpRange: 49, accelerator: 100 },
  { tier: 2, gpRange: 52, accelerator: 100 },
  { tier: 3, gpRange: 54, accelerator: 100 },
  { tier: 4, gpRange: 56.5, accelerator: 100 },
  { tier: 5, gpRange: 57.5, accelerator: 100 },
  { tier: 6, gpRange: 58.5, accelerator: 100 },
  { tier: 7, gpRange: 59.5, accelerator: 100 },
  { tier: 8, gpRange: 61, accelerator: 100 },
]

// Canada - Outlets (DFO) 4-week
export const dfoFourWeekTiers = [
  { tier: 0, benchmark: 0, commission: 0, incentive: 0 },
  { tier: 1, benchmark: 2000, commission: 0.5, incentive: 10 },
  { tier: 2, benchmark: 3000, commission: 1.0, incentive: 30 },
  { tier: 3, benchmark: 8000, commission: 1.5, incentive: 120 },
  { tier: 4, benchmark: 15000, commission: 2.0, incentive: 300 },
  { tier: 5, benchmark: 25400, commission: 2.5, incentive: 635 },
  { tier: 6, benchmark: 31800, commission: 5.0, incentive: 1590 },
  { tier: 7, benchmark: 38100, commission: 6.0, incentive: 2286 },
  { tier: 8, benchmark: 44500, commission: 7.0, incentive: 3115 },
]

// Canada - Outlets (DFO) 5-week
export const dfoFiveWeekTiers = [
  { tier: 0, benchmark: 0, commission: 0, incentive: 0 },
  { tier: 1, benchmark: 2400, commission: 0.5, incentive: 12 },
  { tier: 2, benchmark: 3600, commission: 1.0, incentive: 36 },
  { tier: 3, benchmark: 9600, commission: 1.5, incentive: 144 },
  { tier: 4, benchmark: 18000, commission: 2.0, incentive: 360 },
  { tier: 5, benchmark: 30480, commission: 2.5, incentive: 762 },
  { tier: 6, benchmark: 38160, commission: 5.0, incentive: 1908 },
  { tier: 7, benchmark: 45720, commission: 6.0, incentive: 2743.20 },
  { tier: 8, benchmark: 53400, commission: 7.0, incentive: 3738 },
]

// Large Regional Mall — May 2026 rules (graduated accelerators)
export const may2026LrmGpPercentTiers = [
  { tier: 0, gpRange: 0, accelerator: 0 },
  { tier: 1, gpRange: 50, accelerator: 90 },
  { tier: 2, gpRange: 54, accelerator: 100 },
  { tier: 3, gpRange: 56, accelerator: 101 },
  { tier: 4, gpRange: 58, accelerator: 102 },
  { tier: 5, gpRange: 59, accelerator: 103 },
  { tier: 6, gpRange: 60, accelerator: 104 },
  { tier: 7, gpRange: 61, accelerator: 105 },
  { tier: 8, gpRange: 63, accelerator: 107 },
]

// GP% qualifier tiers — DFO (lower thresholds)
export const dfoGpPercentTiers = [
  { tier: 0, gpRange: 0, accelerator: 0 },
  { tier: 1, gpRange: 40, accelerator: 100 },
  { tier: 2, gpRange: 48, accelerator: 100 },
  { tier: 3, gpRange: 51, accelerator: 100 },
  { tier: 4, gpRange: 53.5, accelerator: 100 },
  { tier: 5, gpRange: 54.5, accelerator: 100 },
  { tier: 6, gpRange: 55.5, accelerator: 100 },
  { tier: 7, gpRange: 56.5, accelerator: 100 },
  { tier: 8, gpRange: 57.5, accelerator: 100 },
]
