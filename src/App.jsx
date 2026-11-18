import { Component, lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApplyHtmlPrefs, useT } from './i18n';
import { seedIfEmpty } from './db/seed';
import { ToastHost, DialogHost } from './components/ui';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';

const Products = lazy(() => import('./pages/Products'));
const Categories = lazy(() => import('./pages/Categories'));
const Labels = lazy(() => import('./pages/Labels'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Customers = lazy(() => import('./pages/Customers'));
const Sales = lazy(() => import('./pages/Sales'));
const Returns = lazy(() => import('./pages/Returns'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Shifts = lazy(() => import('./pages/Shifts'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));

// Keeps one broken screen from taking down the whole till.
class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <p className="font-display text-2xl font-bold mb-2">This screen hit a problem</p>
        <p className="muted mb-4">Your sales and data are safe. Reload the screen to continue. · ඔබගේ දත්ත ආරක්ෂිතයි. නැවත පූරණය කරන්න.</p>
        <p className="text-sm muted mb-4 break-all">{String(this.state.err?.message || this.state.err)}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload · නැවත පූරණය</button>
      </div>
    );
  }
}

function Loading() {
  return <div className="h-64 grid place-items-center"><div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-700 animate-spin" /></div>;
}

const Router = __SINGLE__ ? MemoryRouter : BrowserRouter;

export default function App() {
  useApplyHtmlPrefs();
  const [ready, setReady] = useState(false);
  const t = useT();
  useEffect(() => { seedIfEmpty().catch(console.error).finally(() => setReady(true)); }, []);
  if (!ready) return <div className="h-dvh grid place-items-center"><div className="text-center"><Loading /><p className="muted">{t('common.loading')}</p></div></div>;
  const lazyEl = (C) => <Boundary><Suspense fallback={<Loading />}><C /></Suspense></Boundary>;
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<Boundary><Layout /></Boundary>}>
          <Route index element={<Boundary><Dashboard /></Boundary>} />
          <Route path="pos" element={<Boundary><POS /></Boundary>} />
          <Route path="products" element={lazyEl(Products)} />
          <Route path="categories" element={lazyEl(Categories)} />
          <Route path="labels" element={lazyEl(Labels)} />
          <Route path="inventory" element={lazyEl(Inventory)} />
          <Route path="purchases" element={lazyEl(Purchases)} />
          <Route path="suppliers" element={lazyEl(Suppliers)} />
          <Route path="customers" element={lazyEl(Customers)} />
          <Route path="sales" element={lazyEl(Sales)} />
          <Route path="returns" element={lazyEl(Returns)} />
          <Route path="promotions" element={lazyEl(Promotions)} />
          <Route path="expenses" element={lazyEl(Expenses)} />
          <Route path="shifts" element={lazyEl(Shifts)} />
          <Route path="reports" element={lazyEl(Reports)} />
          <Route path="users" element={lazyEl(Users)} />
          <Route path="settings" element={lazyEl(Settings)} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
      <DialogHost />
    </Router>
  );
}
