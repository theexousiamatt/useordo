/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { OrdoEmailLayout, styles, Link, Text } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'
import { APP_URL } from '../app-url.ts'

interface Props {
  inviterName?: string
  workspaceName?: string
  projectName?: string
  role?: string
  acceptUrl?: string
}

const Email = ({
  inviterName = 'Someone',
  workspaceName = 'a workspace',
  projectName,
  role = 'member',
  acceptUrl = APP_URL,
}: Props) => (
  <OrdoEmailLayout
    siteName="Ordo"
    categoryLabel={projectName ? "Project invitation" : "Workspace invitation"}
    preview={`${workspaceName} invited you to ${projectName ?? "their client workspace"}`}
  >
    <Text style={styles.heading}>You're invited to {projectName ?? workspaceName}</Text>
    <Text style={styles.text}>
      {inviterName} at <strong>{workspaceName}</strong> invited you to {projectName ? <>collaborate on <strong>{projectName}</strong></> : <>join their workspace as a <strong>{role}</strong></>}.
    </Text>
    <div style={styles.panel}>
      <Text style={styles.panelLabel}>{projectName ? "Project" : "Workspace"}</Text>
      <Text style={styles.panelValue}>{projectName ?? workspaceName}</Text>
      <Text style={styles.muted}>{projectName ? "Only this project is shared with you." : role === "client" ? "Only projects individually shared with you will be visible." : "Join your team’s existing workspace."} No workspace setup is needed.</Text>
    </div>
    <Link href={acceptUrl} style={styles.button}>
      {projectName ? "View project" : "View invitation"}
    </Link>
    <Text style={{ ...styles.muted, marginTop: '20px' }}>
      If you weren't expecting this invitation, you can safely ignore this email.
    </Text>
  </OrdoEmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    `${data?.workspaceName ?? 'Your agency'} invited you to ${data?.projectName ?? 'their workspace'} on Ordo`,
  displayName: 'Workspace invitation',
  previewData: {
    inviterName: 'Jane Cooper',
    workspaceName: 'Acme Corp',
    role: 'manager',
    acceptUrl: 'https://useordo.app/auth/invite?token=demo',
  },
} satisfies TemplateEntry
