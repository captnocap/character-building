import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import { AppProvider } from './context/AppContext';

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Layout />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
