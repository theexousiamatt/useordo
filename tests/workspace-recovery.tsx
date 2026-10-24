// Development-only visual fixture; excluded from the production entrypoint.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceRecoveryView } from '../src/components/states/WorkspaceRecovery';
import '../src/index.css';
function Preview() {
 const [error, setError] = useState("We couldn't load your workspaces. Check your connection and try again.");
 const [signOutError, setSignOutError] = useState(false);
 const width = Number(new URLSearchParams(location.search).get('width'));
 return <div style={{ width: width > 0 ? Math.min(width, innerWidth) : '100%', margin: 'auto' }}>
  <WorkspaceRecoveryView error={error} signingOut={false} signOutError={signOutError} onRetry={() => setError('Preview: retry is available without losing your saved workspace.')} onSignOut={() => setSignOutError(true)}/>
 </div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
