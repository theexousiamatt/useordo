/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { OrdoEmailLayout, styles, Link, Text } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'
import { APP_URL } from '../app-url.ts'

interface Props {
  recipientName?: string
  title?: string
  message?: string
  url?: string
  actionLabel?: string
}

const Email = ({
  recipientName = 'there',
  title = 'Something happened in your workspace',
  message = 'There is a new update waiting for you in Ordo.',
  url = 'https://useordo.app',
  actionLabel = 'Open Ordo',
}: Props) => (
  <OrdoEmailLayout siteName="Ordo" categoryLabel="Notification" preview={title}>
    <Text style={styles.heading}>{title}</Text>
    <Text style={styles.text}>Hi {recipientName}, {message}</Text>
    <Link href={url} style={styles.button}>
      {actionLabel}
    </Link>
  </OrdoEmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Props) => data?.title ?? 'A new update in Ordo',
  displayName: 'Generic notification',
  previewData: {
    recipientName: 'Marcus',
    title: 'Your project moved to In Review',
    message: 'The "Website Redesign" project is now awaiting your review.',
    url: 'https://useordo.app/projects',
    actionLabel: 'View project',
  },
} satisfies TemplateEntry
