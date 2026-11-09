import { Component, type ReactNode } from 'react';

// Keeps an error in one service from unmounting the whole window
export class ErrorBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
	state = { error: null as Error | null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	componentDidCatch(error: Error) {
		console.error('Service ' + this.props.name + ' crashed:', error);
	}

	render() {
		if ( this.state.error ) {
			return (
				<div className="service-placeholder">
					<h3>{this.props.name} stopped working</h3>
					<p style={{ opacity: 0.7 }}>{this.state.error.message}</p>
					<button onClick={() => this.setState({ error: null })}>Try again</button>
				</div>
			);
		}
		return this.props.children;
	}
}
