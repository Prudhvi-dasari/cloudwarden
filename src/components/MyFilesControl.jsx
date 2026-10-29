import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { useAccount } from '../lib/AccountContext';
import { myFilesForCompactHeader } from '../lib/myFilesNav';
import MyUploadsDrawer from './MyUploadsDrawer';

/**
 * Signed-in My Files control for pages that do not use the main navbar.
 * Opens the same uploads drawer. Guests get nothing, so the existing header stays as it is.
 */
export default function MyFilesControl() {
  const { user } = useAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const action = myFilesForCompactHeader(user);

  if (action !== 'local-drawer') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="My Files"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-pressed={open}
        className="ds-btn ds-btn-ghost ds-btn-sm acct-ui"
      >
        <FolderKanban className="w-4 h-4" aria-hidden="true" />
        My Files
      </button>
      <MyUploadsDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        user={user}
        onStartNewTransfer={() => {
          setOpen(false);
          if (location.pathname !== '/') navigate('/');
        }}
      />
    </>
  );
}
