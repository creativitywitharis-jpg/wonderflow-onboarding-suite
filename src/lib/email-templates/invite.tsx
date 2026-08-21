import * as React from 'react'

import { Button, Link, Text } from '@react-email/components'

import { EmailLayout, styles } from './theme'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <EmailLayout
    preview={`You've been invited to join ${siteName}`}
    heading="You've been invited"
  >
    <Text style={styles.text}>
      You've been invited to join{' '}
      <Link href={siteUrl} style={styles.link}>
        <strong>{siteName}</strong>
      </Link>{' '}
      — one calm command center for CRM, orders, inventory, finances and
      automation.
    </Text>
    <Button style={styles.button} href={confirmationUrl}>
      Accept invitation
    </Button>
    <Text style={styles.note}>
      If you weren't expecting this invitation, you can safely ignore this
      email.
    </Text>
  </EmailLayout>
)

export default InviteEmail
