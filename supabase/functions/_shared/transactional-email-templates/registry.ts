/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as testDelivery } from './test-delivery.tsx'
import { template as chaseReminder } from './chase-reminder.tsx'
import { template as welcome } from './welcome.tsx'
import { template as adminApprovalRequest } from './admin-approval-request.tsx'
import { template as accountRejected } from './account-rejected.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'test-delivery': testDelivery,
  'chase-reminder': chaseReminder,
  'welcome': welcome,
  'admin-approval-request': adminApprovalRequest,
  'account-rejected': accountRejected,
}
