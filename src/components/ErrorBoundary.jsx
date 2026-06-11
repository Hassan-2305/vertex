import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Vertex Error Boundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'var(--bg)',
          gap: 16, textAlign: 'center', padding: '2rem'
        }}>
          <div style={{ fontSize: 56 }}>⚠️</div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
            Something went wrong
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 360 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/' }}
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
