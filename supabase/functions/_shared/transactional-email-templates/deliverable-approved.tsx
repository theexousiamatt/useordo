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
  url?: string
}

const Email = ({
  recipientName = 'there',
  deliverableTitle = 'a deliverable',
  projectName = 'your project',
  reviewerName = 'Your client',
  url = 'https://useordo.app',
}: Props) => (
  <OrdoEmailLayout
    siteName="Ordo"
    categoryLabel="Deliverable approved"
    preview={`${deliverableTitle} was approved`}
  >
    <Text style={styles.heading}>Approved ✓</Text>
    <Text style={styles.text}>
      Hi {recipientName}, {reviewerName} approved a deliverable in{' '}
      <strong>{projectName}</strong>.
    </Text>
    <div style={styles.panel}>
      <Text style={styles.panelLabel}>Deliverable</Text>
      <Text style={styles.panelValue}>{deliverableTitle}</Text>
    </div>
    <Link href={url} style={styles.button}>
      View deliverable
    </Link>
  </OrdoEmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    `Approved: ${data?.deliverableTitle ?? 'your deliverable'}`,
  displayName: 'Deliverable approved',
  previewData: {
    recipientName: 'Marcus',
    deliverableTitle: 'Brand guidelines v2',
    projectName: 'Acme Rebrand',
    reviewerName: 'Jane Cooper',
    url: 'https://useordo.app/projects',
  },
} satisfies TemplateEntry
