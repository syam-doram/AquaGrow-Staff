import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StockInward from './pages/StockInward';
import ProductList from './pages/ProductList';
import InvoiceCreate from './pages/InvoiceCreate';
import Payments from './pages/Payments';
import DayClose from './pages/DayClose';
import HarvestDraft from './pages/HarvestDraft';
import Statement from './pages/Statement';

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute />
          }
        >
          <Route index element={<Layout><Dashboard /></Layout>} />
          <Route path="stock-inward"  element={<Layout><StockInward /></Layout>} />
          <Route path="products"      element={<Layout><ProductList /></Layout>} />
          <Route path="invoice"       element={<Layout><InvoiceCreate /></Layout>} />
          <Route path="payments"      element={<Layout><Payments /></Layout>} />
          <Route path="day-close"     element={<Layout><DayClose /></Layout>} />
          <Route path="harvest-draft" element={<Layout><HarvestDraft /></Layout>} />
          <Route path="statement"     element={<Layout><Statement /></Layout>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  </AuthProvider>
);

export default App;
