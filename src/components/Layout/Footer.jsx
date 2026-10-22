import React from 'react';
import { APP_INFO } from '../../utils/constants';

export function Footer() {
  return (
    <footer className="app-footer" id="main-footer">
      <div className="container">
        <p id="footer-text">
          {APP_INFO.NAME} &bull; {APP_INFO.PHASE} &bull; Intelligent Peer-Learning Platform Foundation
        </p>
      </div>
    </footer>
  );
}

export default Footer;
