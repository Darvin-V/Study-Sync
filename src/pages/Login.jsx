import React from 'react';
import { AuthPage } from '../components/Auth/AuthPage';

/**
 * StudySync AI — Login Page
 * 
 * Renders the dedicated, professional authentication screen in Sign In mode.
 */
export function Login() {
  return <AuthPage initialMode="login" />;
}

export default Login;
