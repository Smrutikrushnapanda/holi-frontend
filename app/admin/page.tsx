'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

export default function AdminDashboard() {
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

  useEffect(() => {
    fetchStats();
    fetchTickets();
  }, [fetchStats, fetchTickets]);

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

  const handleReset = async (ticketNumber: string) => {
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
  };

  const filteredTickets = tickets.filter((t) =>
    search ? t.ticket_number.toLowerCase().includes(search.toLowerCase()) : true
  );

  const usagePercent = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
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
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Holi Festival 2026</h1>
              <p className="text-xs text-gray-500">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchTickets(); }}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleExportPDF} disabled={exporting}>
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500 to-red-500 text-white">
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
                  className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Panel */}
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

        {/* Ticket Table */}
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
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Ticket #</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">Status</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Scanned At</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">Scanned By</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">Created</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket, idx) => (
                      <tr
                        key={ticket.id}
                        className={`border-b border-gray-50 hover:bg-orange-50/40 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-gray-900 text-sm">
                              {ticket.ticket_number}
                            </span>
                            <span className="sm:hidden">
                              <StatusBadge status={ticket.status} />
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell text-gray-500">
                          {ticket.scanned_at
                            ? new Date(ticket.scanned_at).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell text-gray-500">
                          {ticket.scanned_by || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell text-gray-400 text-xs">
                          {new Date(ticket.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {ticket.status === 'used' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReset(ticket.ticket_number)}
                              disabled={resetting === ticket.ticket_number}
                              className="text-xs text-gray-500 hover:text-orange-600 h-7"
                            >
                              <RotateCcw className="w-3 h-3" />
                              {resetting === ticket.ticket_number ? '...' : 'Reset'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages} · {total} tickets
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
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
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
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
