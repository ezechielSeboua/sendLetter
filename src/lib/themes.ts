import type { FieldKey } from './letters'
import type { ParticleEffect } from './particles'

// Les trois types de lettre partagent tout le code : seuls les textes, la palette, l'effet
// et les champs du formulaire de configuration changent.
export type ThemeId = 'invitation' | 'birthday' | 'crush'

export interface FieldDef {
  key: FieldKey
  label: string
  kind: 'text' | 'textarea' | 'datetime' | 'number'
  required?: boolean
  placeholder?: string
  maxLength?: number
}

const title: FieldDef = { key: 'title', label: 'Titre', kind: 'text', required: true, maxLength: 60 }
const message: FieldDef = { key: 'message', label: 'Message', kind: 'textarea', required: true, maxLength: 1500 }

export interface Theme {
  label: string
  subtitle: string
  // Variables CSS de :root (lues aussi par la scène 3D via readTokens)
  colors: Record<string, string>
  defaultTitle: string
  defaultMessage: string
  heading: string
  headingSub: string
  sealButton: string
  sealHint: string
  actionLabel: string
  actionHeart: boolean
  actionAnnounce: string
  particles: ParticleEffect
  fields: FieldDef[]
  // Signature affichée quand le champ est laissé vide
  fallbackSignature?: string
}

export const themes: Record<ThemeId, Theme> = {
  invitation: {
    label: 'Invitation',
    subtitle: 'Confidentiel & Royal',
    colors: {
      '--night': '#050505',
      '--night-glow': '#1a1a1a',
      '--envelope': '#FDFDFD',
      '--envelope-shade': '#EBEBEB',
      '--lining': '#D4AF37',
      '--wax': '#990000',
      '--paper': '#f0ece1',
      '--ink': '#111111',
      '--ink-soft': '#444444',
      '--rose-ink': '#990000',
      '--cream': '#ffffff',
    },
    defaultTitle: 'Strictement Confidentiel',
    defaultMessage: "Votre présence est requise pour un événement d'une importance capitale. Les enjeux sont grands et le silence est d'or. Prenez connaissance des directives et préparez-vous en conséquence. Nous comptons sur vous.",
    heading: 'Message De la plus haute importance',
    headingSub: 'Pour sa majesté',
    sealButton: 'Touchez le sceau royal',
    sealHint: 'Pour ouvrir la lettre.',
    actionLabel: 'Votre humble serviteur',
    actionHeart: false,
    actionAnnounce: 'Vœu exaucé.',
    particles: 'embers',
    fields: [
      { key: 'recipient', label: 'Destinataire', kind: 'text', required: true, placeholder: 'Sa Majesté Marie', maxLength: 60 },
      title,
      message,
      { key: 'date', label: 'Date et heure', kind: 'datetime', required: true },
      { key: 'place', label: 'Lieu', kind: 'text', required: true, placeholder: 'Le Grand Salon, 12 rue des Lys', maxLength: 120 },
      { key: 'signature', label: 'Signature', kind: 'text', placeholder: 'Le Cabinet Royal', maxLength: 60 },
    ],
  },
  birthday: {
    label: 'Anniversaire',
    subtitle: 'Fête & Surprise',
    colors: {
      '--night': '#0B132B',
      '--night-glow': '#1C2541',
      '--envelope': '#E29547',
      '--envelope-shade': '#C4782A',
      '--lining': '#FFF3E3',
      '--wax': '#D92038',
      '--paper': '#FAF8F5',
      '--ink': '#0F1E36',
      '--ink-soft': '#4F637A',
      '--rose-ink': '#26A69A',
      '--cream': '#FAF8F5',
    },
    defaultTitle: 'Joyeux Anniversaire !',
    defaultMessage: "Je te souhaite une journée remplie de joie, de rires et de belles surprises. Que cette nouvelle année t'apporte tout ce que tu désires. Profite bien de cette journée qui est la tienne !",
    heading: 'Une surprise t’attend',
    headingSub: 'prête à être découverte',
    sealButton: 'Briser le sceau',
    sealHint: 'ou touche l’enveloppe',
    actionLabel: 'Joyeux Anniversaire !',
    actionHeart: false,
    actionAnnounce: 'Confettis lancés !',
    particles: 'confetti',
    fields: [
      { key: 'recipient', label: 'Prénom', kind: 'text', required: true, placeholder: 'Marie', maxLength: 60 },
      { key: 'age', label: 'Âge (facultatif)', kind: 'number', placeholder: '25' },
      title,
      message,
      { key: 'signature', label: 'Signature', kind: 'text', placeholder: 'Ton frère', maxLength: 60 },
    ],
  },
  crush: {
    label: 'Crush',
    subtitle: 'Intime & Romantique',
    colors: {
      '--night': '#140b0d',
      '--night-glow': '#2c171b',
      '--envelope': '#2a2526',
      '--envelope-shade': '#1f1b1c',
      '--lining': '#6e2636',
      '--wax': '#c2364f',
      '--paper': '#f3e9da',
      '--ink': '#3a2428',
      '--ink-soft': '#6b5256',
      '--rose-ink': '#a3263d',
      '--cream': '#efe3d3',
    },
    defaultTitle: 'Oh toi là',
    defaultMessage: 'Même si parfois tu es impolie, un peu immature ou énervante, je veux que tu saches que je t’aime de tout mon cœur. Tes défauts font partie de toi et ce sont eux qui te rendent unique. Chaque sourire, chaque éclat de rire, chaque petit geste tendre me rappelle à quel point je suis chanceux de t’avoir dans ma vie. Tu apportes de la lumière même dans les journées les plus grises et chaque moment passé à tes côtés me rend plus heureux et plus complet. Je t’aime pour ce que tu es, pour ton authenticité et pour la personne incroyable que tu continues d’être chaque jour.',
    heading: 'Une lettre t’attend',
    headingSub: 'scellée, rien que pour toi',
    sealButton: 'Briser le sceau',
    sealHint: 'ou touche l’enveloppe',
    actionLabel: 'Je t’aime',
    actionHeart: true,
    actionAnnounce: 'Je t’aime, envoyé avec plein de cœurs.',
    particles: 'hearts',
    fields: [
      { key: 'recipient', label: 'Prénom ou surnom', kind: 'text', required: true, placeholder: 'Ma belle', maxLength: 60 },
      title,
      message,
      { key: 'signature', label: 'Signature', kind: 'text', placeholder: 'Vide = Anonyme', maxLength: 60 },
    ],
    fallbackSignature: 'Anonyme',
  },
}

export const themeIds = Object.keys(themes) as ThemeId[]

// À appeler avant de monter la scène 3D : elle lit ces variables à son initialisation.
export function applyTheme(theme: Theme) {
  const root = document.documentElement.style
  for (const [name, value] of Object.entries(theme.colors)) root.setProperty(name, value)
}
