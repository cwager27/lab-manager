import './styles/global.css';
import { useState } from 'react';
import Navigation from './components/Navigation';
import Responsibilities from './pages/Responsibilities';

const userRole = 'admin';

export default function App() {
  const [currentPage, setCurrentPage] = useState('responsibilities');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      <Navigation
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userRole={userRole}
      />
      <main style={{
        marginLeft: '240px',
        flex: 1,
        padding: '32px',
        maxWidth: 'calc(100vw - 240px)'
      }}>
        {currentPage === 'responsibilities' && <Responsibilities userRole={userRole} />}
        {currentPage !== 'responsibilities' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '60vh', color: 'var(--text-muted)', fontSize: '15px'
          }}>
            This system is coming soon.
          </div>
        )}
      </main>
    </div>
  );
}
