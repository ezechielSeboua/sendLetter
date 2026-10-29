import { Fragment, type Ref } from 'react'
import type { LetterFields } from '../lib/letters'
import type { Theme } from '../lib/themes'

// Mots qui sortent du flou l'un après l'autre (adaptation maison du "BlurText" de React Bits,
// en CSS pur : pas de dépendance d'animation en plus). Le texte complet reste lisible
// par les lecteurs d'écran grâce au span .sr-only ; les mots animés sont aria-hidden.
// Les retours à la ligne du message sont conservés.
function BlurWords({ text }: { text: string }) {
  let i = 0
  return (
    <p className="letter-body">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split('\n').map((line, l) => (
          <span key={l}>
            {l > 0 && <br />}
            {line.split(' ').map((w, j, words) => (
              // L'espace reste hors du mot : en fin d'inline-block, il serait supprimé
              <Fragment key={j}>
                <span className="word" style={{ '--d': `${80 + i++ * 22}ms` } as React.CSSProperties}>
                  {w}
                </span>
                {j < words.length - 1 ? ' ' : ''}
              </Fragment>
            ))}
          </span>
        ))}
      </span>
    </p>
  )
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' })

function formatDate(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : dateFormat.format(d)
}

interface Props {
  theme: Theme
  fields: LetterFields
  titleRef?: Ref<HTMLHeadingElement>
}

// Corps de la lettre : destinataire, titre, message, détails selon le type, signature.
export function LetterContent({ theme, fields, titleRef }: Props) {
  const signature = fields.signature || theme.fallbackSignature
  return (
    <>
      {fields.recipient && <p className="letter-to">Pour {fields.recipient}</p>}
      <h2 id="letter-title" ref={titleRef} tabIndex={-1}>
        {fields.title}
      </h2>
      {fields.age && <p className="letter-age">{fields.age} ans !</p>}
      <BlurWords text={fields.message ?? ''} />
      {(fields.date || fields.place) && (
        <dl className="letter-details">
          {fields.date && (
            <div>
              <dt>Quand</dt>
              <dd>{formatDate(fields.date)}</dd>
            </div>
          )}
          {fields.place && (
            <div>
              <dt>Où</dt>
              <dd>{fields.place}</dd>
            </div>
          )}
        </dl>
      )}
      {signature && <p className="letter-signature">{signature}</p>}
    </>
  )
}
