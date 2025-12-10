import React from 'react';
import { Github } from 'lucide-react';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <p className="footer-text">
            "WireGuard" and the "WireGuard" logo are registered trademarks of Jason A. Donenfeld.
          </p>
        </div>
        <div className="footer-section">
          <a
            href="https://github.com/Arthur2500/wireguard-multiclient-webui"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            aria-label="View source code on GitHub"
          >
            <Github size={16} /> Source Code
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
