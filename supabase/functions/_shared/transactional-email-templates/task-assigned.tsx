/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { OrdoEmailLayout, styles, Link, Text } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'
import { APP_URL } from '../app-url.ts'

interface Props {
  assigneeName?: string
  workspaceName?: string
  projectName?: string
  taskTitle?: string
  taskDescription?: string
  dueDate?: string
  labels?: string[]
  assignerName?: string
  assignedAt?: string
  taskUrl?: string
}

const Email = ({
  assigneeName = 'there',
  workspaceName = 'Ordo',
  projectName = 'your project',
  taskTitle = 'a task',
  taskDescription,
  dueDate,
  labels = [],
  assignerName = 'A teammate',
  assignedAt,
  taskUrl = 'https://useordo.app',
}: Props) => (
  <OrdoEmailLayout
    siteName="Ordo"
    categoryLabel="Task assigned"
    preview={`You've been assigned: ${taskTitle}`}
  >
    <Text style={styles.heading}>A task is yours to own</Text>
    <Text style={styles.text}>
      Hi {assigneeName}, <strong>{assignerName}</strong> assigned you a task in{' '}
      <strong>{projectName}</strong> ({workspaceName}).
    </Text>
    <div style={styles.panel}>
      <Text style={styles.panelLabel}>Task</Text>
      <Text style={styles.panelValue}>{taskTitle}</Text>
      {taskDescription ? (
        <Text style={{ ...styles.text, margin: '10px 0 0' }}>{taskDescription}</Text>
      ) : null}
      {labels.length > 0 ? (
        <Text style={{ ...styles.muted, margin: '10px 0 0' }}>
          Labels: {labels.join(', ')}
        </Text>
      ) : null}
      {dueDate ? (
        <Text style={{ ...styles.muted, margin: '8px 0 0' }}>Due {dueDate}</Text>
      ) : null}
      {assignedAt ? (
        <Text style={{ ...styles.muted, margin: '8px 0 0' }}>Assigned {assignedAt}</Text>
      ) : null}
    </div>
    <Link href={taskUrl} style={styles.button}>
      Open Task
    </Link>
  </OrdoEmailLayout>
)

export const template = {
  component: Email,
  subject: () => `You've been assigned a task in Ordo`,
  displayName: 'Task assigned',
  previewData: {
    assigneeName: 'Marcus',
    workspaceName: 'Studio Affairs',
    projectName: 'Website Redesign',
    taskTitle: 'Finalize homepage hero copy',
    taskDescription:
      'Tighten the hero headline and subcopy so it reflects the new positioning. Keep it under two lines on desktop.',
    dueDate: 'Jun 20, 2026',
    labels: ['Copy', 'High priority'],
    assignerName: 'Matt',
    assignedAt: 'Jun 12, 2026, 2:14 PM',
    taskUrl: 'https://useordo.app/projects',
  },
} satisfies TemplateEntry
