/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { OrdoEmailLayout, styles, Link, Text } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'
import { APP_URL } from '../app-url.ts'

interface Props {
  inviterName?: string
  workspaceName?: string
  role?: string
  acceptUrl?: string
}

const Email = ({
  inviterName = 'Someone',
  workspaceName = 'a workspace',
  role = 'member',
  acceptUrl = APP_URL,
}: Props) => (
  <OrdoEmailLayout
    siteName="Ordo"
    categoryLabel="Workspace invitation"
    preview={`${inviterName} invited you to join ${workspaceName} on Ordo`}
  >
    <Text style={styles.heading}>You're invited to {workspaceName}</Text>
    <Text style={styles.text}>
      {inviterName} has invited you to collaborate in <strong>{workspaceName}</strong> on
      Ordo as a <strong>{role}</strong>.
    </Text>
    <div style={styles.panel}>
      <Text style={styles.panelLabel}>Workspace</Text>
      <Text style={styles.panelValue}>{workspaceName}</Text>
    </div>
    <Link href={acceptUrl} style={styles.button}>
      Accept invitation
    </Link>
    <Text style={{ ...styles.muted, marginTop: '20px' }}>
      If you weren't expecting this invitation, you can safely ignore this email.
    </Text>
  </OrdoEmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    `You're invited to ${data?.workspaceName ?? 'a workspace'} on Ordo`,
  displayName: 'Workspace invitation',
  previewData: {
    inviterName: 'Jane Cooper',
    workspaceName: 'Acme Corp',
    role: 'manager',
    acceptUrl: 'https://useordo.app/auth/invite?token=demo',
  },
} satisfies TemplateEntry
