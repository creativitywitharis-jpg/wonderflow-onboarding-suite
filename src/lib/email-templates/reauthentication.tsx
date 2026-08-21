import * as React from 'react'

import { Text } from '@react-email/components'

import { EmailLayout, styles } from './theme'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <EmailLayout
    preview="Your verification code"
    heading="Confirm it's you"
  >
    <Text style={styles.text}>
      Use this code to confirm your identity:
    </Text>
    <Text style={styles.code}>{token}</Text>
    <Text style={styles.note}>
      This code expires shortly. If you didn't request it, you can safely
      ignore this email.
    </Text>
  </EmailLayout>
)

export default ReauthenticationEmail
