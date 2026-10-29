/**
 * Public route metadata shared by the edge rewriter, the sitemap, and SeoHead.
 * Landing copy has no prices.
 */

export const CANONICAL_ORIGIN = 'https://sendtoanyone.com';
export const OG_IMAGE = `${CANONICAL_ORIGIN}/og.png`;
export const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const NOINDEX_ROBOTS = 'noindex, nofollow, noarchive';

export const REDIRECTS = {
  '/vs-wetransfer': '/wetransfer-alternative',
  '/best-wetransfer-alternative-india': '/wetransfer-alternative',
  '/transfernow-alternative': '/compare',
  '/vs-transfernow': '/compare',
  '/send-files-without-compression': '/send-large-video',
  '/file-transfer-free': '/send-large-files',
  '/send-folder-online': '/send-large-files',
  '/create-file-sharing-link': '/send-large-files',
  '/qr-transfer': '/phone-to-laptop',
  '/iphone-to-windows': '/phone-to-laptop',
  '/android-to-mac': '/phone-to-laptop',
  '/airdrop-alternative': '/phone-to-laptop',
  '/p2p-file-transfer': '/phone-to-laptop',
  '/expire-file-link': '/how-to-send-large-files',
  '/terms-and-conditions': '/terms',
  '/tos': '/terms',
  '/contact': '/help',
};

/** Same document on another path. Stays 200 and noindex. /transfers is the dashboard. */
export const ALIAS_TO = {
  '/transfers': '/',
};

function page(title, description, crumb, h1, lead, sections) {
  return { title, description, crumb, h1, lead, sections };
}

export const ROUTE_SEO_MAP = {
  '/': page(
    'Send large files free, up to 6 GB — SendToAnyone',
    'Send a file up to 6 GB with no account. Share a link or email the link. Links last from 1 hour to 7 days.',
    'Home',
    'Send large files free, up to 6 GB',
    'Send a file up to 6 GB with no account. Share a link or email the link. Links last from 1 hour to 7 days.',
    [
      { h2: 'No account to send or receive', paragraphs: ['The person who downloads does not create an account either. Add a password if you want one. The link stops when the time you chose runs out.'] },
    ],
  ),
  '/how-it-works': page(
    'How a transfer works — SendToAnyone',
    'A product walkthrough: choose a file, pick a link or email, and set an expiry up to 7 days. No account is required to send.',
    'How it works',
    'How SendToAnyone works',
    'Three steps from your browser to theirs. Nothing to install, and no account to send up to 6 GB.',
    [
      { h2: 'Choose, send, download', paragraphs: ['Drop a file, pick how long the link stays open, and share the link or email it. The recipient opens it in a browser.'] },
    ],
  ),
  '/features': page(
    'Transfer features — SendToAnyone',
    'A transfer can include a link, optional email, an optional download password, and an expiry up to 7 days. The cap is 6 GB per transfer.',
    'Features',
    'What you can send, and how it arrives.',
    'A link, an email, a device handoff, or a request link. Free sends up to 6 GB with no account.',
    [
      { h2: 'What is included', paragraphs: ['Optional download password, an expiry you choose, and a link the recipient can open without an account.'] },
    ],
  ),
  '/security': page(
    'Download password and storage — SendToAnyone',
    'An optional password gates the download. It is checked as a salted hash, it is not in the email, and it does not encrypt the file.',
    'Security',
    'Locked on the way. Gone when you say.',
    'Plain controls: HTTPS in transit, a password that only gates the download, and deletion when the link expires.',
    [
      { h2: 'What the password does', paragraphs: ['The server stores a salted hash. A correct password opens the download. It does not encrypt the file.'] },
    ],
  ),
  '/pricing': page(
    'Free 6 GB transfers — SendToAnyone',
    'Free sends are 6 GB for 7 days with no account. Creator, Pro, and Studio raise the transfer size, the stored total, and how long the link stays open.',
    'Pricing',
    'Send free. Pay when the file is bigger.',
    'Free is 6 GB for up to 7 days, with no account. Larger plans raise the transfer size, the stored total, and how long the link stays open. The prices are on this page.',
    [
      { h2: 'What changes when you upgrade', paragraphs: ['An upgrade raises the size of one transfer, how much you can keep at once, and the longest link. Checkout does not grant the plan by itself. The server applies it after payment is confirmed.'] },
    ],
  ),
  '/receive': page(
    'Request files from someone else — SendToAnyone',
    'Create a request link so another person can upload without an account. Their upload still caps at 6 GB and the request lasts up to 7 days.',
    'Receive',
    'Request files from someone else',
    'Create a link and someone else uploads to you. They do not need an account.',
    [
      { h2: 'The request form', paragraphs: ['This page is the tool. The longer explanation of request links is on the file request page.'] },
    ],
  ),
  '/teams': page(
    'Sending with other people — SendToAnyone',
    'There is no separate team workspace. Everyone uses the same transfer: up to 6 GB, links up to 7 days, and no account required to send.',
    'Teams',
    'One transfer. Not a team plan.',
    'People can send from the browser with no account. A shared team workspace is not included yet.',
    [
      { h2: 'Sending as a group', paragraphs: ['Each person uses their own transfer. Studio is marked team-ready, and a shared workspace is not for sale.'] },
    ],
  ),
  '/apps': page(
    'Browser only, no desktop app — SendToAnyone',
    'SendToAnyone runs in the browser. There is no desktop app, mail plugin, or command-line tool. The limit is still 6 GB per transfer.',
    'Apps',
    'It already lives in the browser.',
    'Link, email, and device transfer open in a tab. There is no desktop app to install.',
    [
      { h2: 'No install', paragraphs: ['Open the site, send the file, and close the tab. There is no phone app and no mail plugin.'] },
    ],
  ),
  '/api-docs': page(
    'No public API yet — SendToAnyone',
    'There is no public API, SDK, or API key. Sample calls on this page are not a live service. Send a file from the browser instead.',
    'API',
    'There is no public API yet.',
    'Every upload goes through the browser. There is no SDK and no API key.',
    [
      { h2: 'Use the site', paragraphs: ['Sample calls on this page are not a live service. Send a file from the home page.'] },
    ],
  ),
  '/compare': page(
    'SendToAnyone compared with other send tools — SendToAnyone',
    'SendToAnyone is 6 GB per transfer, no account to send, an optional download password, and links up to 7 days. This page is where tool limits are compared.',
    'Compare',
    'Free is 6 GB and 7 days.',
    'This page compares limits. Numbers from other tools are dated and linked to their own pages.',
    [
      { h2: 'How to read the table', paragraphs: ['Where two public pages disagree, both stay visible. SendToAnyone free is 6 GB per transfer and up to 7 days, with no account on either side.'] },
    ],
  ),
  '/phone-to-laptop': page(
    'Phone to Laptop File Transfer, No USB or App — SendToAnyone',
    'Scan a QR code and move photos and videos from your phone to your laptop over the same Wi-Fi. Works iPhone to Windows and Android to Mac, in the browser.',
    'Phone to laptop',
    'Move files from your phone to your laptop, no cable',
    'Open this page on your laptop and scan the code with your phone. The file moves between the two browsers. Nothing is stored as a download link.',
    [
      { h2: 'iPhone to Windows', paragraphs: ['Open this page on the Windows laptop. On the iPhone, open the camera and scan the code. Both screens stay open until the file finishes. AirDrop does not cross from iPhone to Windows. This path does.'] },
      { h2: 'Android to Mac', paragraphs: ['Open this page on the Mac. Scan the code with the Android phone. You do not install a desktop app. If the phone and laptop are on different networks, use a normal download link instead.'] },
      { h2: 'Android to Windows', paragraphs: ['The same page works. The QR code is the pairing step. College Wi-Fi that isolates clients can block the direct path. Use a download link if the two devices cannot see each other.'] },
      { h2: 'When a cable is better', paragraphs: ['A cable is faster for a full camera roll on a desk you control. Quick Share and Phone Link are better when you already use them every day. This page is for a browser on both sides, with nothing to install.'] },
    ],
  ),
  '/checksum': page(
    'SHA-256 and SHA-1 file check — SendToAnyone',
    'Calculate a SHA-256 or SHA-1 hash in the browser on your device, then compare it with a hash you already trust.',
    'Checksum',
    'Check a file against its hash.',
    'Your browser computes the hash. The file is not uploaded.',
    [
      { h2: 'On your device', paragraphs: ['Pick a file, paste the hash you were given, and see if they match.'] },
    ],
  ),
  '/compliance': page(
    'Data handling notes, not a certification — SendToAnyone',
    'Files follow the expiry you set, up to 7 days. This page does not certify SendToAnyone against a compliance standard.',
    'Compliance',
    'Data handling notes',
    'This page describes what the product does with a file. It is not a compliance certificate.',
    [
      { h2: 'What is not offered', paragraphs: ['A signed data-processing agreement is not offered. There is no shared team workspace.'] },
    ],
  ),
  '/resources': page(
    'Guides and tools for sending a file — SendToAnyone',
    'A short index of the send guide, the receive page, device transfer, and the checksum tool. Every transfer still caps at 6 GB.',
    'Resources',
    'Guides and tools for sending a file.',
    'Short guides and small tools. Every page links back to a free transfer.',
    [
      { h2: 'Start here', paragraphs: ['How to send a large file, how to collect files with a request link, and how to move a file from a phone to a laptop.'] },
    ],
  ),
  '/privacy': page(
    'Privacy policy — SendToAnyone',
    'How a sent file is handled, when the link expires, and that sending does not require an account.',
    'Privacy',
    'How Privacy Works on SendToAnyone',
    'Files are stored until the link expires, then deleted. Sending does not require an account.',
    [
      { h2: 'What we do not do', paragraphs: ['Files are not used to train models. A download password gates the download and does not encrypt the file.'] },
    ],
  ),
  '/terms': page(
    'Terms of service — SendToAnyone',
    'The rules for using SendToAnyone, including the 6 GB per transfer cap and links that last up to 7 days.',
    'Terms',
    'Terms & Conditions',
    'The service is the website at sendtoanyone.com. There is no mobile app.',
    [
      { h2: 'What you are agreeing to', paragraphs: ['Free transfers are up to 6 GB and 7 days. Larger plans raise those limits after payment is confirmed. There is no desktop or phone app.'] },
    ],
  ),
  '/help': page(
    'Help and contact — SendToAnyone',
    'Short answers for sending a file, opening a link, and expiry, plus a form to reach the people who run SendToAnyone.',
    'Help',
    'How can we help you?',
    'Short answers about sending, links, and expiry. Write to the people who run SendToAnyone.',
    [
      { h2: 'Contact', paragraphs: ['Use the form on this page. The person who built the product is named on the about page.'] },
    ],
  ),
  '/status': page(
    'File API status check — SendToAnyone',
    'This page checks whether the file API answers. It does not report uptime, email delivery, or storage health.',
    'Status',
    'What this page can confirm',
    'This checks whether the file API answers. It does not report uptime or email delivery.',
    [
      { h2: 'A live check', paragraphs: ['The button on this page asks the file API if it is configured. It is not an uptime history.'] },
    ],
  ),
  '/changelog': page(
    'Product changelog — SendToAnyone',
    'A record of changes that have already shipped. It is not a promise of future features.',
    'Changelog',
    'SendToAnyone changelog',
    'Changes that have already shipped, newest first.',
    [
      { h2: 'A record, not a roadmap', paragraphs: ['This page lists what is already in the product.'] },
    ],
  ),
  '/widget': page(
    'Embed preview, no hosted widget — SendToAnyone',
    'This page previews embed markup for a receive box. A hosted widget script is not part of the app. Use the receive page to collect files.',
    'Widget',
    'Put a request link on your site.',
    'There is no hosted widget. Make a request link, then paste a button that opens it.',
    [
      { h2: 'A button, not a script', paragraphs: ['Visitors upload on SendToAnyone. A hosted embed script is not part of the app.'] },
    ],
  ),
  '/send-large-files': page(
    'Send a large file, up to 6 GB — SendToAnyone',
    'One transfer holds up to 6 GB and needs no account. Choose a link or email, and an expiry from 1 hour to 7 days. Larger plans raise the size and how long the link stays open.',
    'Send a large file',
    'Send a large file',
    'One cloud transfer holds 6 GB. No account. You pick how long the link stays open, from 1 hour up to 7 days.',
    [
      { h2: 'The 6 GB ceiling', paragraphs: ['6 GB is the total of every file in that free transfer. A larger plan raises the ceiling after payment is confirmed. Files over your limit have to be split.'] },
    ],
  ),
  '/send-files-without-signup': page(
    'Send files without creating an account — SendToAnyone',
    'The sender does not need an account, and neither does the recipient. Anyone who has the link can open it unless you add a download password.',
    'No account',
    'Send files without creating an account',
    'You can upload without signing up. The person who downloads does not sign up either.',
    [
      { h2: 'Neither side signs up', paragraphs: ['Drop the files, create the link, and send it. A password is optional. An account is only needed if you want a larger plan.'] },
    ],
  ),
  '/how-to-send-large-files': page(
    'How to send a large file — SendToAnyone',
    'Pick a file under 6 GB, create a link or email that link, and set an expiry up to 7 days. For a same-network move, use device transfer instead.',
    'How to send',
    'How to send a large file',
    'A procedure for the home uploader. The free limit is 6 GB. The link lasts from 1 hour to 7 days.',
    [
      { h2: 'On the home uploader', paragraphs: ['Drop the file, pick an expiry, and press the button to create the link. Stay on the page until the link is shown.'] },
    ],
  ),
  '/about': page(
    'About SendToAnyone — Prudhvi Dasari',
    'SendToAnyone is built by Prudhvi Dasari, a solo indie developer in India. Files sit on Cloudflare until the link expires.',
    'About',
    'Built by one person in India',
    'Prudhvi Dasari is a solo indie developer in India. He built SendToAnyone so a file can move without an account on either side.',
    [
      { h2: 'Who runs this', paragraphs: ['Prudhvi designs and ships the product himself. There is no separate company team behind the site. You can reach him from the help page.'] },
      { h2: 'Where files go', paragraphs: ['A cloud transfer is stored on Cloudflare R2 until the expiry you set, then a scheduled cleanup deletes it. A phone-to-laptop transfer stays between the two browsers and is not kept as a download.'] },
      { h2: 'Why it exists', paragraphs: ['Most send tools ask for an account before the file moves, or they squeeze the file to fit a chat app. This one starts in the browser, with a link you can put in WhatsApp, email, or a message.'] },
    ],
  ),
  '/wetransfer-alternative': page(
    'WeTransfer Alternative, Free and No Account — SendToAnyone',
    'Send up to 6 GB free with no account for you or the person receiving it. Links last from 1 hour to 7 days, with an optional password. Compared side by side with WeTransfer.',
    'WeTransfer alternative',
    'A WeTransfer alternative that needs no account',
    'No account on either side. 6 GB free. You pick the expiry, from 1 hour to 7 days.',
    [
      { h2: 'Side by side', paragraphs: ['Checked on 30 October 2026 against WeTransfer’s own help pages. WeTransfer Free, as described there, needs an account, caps free use per month, and keeps links for a short time. SendToAnyone free is 6 GB on one transfer, no account to send or download, and a link you set from 1 hour to 7 days. An optional password gates the download. A request link lets someone upload to you.'] },
      { h2: 'Where WeTransfer is the better choice', paragraphs: ['WeTransfer is the name a lot of clients already trust. If a studio’s clients expect that brand, or you need the larger paid tier they sell, use them. SendToAnyone is the better fit when neither person wants an account and the file fits in 6 GB.'] },
      { h2: 'How to send', paragraphs: ['Open the home page, drop the file, choose how long the link stays open, and copy the link. The recipient opens it in a browser. From India, that link pastes into WhatsApp and opens on a phone without an app install.'] },
      { h2: 'Other options', paragraphs: ['Smash, TransferNow, and SwissTransfer each publish their own limits. The compare page keeps those numbers next to the page they came from, with the date they were checked.'] },
    ],
  ),
  '/send-large-video': page(
    'Send Large Video Files Without Losing Quality — SendToAnyone',
    'Send the original video file, byte for byte, up to 6 GB free. No account for you or your client, no compression, and the link expires when you choose.',
    'Large video',
    'Send large video files without losing quality',
    'The file you upload is the file they download. The uploader does not re-encode video.',
    [
      { h2: 'Why chat apps change the picture', paragraphs: ['WhatsApp, Instagram, and email re-encode or refuse a large video. WhatsApp’s own help describes a much smaller default for video than for a document. A download link skips that step. The bytes stored are the bytes you selected.'] },
      { h2: 'What original quality means here', paragraphs: ['Nothing is transcoded. A client can run the checksum page on the file they received and compare it with the hash you computed before upload. If the hashes match, the file was not altered in transit by this service.'] },
      { h2: 'A simple editor workflow', paragraphs: ['Send a small review export first. After sign-off, send the master with a longer expiry and a password. Give the password on another channel. The email, if you send one, does not include it.'] },
      { h2: 'On a phone, and over 6 GB', paragraphs: ['The recipient can open the link on a phone and download on Wi-Fi. A 4K file from an iPhone sends if it is under the limit for the plan you are using. Free stops at 6 GB. A larger plan raises that after payment is confirmed. This is the handoff of a master file, not a client gallery.'] },
    ],
  ),
  '/send-files-whatsapp': page(
    'Send Files Bigger Than WhatsApp\'s 2 GB Limit — SendToAnyone',
    'WhatsApp caps documents at 2 GB and shrinks videos. Upload the file once, paste the link in your chat, and it arrives in original quality. No app or account needed.',
    'WhatsApp',
    'Send a file that\'s too big for WhatsApp',
    'Upload the file once, paste the link in the chat, and the file arrives without WhatsApp re-encoding it.',
    [
      { h2: 'The limit, from WhatsApp', paragraphs: ['Checked on 30 October 2026. WhatsApp’s help center says a document can be up to 2 GB, and videos are compressed unless you pick an HD option that is still far below a master file. A movie or a project folder over that cap will not go through the chat as the original file.'] },
      { h2: 'Three steps', paragraphs: ['Upload the file on the home page. Copy the download link. Paste it into the WhatsApp chat, including a group. Everyone opens the same link. They do not install an app and they do not need an account.'] },
      { h2: 'On the receiving phone', paragraphs: ['Open the link in the browser. For a big file, download on Wi-Fi. The link lasts as long as the sender chose, up to 7 days on the free plan. A password, if the sender set one, is not in the chat unless they type it there.'] },
      { h2: 'Is it safe?', paragraphs: ['The link is the access. Add a password if the chat is wider than the people who should have the file. The security page explains what that password does and does not do.'] },
    ],
  ),
  '/file-request': page(
    'File Request Link: Collect Files From Anyone — SendToAnyone',
    'Create a link, share it, and clients or classmates upload files straight to you. They don\'t need an account. A simple alternative to Dropbox and Google Drive file requests.',
    'File request',
    'Collect files from anyone with one link',
    'You make a link. They upload. They do not create an account, and they do not see each other’s files.',
    [
      { h2: 'What a request link is', paragraphs: ['It is the reverse of a send. You publish one link. A client, a classmate, or a guest opens it and uploads to you. The form they see is on the receive page. This page explains when to use it.'] },
      { h2: 'Who it is for', paragraphs: ['An agency collecting a logo pack. A photographer asking a client for picks. A teacher collecting assignments. A host collecting photos after an event. Each person uploads into the same request without joining a drive.'] },
      { h2: 'Compared with Drive and Dropbox', paragraphs: ['Dropbox and Google Drive file requests are useful when the files should land in a folder you already share with a team. They also pull people into those accounts. Here the uploader needs no account. What they do better is long-term folders, comments, and permissions. Use them for that. Use a request link when you only need the files.'] },
      { h2: 'What you can set', paragraphs: ['The request lasts up to 7 days on the free plan. Each upload follows the same size cap as a normal free transfer, 6 GB. A password is optional on a normal send. Uploaders do not see a list of everyone else’s files.'] },
    ],
  ),
  '/send-files-by-email': page(
    'Email Large Files Past Gmail\'s 25 MB Limit — SendToAnyone',
    'Gmail stops attachments at 25 MB. Upload up to 6 GB free and email the download link, with an expiry and an optional password.',
    'Email large files',
    'Email a file that\'s too big to attach',
    'The message carries the link. The file does not sit in the inbox.',
    [
      { h2: 'The attachment limits', paragraphs: ['Checked on 30 October 2026. Google’s Gmail help says you can attach up to 25 MB. Outlook’s limit depends on the account. Microsoft’s own page is the source for that number, because it is not one figure for every mailbox.'] },
      { h2: 'Why a Drive link can fail', paragraphs: ['Gmail turns an oversized attachment into a Drive link. The recipient can be blocked by permissions or by their own storage. A SendToAnyone link does not ask them to sign in, and it does not use their Drive quota.'] },
      { h2: 'Three steps', paragraphs: ['Upload the file. Add the recipients on the email tab. They get a message with the download link. Tell them to expect it and to check spam. You can copy the same link and send it again yourself after the first email. When the expiry hits, the link stops.'] },
    ],
  ),
};

export const INDEXABLE_PATHS = Object.keys(ROUTE_SEO_MAP);

export const NOT_FOUND = {
  title: 'Page not found — SendToAnyone',
  description: 'That page is not on SendToAnyone. Send a file from the home page, or open help.',
  h1: 'This page is gone.',
  lead: 'The link may be wrong, or the page was never here. Send a file from the home page.',
  sections: [
    { h2: 'Try one of these', paragraphs: ['The home page sends a file. Help answers common questions. A download link looks like /d/ and only works for that transfer.'] },
  ],
};

export function normalizePath(input) {
  const raw = String(input ?? '/');
  const pathOnly = raw.split('#')[0].split('?')[0];
  if (pathOnly === '' || pathOnly === '/') return '/';
  const withLeading = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  return withLeading.replace(/\/+$/, '') || '/';
}

export function canonicalUrlForPath(pathname) {
  const path = normalizePath(pathname);
  return path === '/' ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${path}`;
}

export function homepageStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'SendToAnyone',
        url: CANONICAL_ORIGIN,
        logo: `${CANONICAL_ORIGIN}/favicon.svg`,
      },
      {
        '@type': 'WebSite',
        name: 'SendToAnyone',
        url: CANONICAL_ORIGIN,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'SendToAnyone',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        url: CANONICAL_ORIGIN,
        description: 'Send a file up to 6 GB with no account. Share a link or email the link.',
      },
    ],
  };
}

export function secondaryStructuredData({ title, description, url, crumb }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${CANONICAL_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: crumb, item: url },
        ],
      },
      {
        '@type': 'WebPage',
        name: title,
        description,
        url,
        isPartOf: { '@type': 'WebSite', name: 'SendToAnyone', url: CANONICAL_ORIGIN },
      },
    ],
  };
}

export function resolveSeo({ pathname, customTitle, customDescription, customCanonical } = {}) {
  void customTitle;
  void customDescription;
  void customCanonical;
  const currentPath = normalizePath(pathname);
  const isPrivateTransfer = /^\/(d|download|request)\//.test(currentPath);

  if (isPrivateTransfer) {
    const isRequest = currentPath.startsWith('/request/');
    return {
      title: isRequest ? 'Upload Files — SendToAnyone' : 'Download Files — SendToAnyone',
      description: 'A private transfer link. This page is not for public search.',
      robots: NOINDEX_ROBOTS,
      canonical: null,
      jsonLd: null,
      indexable: false,
    };
  }

  const aliasTarget = ALIAS_TO[currentPath];
  if (aliasTarget) {
    const primary = ROUTE_SEO_MAP[aliasTarget] || ROUTE_SEO_MAP['/'];
    return {
      title: primary.title,
      description: primary.description,
      robots: NOINDEX_ROBOTS,
      canonical: canonicalUrlForPath(aliasTarget),
      jsonLd: null,
      indexable: false,
    };
  }

  const route = ROUTE_SEO_MAP[currentPath];
  if (!route) {
    return {
      title: NOT_FOUND.title,
      description: NOT_FOUND.description,
      robots: NOINDEX_ROBOTS,
      canonical: null,
      jsonLd: null,
      indexable: false,
    };
  }

  const canonical = canonicalUrlForPath(currentPath);
  const jsonLd = currentPath === '/'
    ? homepageStructuredData()
    : secondaryStructuredData({
      title: route.title,
      description: route.description,
      url: canonical,
      crumb: route.crumb,
    });

  return {
    title: route.title,
    description: route.description,
    robots: INDEX_ROBOTS,
    canonical,
    jsonLd,
    indexable: true,
  };
}

export function isAppDocument(pathname) {
  const path = normalizePath(pathname);
  if (ROUTE_SEO_MAP[path] || ALIAS_TO[path]) return true;
  if (path === '/receive') return true;
  return /^\/(d|download|request)\/[^/]+$/.test(path);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function prerenderArticle(route) {
  const blocks = [
    `<h1>${escapeHtml(route.h1)}</h1>`,
    `<p>${escapeHtml(route.lead)}</p>`,
    ...(route.sections || []).flatMap((section) => [
      section.h2 ? `<h2>${escapeHtml(section.h2)}</h2>` : '',
      ...(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ]),
  ];
  return `<article>${blocks.filter(Boolean).join('')}</article>`;
}

export function sitemapXml(lastmod = '2026-10-29') {
  const urls = INDEXABLE_PATHS.map((path) => `  <url>\n    <loc>${canonicalUrlForPath(path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
