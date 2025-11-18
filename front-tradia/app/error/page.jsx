'use client';

import { useEffect, useState } from 'react';

const ErrorPage = () => {
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Obtiene el mensaje de error de localStorage
    const message = localStorage.getItem('error_message');
    setErrorMessage(message || 'Ha ocurrido un error inesperado.');
  }, []);

  return (
    <div>
      <h1>Error</h1>
      <p>{errorMessage}</p>
    </div>
  );
};

export default ErrorPage;