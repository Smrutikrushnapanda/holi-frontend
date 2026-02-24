'use client';

import { useEffect, useState, useCallback, useMemo, ChangeEvent } from 'react';
import Image from 'next/image';
import axios from 'axios';
import {
  Ticket,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RotateCcw,
  TrendingUp,
  Lock,
  Eye,
  EyeOff,
  Settings,
  Save,
  LogOut,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { API_BASE } from '@/lib/utils';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

interface TicketRow {
  id: number;
  ticket_number: string;
  event_name: string;
  event_place: string;
  event_date: string;
  event_time: string;
  organizer: string;
  status: 'used' | 'unused';
  scanned_at: string | null;
  scanned_by: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  used: number;
  unused: number;
}

interface TicketsResponse {
  tickets: TicketRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface EventSettings {
  eventName: string;
  eventPlace: string;
  eventDate: string;
  eventTime: string;
  organizer: string;
  leftLogo?: string;
  rightLogo?: string;
}

// ─── Login Screen ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (username === 'admin' && password === 'password') {
      sessionStorage.setItem('holi-admin-auth', 'true');
      onLogin();
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="fixed top-0 left-0 w-72 h-72 bg-orange-300 rounded-full opacity-20 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-pink-300 rounded-full opacity-20 blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-sm relative">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-linear-to-r from-orange-500 via-red-500 to-pink-500 p-6 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Lock className="w-8 h-8 text-orange-500" />
            </div>
            <h1 className="text-xl font-bold text-white font-festive">Admin Dashboard</h1>
            <p className="text-orange-100 text-sm font-festive">Holi Festival 2026</p>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Username</label>
              <Input
                placeholder="admin"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                className="h-11"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <Button
              className="w-full h-11 font-semibold"
              onClick={handleSubmit}
              disabled={!username || !password}
            >
              <Lock className="w-4 h-4" />
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, used: 0, unused: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generateCount, setGenerateCount] = useState(200);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Event settings
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [eventSettings, setEventSettings] = useState<EventSettings>({
    eventName: 'Holi Hei! 2026',
    eventPlace: 'Harapur,Near GD Goenka School,In front of DN Fairytale Appartment, Bhubaneswar, Odisha',
    eventDate: '4th March 2026',
    eventTime: '10:00 AM Onwards',
    organizer: 'KALINGA BEATS',
    leftLogo: '',
    rightLogo: '',
  });

  // Check session on mount
  useEffect(() => {
    const auth = sessionStorage.getItem('holi-admin-auth');
    if (auth === 'true') setIsLoggedIn(true);
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get<Stats>(`${API_BASE}/tickets/stats`);
      setStats(data);
    } catch {
      // silent
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await axios.get<TicketsResponse>(`${API_BASE}/tickets`, { params });
      setTickets(data.tickets);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      showToast('Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  const fetchEventSettings = useCallback(async () => {
    try {
      const { data } = await axios.get<EventSettings>(`${API_BASE}/tickets/event-settings`);
      setEventSettings(data);
    } catch {
      // silent — use defaults
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchStats();
    fetchTickets();
    fetchEventSettings();
  }, [isLoggedIn, fetchStats, fetchTickets, fetchEventSettings]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await axios.post(`${API_BASE}/tickets/generate`, { count: generateCount });
      showToast(`Generated ${data.generated} new tickets!`);
      fetchStats();
      fetchTickets();
    } catch {
      showToast('Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${API_BASE}/tickets/export/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'holi-tickets-2026.pdf';
      link.click();
      window.URL.revokeObjectURL(url);
      showToast('PDF exported successfully!');
    } catch {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleReset = useCallback(async (ticketNumber: string) => {
    setResetting(ticketNumber);
    try {
      await axios.post(`${API_BASE}/tickets/${ticketNumber}/reset`);
      showToast(`${ticketNumber} reset to unused`);
      fetchStats();
      fetchTickets();
    } catch {
      showToast('Reset failed', 'error');
    } finally {
      setResetting(null);
    }
  }, [fetchStats, fetchTickets]);

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>, key: 'leftLogo' | 'rightLogo') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setEventSettings((prev) => ({ ...prev, [key]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.patch(`${API_BASE}/tickets/event-settings`, eventSettings);
      showToast('Event settings updated for all tickets!');
      setShowSettings(false);
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('holi-admin-auth');
    setIsLoggedIn(false);
  };

  const filteredTickets = tickets.filter((t) =>
    search ? t.ticket_number.toLowerCase().includes(search.toLowerCase()) : true
  );

  const usagePercent = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;

  const columns = useMemo<ColumnDef<TicketRow>[]>(
    () => [
      {
        accessorKey: 'ticket_number',
        header: 'Ticket #',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-gray-900 text-sm">{row.original.ticket_number}</span>
            <span className="sm:hidden">
              <StatusBadge status={row.original.status} />
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        enableSorting: true,
      },
      {
        accessorKey: 'scanned_at',
        header: 'Scanned At',
        cell: ({ row }) =>
          row.original.scanned_at ? (
            <span className="text-gray-600">
              {new Date(row.original.scanned_at).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          ),
      },
      {
        accessorKey: 'scanned_by',
        header: 'Scanned By',
        cell: ({ row }) => <span className="text-gray-600">{row.original.scanned_by || '—'}</span>,
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-xs text-gray-500">
            {new Date(row.original.created_at).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) =>
          row.original.status === 'used' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleReset(row.original.ticket_number)}
              disabled={resetting === row.original.ticket_number}
              className="text-xs text-gray-500 hover:text-orange-600 h-7"
            >
              <RotateCcw className="w-3 h-3" />
              {resetting === row.original.ticket_number ? '...' : 'Reset'}
            </Button>
          ) : null,
        enableSorting: false,
      },
    ],
    [handleReset, resetting]
  );

  const table = useReactTable({
    data: filteredTickets,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 to-red-50">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.type === 'success' ? '✓ ' : '✕ '}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-orange-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-festive">Holi Festival 2026</h1>
              <p className="text-xs text-gray-500">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Event Settings</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchTickets(); }}>
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" onClick={handleExportPDF} disabled={exporting}>
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Event Settings Panel ────────────────────── */}
        {showSettings && (
          <Card className="border-0 shadow-md border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-orange-500" />
                Edit Event Details
                <span className="text-xs font-normal text-gray-400 ml-1">
                  (updates all tickets)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Event Name</label>
                <Input
                  value={eventSettings.eventName}
                    onChange={(e) => setEventSettings({ ...eventSettings, eventName: e.target.value })}
                    placeholder="Holi Hei! 2026"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Organizer</label>
                  <Input
                    value={eventSettings.organizer}
                    onChange={(e) => setEventSettings({ ...eventSettings, organizer: e.target.value })}
                    placeholder="KALINGA BEATS"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Event Date</label>
                  <Input
                    value={eventSettings.eventDate}
                    onChange={(e) => setEventSettings({ ...eventSettings, eventDate: e.target.value })}
                    placeholder="4th March 2026"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Event Time</label>
                  <Input
                    value={eventSettings.eventTime}
                    onChange={(e) => setEventSettings({ ...eventSettings, eventTime: e.target.value })}
                    placeholder="10:00 AM Onwards"
                  />
                </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-gray-600">Venue</label>
                <Input
                  value={eventSettings.eventPlace}
                  onChange={(e) => setEventSettings({ ...eventSettings, eventPlace: e.target.value })}
                  placeholder="Harapur,Near GD Goenka School,In front of DN Fairytale Appartment, Bhubaneswar, Odisha"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Left Logo (PNG/JPG)</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => handleLogoUpload(e, 'leftLogo')}
                    className="file:mr-2 file:px-3 file:py-2 file:rounded-lg file:border file:border-orange-200 file:bg-orange-50 file:text-orange-700"
                  />
                  {eventSettings.leftLogo && (
                    <Image
                      src={eventSettings.leftLogo}
                      alt="Left logo"
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-md object-contain border"
                    />
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Right Logo (PNG/JPG)</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => handleLogoUpload(e, 'rightLogo')}
                    className="file:mr-2 file:px-3 file:py-2 file:rounded-lg file:border file:border-orange-200 file:bg-orange-50 file:text-orange-700"
                  />
                  {eventSettings.rightLogo && (
                    <Image
                      src={eventSettings.rightLogo}
                      alt="Right logo"
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-md object-contain border"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                <Save className="w-4 h-4" />
                {savingSettings ? 'Saving...' : 'Save & Apply to All Tickets'}
                </Button>
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Stats Cards ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md bg-linear-to-br from-orange-500 to-red-500 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Total Tickets</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <Ticket className="w-10 h-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Used</p>
                  <p className="text-3xl font-bold text-red-600">{stats.used}</p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-red-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Available</p>
                  <p className="text-3xl font-bold text-green-600">{stats.unused}</p>
                </div>
                <XCircle className="w-10 h-10 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Entry Rate</p>
                  <p className="text-3xl font-bold text-orange-600">{usagePercent}%</p>
                </div>
                <TrendingUp className="w-10 h-10 text-orange-200" />
              </div>
              <div className="mt-3 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-linear-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Generate Tickets ─────────────────────────── */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-2">
              <Plus className="w-4 h-4 text-orange-500" />
              Generate More Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-sm text-gray-600 whitespace-nowrap">Count:</label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={generateCount}
                  onChange={(e) => setGenerateCount(parseInt(e.target.value) || 200)}
                  className="w-28"
                />
              </div>
              <Button onClick={handleGenerate} disabled={generating} className="sm:w-auto">
                <Plus className="w-4 h-4" />
                {generating ? 'Generating...' : `Generate ${generateCount} Tickets`}
              </Button>
              <Button variant="outline" onClick={handleExportPDF} disabled={exporting} className="sm:w-auto">
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Export All as PDF'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Ticket Table ─────────────────────────────── */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-2">
                <Filter className="w-4 h-4 text-orange-500" />
                Tickets ({total})
              </CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search HOLI-001..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="unused">Available</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-500 text-sm">Loading tickets...</p>
                </div>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Ticket className="w-12 h-12 text-gray-300" />
                <p className="text-gray-400">No tickets found</p>
                <Button onClick={handleGenerate} variant="outline" size="sm">
                  Generate tickets now
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          const canSort = header.column.getCanSort();
                          const responsiveClass =
                            header.column.id === 'status'
                              ? 'hidden sm:table-cell'
                              : header.column.id === 'scanned_at'
                              ? 'hidden md:table-cell'
                              : header.column.id === 'scanned_by' || header.column.id === 'created_at'
                              ? 'hidden lg:table-cell'
                              : '';
                          const sortDir = header.column.getIsSorted() as string | false;
                          return (
                            <th
                              key={header.id}
                              className={`px-5 py-3 font-semibold text-gray-600 text-left select-none ${responsiveClass} ${
                                canSort ? 'cursor-pointer' : ''
                              }`}
                              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                            >
                              <div className="flex items-center gap-2">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : ''}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`border-b border-gray-50 hover:bg-orange-50/40 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const responsiveClass =
                            cell.column.id === 'status'
                              ? 'hidden sm:table-cell'
                              : cell.column.id === 'scanned_at'
                              ? 'hidden md:table-cell'
                              : cell.column.id === 'scanned_by' || cell.column.id === 'created_at'
                              ? 'hidden lg:table-cell'
                              : '';
                          return (
                            <td key={cell.id} className={`px-5 py-3.5 ${responsiveClass}`}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages} · {total} tickets
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent Activity ──────────────────────────── */}
        {stats.used > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                Recently Scanned
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Ticket</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Scanned At</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets
                      .filter((t) => t.status === 'used' && t.scanned_at)
                      .sort((a, b) => new Date(b.scanned_at!).getTime() - new Date(a.scanned_at!).getTime())
                      .slice(0, 10)
                      .map((ticket) => (
                        <tr key={ticket.id} className="border-b border-gray-50 hover:bg-orange-50/30">
                          <td className="px-5 py-3 font-mono font-bold text-orange-600">
                            {ticket.ticket_number}
                          </td>
                          <td className="px-5 py-3 text-gray-600">
                            {new Date(ticket.scanned_at!).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', hour: '2-digit',
                              minute: '2-digit', second: '2-digit',
                            })}
                          </td>
                          <td className="px-5 py-3 text-gray-500">{ticket.scanned_by}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: 'used' | 'unused' }) {
  if (status === 'used') {
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <CheckCircle2 className="w-3 h-3" />
        Used
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1 text-xs">
      <XCircle className="w-3 h-3" />
      Available
    </Badge>
  );
}
