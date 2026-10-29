// Durées exprimées en secondes côté serveur, saisies en minutes, heures ou jours dans l'interface.
export type Unit = 'minutes' | 'hours' | 'days'

export const unitSeconds: Record<Unit, number> = { minutes: 60, hours: 3600, days: 86400 }

const unitWords: Record<Unit, [string, string]> = {
  minutes: ['minute', 'minutes'],
  hours: ['heure', 'heures'],
  days: ['jour', 'jours'],
}

export const unitLabel = (unit: Unit) => unitWords[unit][1]

// Plus grande unité qui tombe juste parmi celles proposées (7 jours plutôt que 168 heures).
export function splitDuration(seconds: number, units: Unit[]) {
  const sorted = [...units].sort((a, b) => unitSeconds[b] - unitSeconds[a])
  const unit = sorted.find((u) => seconds % unitSeconds[u] === 0) ?? sorted[sorted.length - 1]
  return { value: Math.round(seconds / unitSeconds[unit]), unit }
}

export function formatDuration(seconds: number) {
  const { value, unit } = splitDuration(seconds, ['minutes', 'hours', 'days'])
  return `${value} ${unitWords[unit][value > 1 ? 1 : 0]}`
}
