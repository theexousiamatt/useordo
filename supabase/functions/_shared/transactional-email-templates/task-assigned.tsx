/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { OrdoEmailLayout, styles, Link, Text } from './_layout.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  assigneeName?: string
  taskTitle?: string
  projectName?: string
  dueDate?: string
  taskUrl?: string
}

const Email = ({
  assigneeName = 'there',
  taskTitle = 'a task',
  projectName = 'your project',
  dueDate,
  taskUrl = 'https://useordo.app',
}: Props) => (
  <OrdoEmailLayout
    siteName="Ordo"
    categoryLabel="Task assigned"
    preview={`You've been assigned: ${taskTitle}`}
  >
    <Text style={styles.heading}>A task is yours to own</Text>
    <Text style={styles.text}>
      Hi {assigneeName}, you've been assigned a task in <strong>{projectName}</strong>.
    </Text>
    <div style={styles.panel}>
      <Text style={styles.panelLabel}>Task</Text>
      <Text style={styles.panelValue}>{taskTitle}</Text>
      {dueDate ? (
        <Text style={{ ...styles.muted, margin: '8px 0 0' }}>Due {dueDate}</Text>
      ) : null}
    </div>
    <Link href={taskUrl} style={styles.button}>
      View task
    </Link>
  </OrdoEmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Props) => `New task assigned: ${data?.taskTitle ?? 'a task'}`,
  displayName: 'Task assigned',
  previewData: {
    assigneeName: 'Marcus',
    taskTitle: 'Finalize homepage hero copy',
    projectName: 'Website Redesign',
    dueDate: 'Jun 20, 2026',
    taskUrl: 'https://useordo.app/projects',
  },
} satisfies TemplateEntry
