import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders login page when not authenticated', () => {
    localStorage.clear();
    render(<App />);
    // Look for the WireGuard WebUI heading on login page
    const titleElement = screen.getByText('WireGuard WebUI');
    expect(titleElement).toBeInTheDocument();
  });
});
