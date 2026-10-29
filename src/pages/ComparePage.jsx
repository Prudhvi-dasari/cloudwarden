import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageFrame from '../components/PageFrame';
import SeoHead from '../components/SeoHead';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';

const FETCHED = '23 October 2026';

function Out({ href, children }) {
  return (
    <a href={href} rel="noopener noreferrer">
      {children}
    </a>
  );
}

function In({ to, children }) {
  return <Link to={to}>{children}</Link>;
}

const SUMMARY = [
  { name: 'SendToAnyone Free', size: '6 GB', days: '7 days', account: 'Not required', us: true },
  { name: 'SendToAnyone Pro', size: '250 GB', days: '180 days', account: 'Required to pay', us: true },
  { name: 'SwissTransfer', size: '50 GB', days: '30 days', account: 'No account', disagree: ['days', 'account'] },
  { name: 'TransferNow free', size: '5 GB', days: '7 days', account: 'No sign-up' },
  { name: 'WeTransfer free', size: '3 GB', days: '3 days', account: 'Free account', disagree: ['size'] },
  { name: 'Smash free', size: '2 GB or no cap', days: '7 days', account: 'No account', disagree: ['size'] },
];

const TOPICS = [
  { id: 'size', label: 'Size' },
  { id: 'account', label: 'Account' },
  { id: 'password', label: 'Password' },
  { id: 'expiry', label: 'Link length' },
  { id: 'request', label: 'Requests' },
  { id: 'site', label: 'On this site' },
];

function Source({ name, us = false, disagree = false, children }) {
  return (
    <div className={`pa-source${us ? ' is-us' : ''}`}>
      <div className="pa-source-head">
        <span className="pa-source-name">{name}</span>
        {disagree && <span className="ds-badge pa-badge-warn">Sources disagree</span>}
      </div>
      {children}
    </div>
  );
}

function Topic({ id, kicker, title, children }) {
  return (
    <section id={id} className="pa-ledger-row" aria-labelledby={`${id}-title`}>
      <header>
        <p className="ds-kicker"><b>●</b> {kicker}</p>
        <h2 id={`${id}-title`}>{title}</h2>
      </header>
      <div className="pa-sources">{children}</div>
    </section>
  );
}

export default function ComparePage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <SeoHead
        customTitle="SendToAnyone limits, checked 23 October 2026 | SendToAnyone"
        customDescription="SendToAnyone is 6 GB per transfer and 7 days at most, with no account to send. SwissTransfer’s fetched size is 50 GB. WeTransfer’s free size and password pages disagree."
        customCanonical="https://sendtoanyone.com/compare"
      />
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow={`Fetched ${FETCHED}`}
        title="Free is 6 GB and 7 days."
        accent={2}
        subtitle="Pro is 250 GB and 180 days. Other numbers below come from pages opened on 23 October 2026. Where two of those pages disagree, both stay visible."
        actions={(
          <>
            <Link to="/" className="ds-btn ds-btn-dark">Send a file<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
            <Link to="/pricing" className="ds-btn ds-btn-ghost">See pricing</Link>
          </>
        )}
        nextLabel="Send a file"
        nextTo="/"
      >
        <section aria-labelledby="summary-title">
          <div className="pa-head-row" data-reveal>
            <div className="ds-section-head">
              <p className="ds-kicker"><b>●</b> At a glance</p>
              <h2 id="summary-title" className="ds-h2">The short version.</h2>
              <p className="ds-lead">Each figure is the one the tool’s own page showed that day. Details and links are below.</p>
            </div>
          </div>

          <div className="ds-table-wrap mt-8" data-reveal style={{ '--d': '80ms' }}>
            <table className="ds-table min-w-[38rem]">
              <caption className="sr-only">Transfer limits, fetched {FETCHED}</caption>
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Size per transfer</th>
                  <th scope="col">Longest link</th>
                  <th scope="col">Account to send</th>
                </tr>
              </thead>
              <tbody>
                {SUMMARY.map((row) => (
                  <tr key={row.name} className={row.us ? 'is-us' : undefined}>
                    <th scope="row">{row.name}</th>
                    {['size', 'days', 'account'].map((key) => (
                      <td key={key}>
                        <span className="pa-table-num">{row[key]}</span>
                        {row.disagree?.includes(key) && (
                          <span className="ds-badge pa-badge-warn ml-2">Disputed</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="pa-jump mt-6" aria-label="Topics on this page" data-reveal>
            {TOPICS.map((topic) => (
              <a key={topic.id} href={`#${topic.id}`} className="ds-chip">{topic.label}</a>
            ))}
          </nav>
        </section>

        <div className="pa-ledger !mt-12 sm:!mt-16">
          <Topic id="size" kicker="01" title="Size">
            <Source name="SendToAnyone" us>
              <p>Free: 6 GB per cloud transfer, which is 6,000,000,000 bytes. Pro: 250 GB per transfer, once the server confirms payment.</p>
            </Source>
            <Source name="SwissTransfer">
              <p>50 GB per transfer on <Out href="https://swisstransfer.com/">swisstransfer.com</Out> and on the <Out href="https://www.infomaniak.com/en/support/faq/2929/understanding-swisstransfer-data-limits">Infomaniak limits FAQ</Out>. SendToAnyone Free is smaller. Pro is larger.</p>
            </Source>
            <Source name="TransferNow">
              <p>5 GB per transfer on the free row of <Out href="https://www.transfernow.net/en/prices">the pricing page</Out>, the <Out href="https://www.transfernow.net/en/discover/transfernow-free-forever">free plan page</Out>, and the <Out href="https://support.transfernow.net/en/article/what-is-the-maximum-size-of-a-transfer-1vjb64a/">size article</Out>.</p>
            </Source>
            <Source name="WeTransfer" disagree>
              <p>The <Out href="https://wetransfer.com/help-center/subscriptions/plan-limits">help center</Out> says free is up to 10 transfers, or 3 GB total, in a rolling 30 days. The <Out href="https://wetransfer.com/resources/free-file-transfer/wetransfer-file-size-limit">file-size article</Out> says free accounts can send up to 3 GB per transfer. The help center says Ultimate allows up to 1 TB per transfer. The file-size article says Ultimate removes the per-transfer cap. Neither reading is picked here. Those figures are WeTransfer’s, not a SendToAnyone allowance.</p>
            </Source>
            <Source name="Smash" disagree>
              <p>Do not read the free plan as one number. The <Out href="https://fromsmash.com/discover-smash/everyone">free page</Out> and the <Out href="https://fromsmash.com/help/articles/13885610-what-is-the-file-size-limit-on-smash">size article</Out> say there is no file size limit, and that transfers past 2 GB wait in a queue. The <Out href="https://fromsmash.com/pricing">pricing page</Out> card says 2 GB per transfer, with the same queue note. Paid bullets on that pricing page say there is no size cap. The size article, written 27 February 2026, says 250 GB per transfer on Pro and 1 TB per transfer on Team. That 1 TB figure is Smash’s, not a SendToAnyone allowance.</p>
            </Source>
          </Topic>

          <Topic id="account" kicker="02" title="Account">
            <Source name="SendToAnyone" us>
              <p>No account to send on Free, and no account to download. Pro needs an account, so the plan is attached to it.</p>
            </Source>
            <Source name="WeTransfer">
              <p>The <Out href="https://wetransfer.com/resources/free-file-transfer/wetransfer-free-plan">free-plan article</Out> says sending requires a free account, and receiving does not.</p>
            </Source>
            <Source name="TransferNow">
              <p>The free pages say no sign-up.</p>
            </Source>
            <Source name="SwissTransfer" disagree>
              <p>Its own site says no account to send or receive. The <Out href="https://www.infomaniak.com/en/swisstransfer">Infomaniak product page</Out> says the first send from a new device asks for an email verification.</p>
            </Source>
            <Source name="Smash">
              <p>The free page says no account is required to send.</p>
            </Source>
          </Topic>

          <Topic id="password" kicker="03" title="Password">
            <Source name="SendToAnyone" us>
              <p>An optional download gate on the send form. It does not encrypt the file. <In to="/security">The security page explains the check.</In></p>
            </Source>
            <Source name="WeTransfer" disagree>
              <p>The <Out href="https://wetransfer.com/resources/password-protected-file-transfer/how-to-password-protect-file-sharing">password article</Out> says a password is included on every plan, including free, and is not put in the notification email. The help center lists password protection with Ultimate and does not say free includes it.</p>
            </Source>
            <Source name="TransferNow" disagree>
              <p>The free plan page includes a password with no account. The pricing FAQ says that password encrypts the files. The <Out href="https://www.transfernow.net/en/explore/security">security page</Out> reserves the claim that they cannot access the files for paid SSE-C. This page does not treat that password as end-to-end encryption.</p>
            </Source>
            <Source name="SwissTransfer">
              <p>Optional password, sent on a separate channel. The swisstransfer.com homepage says storage encryption is not end-to-end encryption.</p>
            </Source>
            <Source name="Smash">
              <p>The free page says a password can be added. The pricing fetch did not show which plan column includes it.</p>
            </Source>
          </Topic>

          <Topic id="expiry" kicker="04" title="How long the link lasts">
            <Source name="SendToAnyone" us>
              <p>Free: you pick 1 hour, 24 hours, 3 days, or 7 days. Pro adds links up to 180 days. Free’s 7 days is shorter than the 30-day figure on swisstransfer.com. Pro’s 180 days is longer than the 30 days on Smash’s paid bullets, and shorter than the up to 365 days described for TransferNow Premium.</p>
            </Source>
            <Source name="WeTransfer">
              <p>The free-plan article says transfer links expire after a maximum of 3 days.</p>
            </Source>
            <Source name="TransferNow">
              <p>Free: 7 days, on the pricing page and the free plan page.</p>
            </Source>
            <Source name="SwissTransfer" disagree>
              <p>swisstransfer.com says a maximum of 30 days. The Infomaniak FAQ lists 1, 3, 7, 15, or 30 days, plus 60 days on Enterprise, and says a 30-day choice deletes the files after 15 days unless the sender confirms an email on day 12. The Infomaniak product card says available for up to 60 days.</p>
            </Source>
            <Source name="Smash">
              <p>Free: 7 days. The pricing bullets say paid transfers last 30 days.</p>
            </Source>
          </Topic>

          <Topic id="request" kicker="05" title="Asking someone to upload">
            <Source name="SendToAnyone" us>
              <p>A request link at <In to="/receive">/receive</In>. You add a title and instructions. The other person uploads up to 6 GB without an account. The link lasts 7 days. Creating it requires you to be signed in.</p>
            </Source>
            <Source name="TransferNow">
              <p>The free column includes an email request and a deposit link. The pricing page reserves the website widget for paid plans.</p>
            </Source>
            <Source name="Smash">
              <p>The free page says a personalized drop-off link is paid (Pro, Team, and Enterprise).</p>
            </Source>
          </Topic>

          <Topic id="site" kicker="06" title="On this site, and not on this site">
            <Source name="Device transfer" us>
              <p>Same-network transfer is at <In to="/qr-transfer">/qr-transfer</In>. Both people stay on the page. The file is not stored as a later link. Keep it within 6 GB. That path does not raise the cloud cap.</p>
            </Source>
            <Source name="Checksum tool" us>
              <p>A checksum tool at <In to="/checksum">/checksum</In> hashes a file in the browser. It does not run by itself on every transfer.</p>
            </Source>
            <Source name="Not available">
              <p>There is no public API and no shared team workspace. Creator, Pro, and Studio are on the pricing page. Studio is marked team-ready, and a shared workspace is not included yet.</p>
            </Source>
          </Topic>
        </div>
      </PageFrame>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialMode={authMode} onAuthSuccess={(u) => setUser(u)} />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={async () => { await clearUserSession(); setUser(null); }}
      />
    </>
  );
}
