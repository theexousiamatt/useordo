/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

/**
 * Shared type contract for every Ordo transactional email template.
 * Each template file exports `template` satisfying TemplateEntry.
 */
export interface TemplateEntry {
  component: (props: any) => React.ReactElement
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

import { template as workspaceInvitation } from './workspace-invitation.tsx'
import { template as taskAssigned } from './task-assigned.tsx'
import { template as deliverableApproved } from './deliverable-approved.tsx'
import { template as deliverableRejected } from './deliverable-rejected.tsx'
import { template as notification } from './notification.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'workspace-invitation': workspaceInvitation,
  'task-assigned': taskAssigned,
  'deliverable-approved': deliverableApproved,
  'deliverable-rejected': deliverableRejected,
  'notification': notification,
}
