import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_SEO_MAP = {
  '/': {
    title: '[No Sign Up] Send Large Files Online Free (Up to 25 GB) — iTransfer',
    description: 'Send large files up to 25 GB 100% free with no registration or account required. Instant shareable links, AES-256 encryption, direct email transfer, and gigabit speeds.',
    keywords: 'send files online, file transfer free, large file transfer, how to send large files, send large files, send files online free, share files free, send large files online free, wetransfer alternative, send huge files online free',
    canonical: 'https://itransfer.iprudhvi.in/',
  },
  '/how-it-works': {
    title: 'How It Works — Send & Share Large Files in 3 Steps | iTransfer',
    description: 'Learn how to send files up to 25 GB with iTransfer. Select files, customize links with passwords and auto-expiration, and transfer at gigabit speed.',
    keywords: 'how to send large files, file transfer guide, share large files online, encrypted file sharing steps',
    canonical: 'https://itransfer.iprudhvi.in/how-it-works',
  },
  '/features': {
    title: 'Features — Gigabit Engine, P2P Transfer & AES-256 Vault | iTransfer',
    description: 'Explore all iTransfer features: 25GB transfer limits, direct device P2P, email transfers, custom links, password protection, and checksum integrity.',
    keywords: 'file transfer features, p2p transfer, encrypted file sharing, high speed file transfer, large file sending features',
    canonical: 'https://itransfer.iprudhvi.in/features',
  },
  '/security': {
    title: 'Security & Privacy — AES-256 Vault Encryption & Zero-Knowledge | iTransfer',
    description: 'Bank-grade security: TLS 1.3 in-transit, AES-256 on-disk, optional password hashing, automatic file purges, and zero data tracking.',
    keywords: 'secure file transfer, encrypted file sharing, aes 256 file sharing, secure wetransfer alternative, zero knowledge file transfer',
    canonical: 'https://itransfer.iprudhvi.in/security',
  },
  '/pricing': {
    title: 'Pricing Plans — Free 5GB & Pro 25GB Gigabit Transfers | iTransfer',
    description: '100% Free 5GB transfers with zero signup. Upgrade to iTransfer Pro for 25GB single transfers, permanent storage, priority bandwidth, and custom branding.',
    keywords: 'file transfer pricing, free file transfer, pro file sharing, send 25gb files, cheap wetransfer alternative',
    canonical: 'https://itransfer.iprudhvi.in/pricing',
  },
  '/receive': {
    title: 'Request Files — Collect Files from Clients Securely | iTransfer',
    description: 'Create a private upload portal to collect files and documents from clients without requiring them to sign up or install apps.',
    keywords: 'request files online, client file portal, collect large files, file drop link, receive client documents',
    canonical: 'https://itransfer.iprudhvi.in/receive',
  },
  '/file-request': {
    title: 'File Request Portal — Collect Large Files Without Signup | iTransfer',
    description: 'Collect photos, videos, and large archives directly into your storage. No account creation needed for uploaders.',
    keywords: 'file request, receive files from clients, file drop portal, collect documents online',
    canonical: 'https://itransfer.iprudhvi.in/file-request',
  },
  '/teams': {
    title: 'iTransfer for Teams — Collaborative Workspace File Delivery | iTransfer',
    description: 'Empower creative agencies, production studios, and engineering teams with high-speed asset delivery and centralized audit logging.',
    keywords: 'team file transfer, agency file sharing, video production file sharing, enterprise file transfer',
    canonical: 'https://itransfer.iprudhvi.in/teams',
  },
  '/apps': {
    title: 'Desktop & Mobile Web Apps — Transfer Anywhere | iTransfer',
    description: 'Use iTransfer seamlessly across iPhone, iPad, Android, Mac, Windows, and Linux right from your browser.',
    keywords: 'file transfer app, mobile file sharing, mac to windows transfer, iphone file transfer app',
    canonical: 'https://itransfer.iprudhvi.in/apps',
  },
  '/api-docs': {
    title: 'Developer API & SDK — Programmatic File Transfers | iTransfer',
    description: 'Automate uploads and integrate gigabit file sharing directly into your applications with our REST API, Webhooks, and SDKs.',
    keywords: 'file transfer api, upload api, file sharing sdk, tus resumable api, tus upload sdk',
    canonical: 'https://itransfer.iprudhvi.in/api-docs',
  },
  '/compare': {
    title: 'Compare File Transfer Services — iTransfer vs WeTransfer vs TransferNow',
    description: 'See why iTransfer outperforms WeTransfer, TransferNow, and Google Drive in upload speed, file limits, security, and direct P2P streaming.',
    keywords: 'wetransfer vs itransfer, transfernow vs itransfer, best file transfer site 2026, file transfer comparison',
    canonical: 'https://itransfer.iprudhvi.in/compare',
  },
  '/vs-wetransfer': {
    title: 'iTransfer vs WeTransfer — Feature Comparison & Speed Test',
    description: 'Compare iTransfer vs WeTransfer. Get 25GB transfer limits, direct device P2P, and faster gigabit streaming with no forced signup.',
    keywords: 'wetransfer alternative, itransfer vs wetransfer, faster than wetransfer, wetransfer free limit',
    canonical: 'https://itransfer.iprudhvi.in/vs-wetransfer',
  },
  '/vs-transfernow': {
    title: 'iTransfer vs TransferNow — Which is Faster & More Secure?',
    description: 'Compare iTransfer vs TransferNow. Enjoy direct WebRTC device transfers, custom links, and higher free bandwidth limits.',
    keywords: 'transfernow alternative, itransfer vs transfernow, transfernow free alternative',
    canonical: 'https://itransfer.iprudhvi.in/vs-transfernow',
  },
  '/qr-transfer': {
    title: 'QR Code File Transfer — Instant Mobile to Desktop Sharing | iTransfer',
    description: 'Scan a QR code to transfer photos and videos directly between your phone and laptop without cables or software installation.',
    keywords: 'qr code file transfer, scan to transfer files, phone to pc qr transfer, send files with qr code',
    canonical: 'https://itransfer.iprudhvi.in/qr-transfer',
  },
  '/checksum': {
    title: 'File Checksum Verifier — SHA-256 & MD5 Hash Tool | iTransfer',
    description: 'Verify bit-for-bit file integrity in real-time. Compute SHA-256 and MD5 hashes locally in your browser before and after transfer.',
    keywords: 'file checksum verifier, sha256 hash generator, md5 file check, verify file integrity online',
    canonical: 'https://itransfer.iprudhvi.in/checksum',
  },
  '/compliance': {
    title: 'Compliance & GDPR Standards — Data Sovereignty | iTransfer',
    description: 'Understand iTransfer compliance: GDPR, HIPAA-compliant encryption standards, ISO 27001 data center partners, and automated data purging.',
    keywords: 'gdpr file transfer, hipaa compliant file sharing, secure data compliance',
    canonical: 'https://itransfer.iprudhvi.in/compliance',
  },
  '/resources': {
    title: 'File Sharing Resources & Speed Guides | iTransfer',
    description: 'Guides and benchmarks on large file transfers, network optimization, 4K video sharing, and privacy tips.',
    keywords: 'file transfer guides, network speed optimization, how to share 4k video, transfer speed tips',
    canonical: 'https://itransfer.iprudhvi.in/resources',
  },
  '/privacy': {
    title: 'Privacy Policy — Zero Data Selling & Auto-Purge | iTransfer',
    description: 'Our commitment to your privacy: No file content tracking, automated file purging upon expiration, and zero data selling.',
    keywords: 'itransfer privacy policy, private file sharing, zero tracking file transfer',
    canonical: 'https://itransfer.iprudhvi.in/privacy',
  },
  '/terms': {
    title: 'Terms of Service | iTransfer',
    description: 'Terms of service and fair usage guidelines for iTransfer file transfer services.',
    keywords: 'itransfer terms of service, terms and conditions',
    canonical: 'https://itransfer.iprudhvi.in/terms',
  },
  '/help': {
    title: 'How to Send Large Files Online Free (Up to 25GB, No Sign Up) — iTransfer Guide',
    description: 'Step-by-step guide on how to send large files, heavy videos, and archives online for free without registration. Instant shareable link & direct P2P.',
    keywords: 'how to send large files, how to transfer large files online, how to share files online securely for free, send heavy files online, send huge files online free',
    canonical: 'https://itransfer.iprudhvi.in/help',
  },
  '/contact': {
    title: 'Support & Help Center | iTransfer',
    description: 'Get help with iTransfer file sharing, gigabit streaming, encryption, and custom team solutions.',
    keywords: 'itransfer support, itransfer contact, help center',
    canonical: 'https://itransfer.iprudhvi.in/contact',
  },
  '/how-to-send-large-files': {
    title: 'How to Send Large Files Online Free (Step-by-Step Guide) | iTransfer',
    description: 'Learn how to send large files up to 25GB for free with no account required. Compare email vs link vs P2P transfers.',
    keywords: 'how to send large files, how to transfer large files online, send heavy files online, send large files free',
    canonical: 'https://itransfer.iprudhvi.in/how-to-send-large-files',
  },
  '/file-transfer-free': {
    title: '[100% Free] Send Files Online Free (Up to 25GB, No Sign Up) | iTransfer',
    description: 'Send files online completely free up to 25GB. No registration, no credit card, and no hidden fees. Instant download link.',
    keywords: 'file transfer free, send files free, send files online free, free file sharing no account, send huge files online free',
    canonical: 'https://itransfer.iprudhvi.in/file-transfer-free',
  },
};

export default function SeoHead({ customTitle, customDescription, customKeywords, customCanonical }) {
  const location = useLocation();
  const currentPath = location.pathname;

  useEffect(() => {
    // Lookup matching route or fallback to default
    const routeConfig = ROUTE_SEO_MAP[currentPath] || ROUTE_SEO_MAP['/'];
    
    const title = customTitle || routeConfig.title;
    const description = customDescription || routeConfig.description;
    const keywords = customKeywords || routeConfig.keywords;
    const canonical = customCanonical || routeConfig.canonical || `https://itransfer.iprudhvi.in${currentPath}`;

    // 1. Document Title
    document.title = title;

    // 2. Helper to set/update meta tag
    const setMetaTag = (attr, key, content) => {
      let elem = document.querySelector(`meta[${attr}="${key}"]`);
      if (!elem) {
        elem = document.createElement('meta');
        elem.setAttribute(attr, key);
        document.head.appendChild(elem);
      }
      elem.setAttribute('content', content);
    };

    // 3. Update Meta Description & Keywords
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'title', title);
    if (keywords) setMetaTag('name', 'keywords', keywords);

    // 4. Update OpenGraph Tags
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', canonical);

    // 5. Update Twitter Tags
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:url', canonical);

    // 6. Update Canonical Link
    let linkElem = document.querySelector('link[rel="canonical"]');
    if (!linkElem) {
      linkElem = document.createElement('link');
      linkElem.setAttribute('rel', 'canonical');
      document.head.appendChild(linkElem);
    }
    linkElem.setAttribute('href', canonical);

  }, [location.pathname, customTitle, customDescription, customKeywords, customCanonical]);

  return null;
}
