/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { OrdoEmailLayout, styles, Link, Text } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'
import { APP_URL } from '../app-url.ts'

interface Props {
  recipientName?: string
  deliverableTitle?: string
  projectName?: string
  reviewerName?: string
  feedback?: string
  url?: string
}

const Email = ({
  recipientName = 'there',
  deliverableTitle = 'a deliverable',
  projectName = 'your project',
  reviewerName = 'Your client',
  feedback,
  url = 'https://useordo.app',
}: Props) => (
  <OrdoEmailLayout
    siteName="Ordo"
    categoryLabel="Changes requested"
    preview={`Changes requested on ${deliverableTitle}`}
  >
    <Text style={styles.heading}>Changes requested</Text>
    <Text style={styles.text}>
      Hi {recipientName}, {reviewerName} requested changes on a deliverable in{' '}
      <strong>{projectName}</strong>.
    </Text>
    <div style={styles.panel}>
      <Text style={styles.panelLabel}>Deliverable</Text>
      <Text style={styles.panelValue}>{deliverableTitle}</Text>
      {feedback ? (
        <Text style={{ ...styles.muted, margin: '10px 0 0' }}>"{feedback}"</Text>
      ) : null}
    </div>
    <Link href={url} style={styles.button}>
      Review feedback
    </Link>
  </OrdoEmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    `Changes requested: ${data?.deliverableTitle ?? 'your deliverable'}`,
  displayName: 'Deliverable changes requested',
  previewData: {
    recipientName: 'Marcus',
    deliverableTitle: 'Brand guidelines v2',
    projectName: 'Acme Rebrand',
    reviewerName: 'Jane Cooper',
    feedback: 'Please adjust the logo spacing on page 3.',
    url: 'https://useordo.app/projects',
  },
} satisfies TemplateEntry
