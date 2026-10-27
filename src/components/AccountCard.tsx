import { FirebaseError } from 'firebase/app'
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { useState, type FormEvent } from 'react'
import { auth } from '../lib/firebase'
import { refreshUser, useData, useSync, type SyncStatus } from '../lib/store'

const STATUS: Record<SyncStatus, string> = {
  local: 'This device only',
  synced: '✓ Synced',
  pending: '↻ Syncing…',
  offline: '⚡ Offline: changes will sync when you reconnect',
}

function friendly(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.'
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
      return 'There is already an account with that email. Sign in instead.'
    case 'auth/weak-password':
      return 'Password needs at least 6 characters.'
    case 'auth/invalid-email':
      return 'That email address looks off.'
    case 'auth/network-request-failed':
      return 'No connection. Try again when you are online.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.'
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Email sign-in is not enabled for this app yet.'
    default:
      return (err as Error)?.message ?? 'Something went wrong.'
  }
}

export function AccountCard({ toast }: { toast: (msg: string) => void }) {
  const { user, status } = useSync()
  const { entries } = useData()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      if (done) toast(done)
      setPassword('')
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  if (user === undefined) {
    return (
      <section className="card">
        <h3 className="section-title">Account & sync</h3>
        <p className="muted small">Checking…</p>
      </section>
    )
  }

  if (user && !user.anonymous) {
    return (
      <section className="card">
        <h3 className="section-title">Account & sync</h3>
        <div className="account-row">
          <div className="account-avatar" aria-hidden="true">
            {(user.email ?? '?')[0].toUpperCase()}
          </div>
          <div className="grow">
            <div className="account-email">{user.email}</div>
            <div className={`sync-status ${status}`}>{STATUS[status]}</div>
          </div>
        </div>
        <p className="muted small">Sign in with the same account on your phone and on the web; drinks show up everywhere.</p>
        <button className="btn ghost full" disabled={busy} onClick={() => run(() => signOut(auth), 'Signed out')}>
          Sign out
        </button>
      </section>
    )
  }

  async function createAccount() {
    const current = auth.currentUser
    if (current?.isAnonymous) {
      // Attach email + password to the anonymous account: same uid, nothing to copy.
      await linkWithCredential(current, EmailAuthProvider.credential(email.trim(), password))
      refreshUser()
    } else {
      await createUserWithEmailAndPassword(auth, email.trim(), password)
    }
  }

  const submit = (e: FormEvent, create: boolean) => {
    e.preventDefault()
    run(
      () => (create ? createAccount() : signInWithEmailAndPassword(auth, email.trim(), password)),
      create ? 'Account created. Syncing ☁️' : 'Signed in. Syncing ☁️',
    )
  }

  return (
    <section className="card">
      <h3 className="section-title">Account & sync</h3>
      {user?.anonymous ? (
        <>
          <div className={`sync-status ${status}`}>{status === 'synced' ? '✓ Backed up anonymously' : STATUS[status]}</div>
          <p className="muted small">
            Your drinks are backed up, but only this install can reach them. Create an account to use PintTracker on your other devices and keep
            everything if you reinstall. Already have one? Sign in and{entries.length > 0 ? ` these ${entries.length}` : ''} drinks merge into it.
          </p>
        </>
      ) : (
        <p className="muted small">
          Sign in to back up and sync drinks across your phone and the web.
          {entries.length > 0 && ` The ${entries.length} drinks on this device will move into your account.`}
        </p>
      )}
      <form className="form" onSubmit={(e) => submit(e, false)}>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="submit" className="btn primary grow" disabled={busy}>
            Sign in
          </button>
          <button type="button" className="btn ghost grow" disabled={busy || !email || password.length < 6} onClick={(e) => submit(e, true)}>
            Create account
          </button>
        </div>
        <button
          type="button"
          className="link-btn"
          disabled={busy}
          onClick={() => (email ? run(() => sendPasswordResetEmail(auth, email.trim()), 'Password reset email sent') : setError('Enter your email first.'))}
        >
          Forgot password?
        </button>
      </form>
    </section>
  )
}
