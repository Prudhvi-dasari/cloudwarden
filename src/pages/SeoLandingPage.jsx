import { Children, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import SeoHead, { CANONICAL_ORIGIN } from '../components/SeoHead';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { ArrowRight, Check } from 'lucide-react';

const LANDING_DATA = {
  'send-large-files': {
    title: 'Send large files online, up to 6 GB | SendToAnyone',
    metaDesc: 'Send up to 6 GB with no account. The link lasts from 1 hour to 7 days. Split anything larger. There is no bigger plan.',
    h1: 'Send a large file',
    subtitle: 'One cloud transfer holds 6 GB. No account. You pick how long the link stays open, from 1 hour up to 7 days, and then it stops.',
  },
  'send-files-by-email': {
    title: 'Email a download link | SendToAnyone',
    metaDesc: 'Email mode sends the download link. The file is not attached. Cloud transfers are up to 6 GB.',
    h1: 'Email a download link',
    subtitle: 'The message contains the link. The file stays on the transfer until the link expires.',
    feature1: 'Add the recipient on the Email tab',
    feature2: 'The file is not attached',
    feature3: 'Expiry from 1 hour to 7 days',
  },
  'create-file-sharing-link': {
    title: 'Create a download link | SendToAnyone',
    metaDesc: 'Upload on the home page and copy a /d/ link. No account. The link expires on the timer you set, up to 7 days.',
    h1: 'Create a download link',
    subtitle: 'Upload, copy the link, and send it yourself. No account required.',
    feature1: 'The link looks like /d/ and your title',
    feature2: 'Expiry from 1 hour to 7 days',
    feature3: 'Anyone with the link can open the download page',
  },
  'file-request': {
    title: 'Request files | SendToAnyone',
    metaDesc: 'The request form is at /receive. Title, instructions, 6 GB, and 7 days.',
    h1: 'Request files',
    subtitle: 'The form that creates the link is on the request page.',
    feature1: 'Open /receive to create the link',
    feature2: 'The person uploading does not need an account',
    feature3: 'Up to 6 GB, open for 7 days',
  },
  'iphone-to-windows': {
    title: 'Send a file from iPhone to Windows | SendToAnyone',
    metaDesc: 'Pair two browsers with a code. Both screens stay open. The file is not kept as a cloud link.',
    h1: 'iPhone to a Windows browser',
    subtitle: 'Use device transfer with both browsers open. This is not AirDrop.',
    feature1: 'Pair with the code on the device screen',
    feature2: 'Both screens stay open until it finishes',
    feature3: 'A cloud link is a separate path, capped at 6 GB',
  },
  'android-to-mac': {
    title: 'Send a file from Android to Mac | SendToAnyone',
    metaDesc: 'Pair two browsers with a code. Both screens stay open. The file is not kept as a cloud link.',
    h1: 'Android to a Mac browser',
    subtitle: 'Use device transfer with both browsers open.',
    feature1: 'Pair with the code on the device screen',
    feature2: 'Both screens stay open until it finishes',
    feature3: 'A cloud link is a separate path, capped at 6 GB',
  },
  'phone-to-laptop': {
    title: 'Send a file from phone to laptop | SendToAnyone',
    metaDesc: 'Pair the phone and laptop in the browser. Both stay open. A stored link is the cloud path, up to 6 GB.',
    h1: 'Phone to laptop',
    subtitle: 'Device transfer pairs two browsers. No account required for that screen.',
    feature1: 'Both devices stay on the page',
    feature2: 'The file is not kept as a download link',
    feature3: 'Cloud links stop at 6 GB',
  },
  'airdrop-alternative': {
    title: 'Send between two devices in the browser | SendToAnyone',
    metaDesc: 'A pairing code for two browsers. Both stay open. This product is not AirDrop.',
    h1: 'Two devices, in the browser',
    subtitle: 'Pair with a code. This is not AirDrop, iCloud, or a system share sheet.',
    feature1: 'Both screens stay open',
    feature2: 'The file is not stored as a link',
    feature3: 'No account required for that screen',
  },
  'wetransfer-alternative': {
    title: 'Send a large file, up to 6 GB | SendToAnyone',
    metaDesc: 'Up to 6 GB, no account, links up to 7 days. The comparison page lists fetched limits from 23 October 2026.',
    h1: 'Send a large file',
    subtitle: 'Up to 6 GB, no account, links up to 7 days. Limits next to other tools are on the comparison page.',
    feature1: '6 GB per cloud transfer',
    feature2: 'No account to send or download',
    feature3: 'See the dated comparison',
  },
  'transfernow-alternative': {
    title: 'Send a file from the browser | SendToAnyone',
    metaDesc: 'Link, email, or device transfer. Cloud transfers are up to 6 GB and 7 days.',
    h1: 'Send a file from the browser',
    subtitle: 'Link, email, or device transfer. Cloud transfers are up to 6 GB.',
    feature1: '6 GB and up to 7 days on a cloud link',
    feature2: 'Email carries the link',
    feature3: 'See the dated comparison',
  },
  'p2p-file-transfer': {
    title: 'Device-to-device file transfer | SendToAnyone',
    metaDesc: 'Two browsers pair with a code and use WebRTC. Some networks fail to connect. The file is not stored as a link.',
    h1: 'Device-to-device transfer',
    subtitle: 'Two browsers, a pairing code, and WebRTC. Some networks never connect.',
    feature1: 'Both people stay on the page',
    feature2: 'The file is not stored as a link',
    feature3: 'Keep it within the 6 GB cloud limit',
  },
  'send-large-video': {
    title: 'Send a large video, up to 6 GB | SendToAnyone',
    metaDesc: 'A video uses the same 6 GB cloud limit and the same expiry as any other file. The bytes are uploaded as selected.',
    h1: 'Send a video file',
    subtitle: 'Same 6 GB ceiling and same expiry as any other cloud transfer. The file is uploaded as you selected it.',
    feature1: 'No separate video limit',
    feature2: 'Up to 6 GB, then split the file',
    feature3: 'The large-file page has the full limit',
  },
  'send-files-without-signup': {
    title: 'Send files without an account | SendToAnyone',
    metaDesc: 'Sender and recipient need no account. The link is open to anyone who has it, unless a password is set. Email only carries the link.',
    h1: 'Send files without an account',
    subtitle: 'You can upload without signing up. The person who downloads does not sign up either.',
  },
  'send-files-without-compression': {
    title: 'Files are uploaded as selected | SendToAnyone',
    metaDesc: 'The cloud uploader does not transcode the file. The limit is still 6 GB per transfer.',
    h1: 'Uploaded as you selected it',
    subtitle: 'The uploader does not transcode video or images. The size limit is still 6 GB.',
    feature1: 'The bytes you chose are the bytes uploaded',
    feature2: 'A video uses the same 6 GB cap',
    feature3: 'See the large-file page for the limit',
  },
  'how-to-send-large-files': {
    title: 'How to send a large file | SendToAnyone',
    metaDesc: 'Upload on the home page, pick an expiry up to 7 days, and share the link. Split files over 6 GB. Compare hashes after download.',
    h1: 'How to send a large file',
    subtitle: 'A procedure for the home uploader. The limit is 6 GB. The link lasts from 1 hour to 7 days.',
  },
  'file-transfer-free': {
    title: 'Send a file, up to 6 GB | SendToAnyone',
    metaDesc: '6 GB, no account, links up to 7 days. There is no paid plan that raises the cap.',
    h1: 'The free transfer is the only plan',
    subtitle: 'Up to 6 GB. No account. Links last up to 7 days. A larger plan is not for sale.',
    feature1: 'No account to upload',
    feature2: '6 GB per transfer',
    feature3: '7 days is the longest link',
  },
  'send-files-whatsapp': {
    title: 'Paste a download link into a chat | SendToAnyone',
    metaDesc: 'Upload here, then paste the link into WhatsApp. There is no WhatsApp integration. Cloud transfers are up to 6 GB.',
    h1: 'Paste the link into a chat',
    subtitle: 'There is no WhatsApp integration. You upload here and paste the download link into the chat.',
    feature1: 'The chat receives a link',
    feature2: 'The file is not sent through the chat app',
    feature3: 'Cloud transfers stop at 6 GB',
  },
  'send-folder-online': {
    title: 'Send the files in a folder | SendToAnyone',
    metaDesc: 'Select Folder adds those files. The total still stops at 6 GB.',
    h1: 'Send the files in a folder',
    subtitle: 'Select Folder adds the files inside it. The total still stops at 6 GB.',
    feature1: 'Select Folder on the send page',
    feature2: 'The size cap is the total of those files',
    feature3: 'Split the set if it is over 6 GB',
  },
  'expire-file-link': {
    title: 'Choose when a download link stops | SendToAnyone',
    metaDesc: 'Pick 1 hour, 24 hours, 3 days, or 7 days. After that, the download is refused.',
    h1: 'When a download link stops',
    subtitle: 'The send form offers 1 hour, 24 hours, 3 days, or 7 days.',
    feature1: '7 days is the longest choice',
    feature2: 'After that, the download is refused',
    feature3: 'The how-to page walks through the form',
  },
  'best-wetransfer-alternative-india': {
    title: 'Send a large file from the browser | SendToAnyone',
    metaDesc: 'The same 6 GB limit and 7 day maximum. No separate regional plan.',
    h1: 'Same limits, no regional plan',
    subtitle: '6 GB per cloud transfer, up to 7 days, no account. There is no India-only plan.',
    feature1: 'Same 6 GB cap',
    feature2: 'No account to send',
    feature3: 'See the dated comparison',
  },
};

function sectionId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function Article({ children }) {
  const toc = Children.toArray(children)
    .filter((child) => child?.type === Section)
    .map((child) => child.props.title);
  const [active, setActive] = useState(toc[0] ? sectionId(toc[0]) : '');
  const articleRef = useRef(null);

  useEffect(() => {
    if (!('IntersectionObserver' in window) || !articleRef.current) return undefined;
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-20% 0px -65% 0px' });
    articleRef.current.querySelectorAll('section[id]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ds-chapters">
      <nav className="ds-toc" aria-label="On this page">
        <p>On this page</p>
        <ol>
          {toc.map((title, i) => (
            <li key={title}>
              <a href={`#${sectionId(title)}`} className={active === sectionId(title) ? 'is-active' : ''}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div ref={articleRef} className="ds-prose">
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section id={sectionId(title)} className="pgb-doc-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Faq({ items }) {
  return (
    <div className="pt-6">
      <p className="ds-kicker"><b>●</b> Questions</p>
      <div className="mt-4">
        {items.map((item) => (
          <details key={item.q} className="pgb-details">
            <summary>
              {item.q}
              <span className="ds-faq-plus" aria-hidden="true" />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

function Go({ to, children }) {
  return (
    <Link to={to} className="ds-btn ds-btn-dark text-white no-underline">
      {children}
      <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
    </Link>
  );
}

function LargeFileArticle() {
  return (
    <Article>
      <Section title="The 6 GB ceiling">
        <p>
          6 GB is 6,000,000,000 bytes, counted as the total of every file in that transfer. The send form adds the sizes. Past the cap, it tells you to remove a file, and Create download link stays off. The server also rejects an upload that is still over the limit.
        </p>
        <p>There is no larger plan. Anything over 6 GB has to be split into pieces that each sit under the cap. A link cannot be kept past 7 days.</p>
      </Section>

      <Section title="Video, source files, and folders">
        <p>
          A video, a design source file, and a folder of assets share this ceiling and this expiry. The uploader sends the bytes you selected. It does not transcode video or flatten a design file.
        </p>
        <p>
          Select Folder on the drop area adds the files in that folder. Check the total before you send. A camera magazine or a project with its media often passes 6 GB even when a compressed delivery file does not. Split those into more than one transfer, and put the piece name in the title.
        </p>
      </Section>

      <Section title="A link, when an attachment will not do">
        <p>
          Inboxes commonly reject attachments around 20–25 MB. That range is why people send a link. It is not a measurement of one mail service. On the Email tab, the message contains the download link. On the Link tab, you copy the link and paste it where you already talk, including a chat.
        </p>
      </Section>

      <Section title="Password">
        <p>
          A password is an optional download gate you set on the send form, explained on the <Link to="/security#download-password">security page</Link>.
        </p>
      </Section>

      <Faq
        items={[
          {
            q: 'Will a video be recompressed?',
            a: 'No. The upload stores the file you selected. If that file is over 6 GB, the form will not send it.',
          },
          {
            q: 'What happens at exactly 6 GB?',
            a: 'The cap is the total. One file over 6,000,000,000 bytes is refused, and so is a group of smaller files that add up past it.',
          },
          {
            q: 'Can the link stay up for a month?',
            a: 'No. The longest choice on the form is 7 days. After that, the download is refused.',
          },
        ]}
      />

      <p className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-4">
        <Go to="/">Open the send form</Go>
        <Link to="/how-to-send-large-files" className="inline-flex min-h-11 items-center font-semibold">
          Step-by-step on the home uploader
        </Link>
      </p>
    </Article>
  );
}

function NoSignupArticle() {
  return (
    <Article>
      <Section title="Sender and recipient">
        <p>
          The home page uploads without an account. The download page opens from the link, also without an account. Link mode does not ask for your email.
        </p>
      </Section>

      <Section title="The link is still a link">
        <p>
          No account does not hide the files. Anyone who has the URL can open the download page, unless you set a password on the send form. That password is a download gate. The <Link to="/security#download-password">security page</Link> explains what it checks and what it does not encrypt.
        </p>
        <p>Send the link only to the people who should have the files.</p>
      </Section>

      <Section title="Email only carries the link">
        <p>
          Email is optional. On the Email tab you enter the recipient so the message can be sent. That message contains the download link. The file is not attached. A mail provider accepting the message is not the same thing as the person opening it.
        </p>
      </Section>

      <Section title="Checked on 23 October 2026">
        <p>
          WeTransfer’s free-plan article, fetched that day, says the sender needs a free WeTransfer account and the recipient does not.{' '}
          <a
            href="https://wetransfer.com/resources/free-file-transfer/wetransfer-free-plan"
            rel="noopener noreferrer"
          >
            WeTransfer free-plan article
          </a>
          . On SendToAnyone, the person sending can upload without an account.
        </p>
      </Section>

      <Faq
        items={[
          {
            q: 'Does the recipient create an account?',
            a: 'No. They open the link in a browser.',
          },
          {
            q: 'Is an open link private?',
            a: 'Only if you also set a password. Otherwise anyone with the URL can open the download page.',
          },
          {
            q: 'Do I have to type my own email?',
            a: 'Not on the Link tab. The Email tab needs the recipient’s address so the link can be mailed. Your own address on that form is optional.',
          },
        ]}
      />

      <p className="pt-4"><Go to="/">Send without an account</Go></p>
    </Article>
  );
}

function HowToArticle() {
  return (
    <Article>
      <Section title="Attachment or link">
        <p>
          Inboxes commonly reject attachments around 20–25 MB. SwissTransfer’s homepage uses that range as the reason to send a link. It is not a measured test of Gmail. When the attachment fails, upload here and share a link.
        </p>
        <p>
          On SendToAnyone, the Email tab sends the link. The file is not attached. The Link tab skips the email: you copy the link yourself.
        </p>
      </Section>

      <Section title="On the home uploader">
        <ol>
          <li>Open the home page. Leave the control on Link, or switch to Email.</li>
          <li>Drop files, or use Browse Files, or Select Folder. Select Folder adds the files in that folder. The upload uses the bytes you selected. It does not transcode them.</li>
          <li>If the total is over 6 GB, the form tells you to remove a file. Create download link stays disabled. The cap is 6,000,000,000 bytes for the whole transfer.</li>
          <li>Under Link stays open, pick 1 Hour, 24 Hours, 3 Days, or 7 Days. Seven days is already selected, and it is the longest.</li>
          <li>Optional: turn on Password. Give that password to the recipient on another channel. The email, if you send one, does not include it. The security page explains the gate.</li>
          <li>Optional: open Title and message. The title shapes the /d/ link.</li>
          <li>On Email, enter the recipient. Your own email on that form is optional.</li>
          <li>Press Create download link, or Send the link if Email is selected. Stay on the page until the link is shown, then copy it.</li>
        </ol>
        <p>
          The password check is documented on the <Link to="/security#download-password">security page</Link>.
        </p>
      </Section>

      <Section title="Over 6 GB">
        <p>
          Split the project into pieces under 6 GB. Name each piece in the title. There is no upgrade that raises the cap, and there is no way to keep one link past 7 days.
        </p>
      </Section>

      <Section title="When the file should not be stored">
        <p>
          If both people can stay online, use <Link to="/qr-transfer">device transfer</Link>. The file is not kept as a download link. Both screens stay open until it finishes. Keep the file within 6 GB. That path does not raise the cloud cap. The cloud form is the screen that refuses a transfer over 6 GB.
        </p>
      </Section>

      <Section title="After the download">
        <p>
          Compare hashes at the <Link to="/checksum">checksum tool</Link>. It runs in the browser on the file you have. Share the hash yourself if the other person should compare it. The transfer does not attach a hash for you.
        </p>
      </Section>

      <Faq
        items={[
          {
            q: 'Which button sends the file?',
            a: 'Create download link on the Link tab. Send the link on the Email tab.',
          },
          {
            q: 'What expiry is selected at the start?',
            a: '7 Days. You can switch to 1 Hour, 24 Hours, or 3 Days before you send.',
          },
          {
            q: 'Where does the password go?',
            a: 'You give it to the recipient yourself. It is not written into the notification email.',
          },
        ]}
      />

      <p className="pt-4"><Go to="/">Open the uploader</Go></p>
    </Article>
  );
}

const DEEP = {
  'send-large-files': LargeFileArticle,
  'send-files-without-signup': NoSignupArticle,
  'how-to-send-large-files': HowToArticle,
};

export default function SeoLandingPage({ pageKey }) {
  const data = LANDING_DATA[pageKey] || LANDING_DATA['airdrop-alternative'];
  const Deep = DEEP[pageKey];
  const canonical = pageKey === 'file-request'
    ? `${CANONICAL_ORIGIN}/receive`
    : `${CANONICAL_ORIGIN}/${pageKey}`;
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <SeoHead
        customTitle={data.title}
        customDescription={data.metaDesc}
        customCanonical={canonical}
      />
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow={Deep ? 'Guide' : 'Quick answer'}
        title={data.h1}
        subtitle={data.subtitle}
        center={!Deep}
        actions={pageKey === 'file-request' ? (
          <Link to="/receive" className="ds-btn ds-btn-dark">
            Open the request form
            <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
          </Link>
        ) : null}
      >
        {Deep ? (
          <Deep />
        ) : (
          <>
            <div className="ds-grid cols-3 max-w-5xl mx-auto w-full">
              {[data.feature1, data.feature2, data.feature3].filter(Boolean).map((feature, i) => (
                <div key={feature} className="ds-feature" data-reveal style={{ '--d': `${i * 70}ms` }}>
                  <span className="ds-icon is-blue is-sm"><Check strokeWidth={3} aria-hidden="true" /></span>
                  <h2 className="font-display text-[1.125rem] font-semibold leading-snug tracking-[-0.015em] text-[#060a12]">{feature}</h2>
                </div>
              ))}
            </div>
            <div className="text-center" data-reveal>
              <Go to="/">Open the send page</Go>
            </div>
          </>
        )}
      </PageFrame>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onAuthSuccess={(u) => setUser(u)}
      />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={async () => {
          await clearUserSession();
          setUser(null);
        }}
      />
    </>
  );
}
