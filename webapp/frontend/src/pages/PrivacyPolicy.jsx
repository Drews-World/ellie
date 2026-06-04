// Public privacy policy for the ELLIE Pinterest app (required for Pinterest
// developer-app review). Intentionally rendered OUTSIDE the Clerk auth gate so
// Pinterest's reviewer can reach it without signing in.
//
// EDIT THESE before deploying:
const OPERATOR = 'ellie by drew'
const CONTACT_EMAIL = 'your-email@example.com'   // ← put a real address you check
const EFFECTIVE_DATE = 'June 3, 2026'

const page = {
  minHeight: '100vh',
  background: '#060f1a',
  color: '#cceeff',
  fontFamily: "'Rajdhani', sans-serif",
  padding: '48px 20px',
}
const wrap = { maxWidth: 760, margin: '0 auto', lineHeight: 1.6 }
const h1 = {
  fontFamily: "'Orbitron', sans-serif",
  letterSpacing: '3px',
  fontSize: 22,
  color: '#00d4ff',
  marginBottom: 4,
}
const h2 = {
  fontFamily: "'Orbitron', sans-serif",
  letterSpacing: '1.5px',
  fontSize: 14,
  color: '#00d4ff',
  marginTop: 32,
  marginBottom: 8,
}
const meta = { opacity: 0.7, fontSize: 14, marginBottom: 24 }
const li = { marginBottom: 6 }

export default function PrivacyPolicy() {
  return (
    <div style={page}>
      <div style={wrap}>
        <h1 style={h1}>Privacy Policy — ELLIE</h1>
        <div style={meta}>Effective date: {EFFECTIVE_DATE}</div>

        <p>
          ELLIE ("the App") is a personal automation tool operated by {OPERATOR} ("we," "us").
          The App publishes content to the operator's own Pinterest account to promote the
          operator's Etsy shop. This policy explains what the App accesses and how that
          information is handled.
        </p>

        <h2>Who this App is for</h2>
        <p>
          ELLIE is a single-operator, personal-use application. It is <strong>not</strong> offered
          to third-party users, and it does not access, collect, or process data belonging to
          anyone other than its operator.
        </p>

        <h2>Information the App accesses</h2>
        <p>
          When the operator connects their Pinterest account via Pinterest's official OAuth flow,
          the App receives an access token that lets it act on the operator's behalf. Using this
          token, the App may:
        </p>
        <ul>
          <li style={li}>Read the operator's Pinterest boards (to choose where to publish).</li>
          <li style={li}>
            Create Pins on the operator's boards that link to the operator's own Etsy product
            listings.
          </li>
        </ul>
        <p>
          The App accesses only the operator's own Pinterest account. It does <strong>not</strong>{' '}
          access other Pinterest users' accounts, profiles, boards, Pins, or any personal data.
        </p>

        <h2>Information the App does NOT collect</h2>
        <ul>
          <li style={li}>
            We do not collect, store, or process personal information about Pinterest users,
            visitors, or customers.
          </li>
          <li style={li}>
            We do not use tracking cookies, advertising identifiers, or analytics on Pinterest
            users.
          </li>
          <li style={li}>We do not buy, sell, rent, or trade any data.</li>
        </ul>

        <h2>How information is stored and secured</h2>
        <p>
          The Pinterest access token is stored privately in the operator's own server environment
          configuration and is used solely to authenticate requests to the Pinterest API. It is not
          shared with any third party. Records the App keeps (such as which of the operator's
          listings have been published) contain only the operator's own business data, not
          third-party personal data.
        </p>

        <h2>Sharing of information</h2>
        <p>
          We do not share any information obtained through the Pinterest API with third parties. The
          only external service the token is used with is Pinterest's own API, for the purpose
          described above.
        </p>

        <h2>Data retention and deletion</h2>
        <p>
          The access token is retained only while the App is in use and is removed when the operator
          disconnects the integration. The operator may revoke the App's access at any time from
          their Pinterest account settings (Settings → Security → Apps), which immediately
          invalidates the token.
        </p>

        <h2>Compliance with Pinterest policies</h2>
        <p>
          The App uses the Pinterest API in accordance with Pinterest's Developer Guidelines, Terms
          of Service, and Advertising Guidelines, and only for publishing the operator's own
          content.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be reflected by
          updating the effective date above.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy can be directed to:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#00d4ff' }}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  )
}
