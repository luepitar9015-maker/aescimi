
import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee', border: '1px solid red', margin: '20px' }}>
            <h2>Algo salió mal.</h2>
            <details style={{ whiteSpace: 'pre-wrap' }}>
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo ? this.state.errorInfo.componentStack : 'No stack trace available'}
            </details>
            <button onClick={() => window.location.reload()} style={{ marginTop: '10px' }}>Recargar Página</button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
