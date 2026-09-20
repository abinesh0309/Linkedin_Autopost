import React from 'react';

// Keeps a rendering bug from leaving the reviewer on a blank white page.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 460, padding: '36px 32px', textAlign: 'center' }}>
          <div className="card-title" style={{ fontSize: 24, marginBottom: 6 }}>Something went wrong</div>
          <p style={{ fontSize: 14.5, color: 'rgba(32,31,29,.65)', margin: '0 0 22px' }}>
            The screen hit an unexpected error. Reloading usually fixes it, and any job already running on the backend will resume.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ alignSelf: 'center' }}>
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}
