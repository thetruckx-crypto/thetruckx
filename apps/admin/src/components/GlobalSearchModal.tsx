import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  X,
  Truck,
  FileText,
  Users,
  User,
  Building,
  ArrowRight,
  Plus,
  Clock,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../utils/supabase';

export interface SearchEntity {
  id: string;
  category: 'vehicle' | 'booking' | 'driver' | 'client' | 'vendor' | 'document';
  title: string;
  subtitle: string;
  tag: string;
  details?: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: string) => void;
  onSelectEntity: (entity: SearchEntity) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
  onSelectEntity,
}) => {
  const [query, setQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [dbEntities, setDbEntities] = useState<SearchEntity[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch real database records across tables when modal opens
  const fetchSearchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: clients },
        { data: vendors },
        { data: vehicles },
        { data: drivers },
        { data: reqs },
        { data: boks },
        { data: docs }
      ] = await Promise.all([
        supabase.from('client_companies').select('*'),
        supabase.from('vendor_companies').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('requirements').select('*, client_companies(company_name)'),
        supabase.from('bookings').select('*, client_companies(company_name)'),
        supabase.from('documents').select('*').limit(10),
      ]);

      const entities: SearchEntity[] = [];

      // 1. Clients
      (clients || []).forEach(c => {
        entities.push({
          id: `cli-${c.id}`,
          category: 'client',
          title: c.company_name,
          subtitle: `Client | City: ${c.city || 'N/A'} | GST: ${c.gstin || 'Unspecified'}`,
          tag: 'Client',
          details: `Status: ${c.status} | PAN: ${c.pan || 'N/A'}`
        });
      });

      // 2. Vendors
      (vendors || []).forEach(v => {
        entities.push({
          id: `ven-${v.id}`,
          category: 'vendor',
          title: v.vendor_name,
          subtitle: `Vendor | Base: ${v.address || 'N/A'}`,
          tag: 'Vendor',
          details: `GST: ${v.gstin || 'N/A'} | Status: ${v.status}`
        });
      });

      // 3. Vehicles
      (vehicles || []).forEach(veh => {
        entities.push({
          id: `veh-${veh.id}`,
          category: 'vehicle',
          title: veh.registration_number,
          subtitle: `Vehicle | ${veh.vehicle_type || 'Commercial Carrier'}`,
          tag: 'Vehicle',
          details: `RC: ${veh.rc_number || 'N/A'} | Capacity: ${veh.rated_capacity_mt || 0} MT | Status: ${veh.status}`
        });
      });

      // 4. Drivers
      (drivers || []).forEach(d => {
        entities.push({
          id: `drv-${d.id}`,
          category: 'driver',
          title: d.full_name,
          subtitle: `Driver | License: ${d.licence_number || 'N/A'}`,
          tag: 'Driver',
          details: `Mobile: ${d.mobile || 'N/A'} | Expiry: ${d.licence_expiry_date || 'N/A'}`
        });
      });

      // 5. Requirements (Bookings Category)
      (reqs || []).forEach(r => {
        const clientName = (r as any).client_companies?.company_name || 'Client';
        entities.push({
          id: `req-${r.id}`,
          category: 'booking',
          title: r.id,
          subtitle: `Requirement | ${r.pickup_address || 'Origin'} → ${r.destination_address || 'Destination'}`,
          tag: 'Requirement',
          details: `Client: ${clientName} | Vehicle: ${r.vehicle_type || 'Standard'} | Status: ${r.status}`
        });
      });

      // 6. Bookings
      (boks || []).forEach(b => {
        const clientName = (b as any).client_companies?.company_name || 'Client';
        entities.push({
          id: `bok-${b.id}`,
          category: 'booking',
          title: b.id,
          subtitle: `Booking | Client: ${clientName}`,
          tag: 'Booking',
          details: `Status: ${b.booking_status} | Payment: ${b.payment_status}`
        });
      });

      // 7. Documents
      (docs || []).forEach(doc => {
        entities.push({
          id: `doc-${doc.id}`,
          category: 'document',
          title: doc.document_type || doc.name || 'Document',
          subtitle: `Document | File: ${doc.file_name || doc.id}`,
          tag: 'Document',
          details: `Uploaded: ${doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Recent'}`
        });
      });

      setDbEntities(entities);
    } catch (err) {
      console.error('Failed to load global search database entities:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSearchEntities();
      setSelectedIndex(0);
    }
  }, [isOpen, fetchSearchEntities]);

  // Dynamic real-time search filtering across real database records
  const filteredResults = useMemo(() => {
    let list = dbEntities;

    // Filter by Category
    if (activeCategory !== 'all') {
      list = list.filter(item => item.category === activeCategory);
    }

    // Filter by Search Query
    const q = query.trim().toLowerCase();
    if (!q) {
      return list;
    }

    return list.filter(item => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSub = item.subtitle.toLowerCase().includes(q);
      const matchTag = item.tag.toLowerCase().includes(q);
      const matchDetails = item.details ? item.details.toLowerCase().includes(q) : false;
      return matchTitle || matchSub || matchTag || matchDetails;
    });
  }, [dbEntities, query, activeCategory]);

  // Dynamic counts calculated directly from real database records
  const categoryCounts = useMemo(() => {
    return {
      all: dbEntities.length,
      booking: dbEntities.filter(e => e.category === 'booking').length,
      client: dbEntities.filter(e => e.category === 'client').length,
      vendor: dbEntities.filter(e => e.category === 'vendor').length,
      vehicle: dbEntities.filter(e => e.category === 'vehicle').length,
      driver: dbEntities.filter(e => e.category === 'driver').length,
      document: dbEntities.filter(e => e.category === 'document').length,
    };
  }, [dbEntities]);

  const handleClearRecent = () => {
    setRecentSearches([]);
  };

  const handleRemoveRecentItem = (indexToRemove: number) => {
    setRecentSearches(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleSelectRecent = (searchTerm: string) => {
    setQuery(searchTerm);
    setSelectedIndex(0);
  };

  const handleEntityClick = (entity: SearchEntity) => {
    if (query.trim() && !recentSearches.includes(query.trim())) {
      setRecentSearches(prev => [query.trim(), ...prev.slice(0, 4)]);
    }
    onSelectEntity(entity);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredResults.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredResults.length - 1));
      } else if (e.key === 'Enter' && filteredResults[selectedIndex]) {
        e.preventDefault();
        handleEntityClick(filteredResults[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredResults, selectedIndex, onClose, handleEntityClick]);

  if (!isOpen) return null;

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div className="search-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Search Header */}
        <div className="search-modal-header">
          <div className="search-title-row">
            <div className="search-title-left">
              <Search size={22} className="search-modal-icon" />
              <div>
                <h3 className="search-modal-title">Global Search</h3>
                <p className="search-modal-subtitle">
                  Live synchronized search across clients, vendors, bookings, trucks, drivers, and requirements in database.
                </p>
              </div>
            </div>
            <div className="search-title-right">
              <button
                className="topbar-icon-btn"
                title="Refresh database records"
                onClick={fetchSearchEntities}
                style={{ width: '28px', height: '28px', marginRight: '6px' }}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
              </button>
              <span className="ctrl-k-badge">Ctrl + K</span>
              <button className="search-close-btn" onClick={onClose} title="Close search">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Search Input Box */}
          <div className="search-input-field-wrap">
            <Search size={18} className="search-input-icon" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search by ID, Vehicle, Client, Driver, Route, Document..."
              className="search-main-input"
            />
            {query && (
              <button
                className="search-clear-query-btn"
                onClick={() => {
                  setQuery('');
                  setSelectedIndex(0);
                }}
                title="Clear input"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Category Tabs with Real Database Counts */}
          <div className="search-category-tabs">
            <button
              className={`search-cat-tab ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory('all');
                setSelectedIndex(0);
              }}
            >
              All <span className="cat-count">{categoryCounts.all}</span>
            </button>
            <button
              className={`search-cat-tab ${activeCategory === 'booking' ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory('booking');
                setSelectedIndex(0);
              }}
            >
              <FileText size={14} /> Bookings & Reqs <span className="cat-count">{categoryCounts.booking}</span>
            </button>
            <button
              className={`search-cat-tab ${activeCategory === 'client' ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory('client');
                setSelectedIndex(0);
              }}
            >
              <Building size={14} /> Clients <span className="cat-count">{categoryCounts.client}</span>
            </button>
            <button
              className={`search-cat-tab ${activeCategory === 'vendor' ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory('vendor');
                setSelectedIndex(0);
              }}
            >
              <Users size={14} /> Vendors <span className="cat-count">{categoryCounts.vendor}</span>
            </button>
            <button
              className={`search-cat-tab ${activeCategory === 'vehicle' ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory('vehicle');
                setSelectedIndex(0);
              }}
            >
              <Truck size={14} /> Vehicles <span className="cat-count">{categoryCounts.vehicle}</span>
            </button>
            <button
              className={`search-cat-tab ${activeCategory === 'driver' ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory('driver');
                setSelectedIndex(0);
              }}
            >
              <User size={14} /> Drivers <span className="cat-count">{categoryCounts.driver}</span>
            </button>
          </div>
        </div>

        {/* Modal Split Body */}
        <div className="search-modal-body-split">
          {/* LEFT: Top Results List (100% Real Database Rows) */}
          <div className="search-results-pane">
            <div className="pane-section-header">
              <span>Database Results ({filteredResults.length})</span>
              {loading && <span style={{ fontSize: '11px', color: '#FF6B35' }}>Fetching live...</span>}
            </div>

            <div className="search-results-list">
              {filteredResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                  <Search size={32} style={{ margin: '0 auto 10px', color: '#CBD5E1' }} />
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#64748B' }}>
                    {query ? `No matching database records found for "${query}"` : 'No database records in this category.'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                    Try searching by another keyword or reset the category filter.
                  </p>
                </div>
              ) : (
                filteredResults.map((item, index) => (
                  <div
                    key={item.id}
                    className={`search-result-item ${selectedIndex === index ? 'selected' : ''}`}
                    onClick={() => handleEntityClick(item)}
                  >
                    <div className={`result-icon-badge ${item.category}`}>
                      {item.category === 'vehicle' && <Truck size={18} />}
                      {item.category === 'booking' && <Clock size={18} />}
                      {item.category === 'driver' && <User size={18} />}
                      {item.category === 'client' && <Building size={18} />}
                      {item.category === 'vendor' && <Users size={18} />}
                      {item.category === 'document' && <FileText size={18} />}
                    </div>

                    <div className="result-text-group">
                      <div className="result-title">{item.title}</div>
                      <div className="result-subtitle">{item.subtitle}</div>
                      {item.details && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{item.details}</div>}
                    </div>

                    <div className="result-action-group">
                      <span className={`result-tag-pill ${item.category}`}>{item.tag}</span>
                      <ArrowRight size={16} className="result-arrow" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: Recent Searches & Quick Actions */}
          <div className="search-sidebar-pane">
            {/* Recent Searches */}
            <div className="recent-searches-box">
              <div className="sidebar-section-header">
                <span>Recent Searches</span>
                {recentSearches.length > 0 && (
                  <button className="btn-clear-recent" onClick={handleClearRecent}>
                    Clear All
                  </button>
                )}
              </div>

              <div className="recent-search-chips">
                {recentSearches.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94A3B8', padding: '8px 0' }}>
                    No recent searches.
                  </div>
                ) : (
                  recentSearches.map((item, idx) => (
                    <div
                      key={idx}
                      className="recent-search-row"
                      onClick={() => handleSelectRecent(item)}
                    >
                      <Clock size={14} className="recent-icon" />
                      <span className="recent-text">{item}</span>
                      <button
                        className="recent-remove-btn"
                        title="Remove search"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveRecentItem(idx);
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions-box">
              <div className="sidebar-section-header">
                <span>Quick Actions</span>
              </div>

              <div className="quick-action-items">
                <button
                  className="quick-action-btn"
                  onClick={() => onSelectAction('create_booking')}
                >
                  <div className="quick-action-icon gold">
                    <Plus size={14} strokeWidth={2.5} />
                  </div>
                  <span>Create New Booking</span>
                  <ArrowRight size={14} className="quick-action-arrow" />
                </button>

                <button
                  className="quick-action-btn"
                  onClick={() => onSelectAction('add_client')}
                >
                  <div className="quick-action-icon green">
                    <Building size={14} />
                  </div>
                  <span>Add Client Account</span>
                  <ArrowRight size={14} className="quick-action-arrow" />
                </button>

                <button
                  className="quick-action-btn"
                  onClick={() => onSelectAction('add_vendor')}
                >
                  <div className="quick-action-icon amber">
                    <Users size={14} />
                  </div>
                  <span>Add Vendor Account</span>
                  <ArrowRight size={14} className="quick-action-arrow" />
                </button>

                <button
                  className="quick-action-btn"
                  onClick={() => onSelectAction('add_vehicle')}
                >
                  <div className="quick-action-icon blue">
                    <Truck size={14} />
                  </div>
                  <span>Add Fleet Vehicle</span>
                  <ArrowRight size={14} className="quick-action-arrow" />
                </button>

                <button
                  className="quick-action-btn"
                  onClick={() => onSelectAction('add_driver')}
                >
                  <div className="quick-action-icon navy">
                    <User size={14} />
                  </div>
                  <span>Add Driver Record</span>
                  <ArrowRight size={14} className="quick-action-arrow" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Keyboard Guide */}
        <div className="search-modal-footer">
          <div className="footer-keys-row">
            <span className="key-item">
              <kbd className="key-badge">↑</kbd> <kbd className="key-badge">↓</kbd> Navigate
            </span>
            <span className="key-item">
              <kbd className="key-badge">Enter</kbd> Select
            </span>
            <span className="key-item">
              <kbd className="key-badge">Esc</kbd> Close
            </span>
          </div>
          <div className="footer-stats-note">
            <span>{filteredResults.length} database entities indexed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

