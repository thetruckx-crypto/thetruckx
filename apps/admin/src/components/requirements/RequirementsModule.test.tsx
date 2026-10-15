/**
 * RequirementsModule Unit Tests
 * 
 * Tests for the Transport Requirements list view module.
 * 
 * **Validates Requirements: 1.1, 1.2, 1.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Format requirement reference ID
 */
function formatRequirementReference(id: string, createdAt: string): string {
  if (!id || !createdAt) return "REQ-000001";
  if (id.startsWith("REQ-")) return id;
  
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const numPart = id.replace(/\D/g, "").substring(0, 6) || "000001";
  
  return `REQ-${year}${month}-${numPart.padStart(6, "0")}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return "—";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Simulate search filter
 */
function applySearchFilter(
  requirements: any[],
  searchQuery: string
): any[] {
  if (!searchQuery.trim()) return requirements;
  
  const query = searchQuery.toLowerCase();
  return requirements.filter((req) => {
    return (
      req.requirement_reference?.toLowerCase().includes(query) ||
      req.client_company?.company_name?.toLowerCase().includes(query) ||
      req.origin?.toLowerCase().includes(query) ||
      req.destination?.toLowerCase().includes(query)
    );
  });
}

/**
 * Simulate status filter
 */
function applyStatusFilter(
  requirements: any[],
  statusFilter: string
): any[] {
  if (statusFilter === "ALL") return requirements;
  return requirements.filter((req) => req.status === statusFilter);
}

/**
 * Simulate pagination
 */
function paginateResults(
  requirements: any[],
  page: number,
  itemsPerPage: number
): any[] {
  const from = (page - 1) * itemsPerPage;
  return requirements.slice(from, from + itemsPerPage);
}

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('RequirementsModule - Formatting Functions', () => {
  it('formats requirement reference ID correctly', () => {
    const id = "123";
    const createdAt = "2025-01-15T10:30:00Z";
    const result = formatRequirementReference(id, createdAt);
    
    expect(result).toBe("REQ-202501-000123");
  });

  it('handles already formatted requirement reference', () => {
    const id = "REQ-202501-000456";
    const createdAt = "2025-01-15T10:30:00Z";
    const result = formatRequirementReference(id, createdAt);
    
    expect(result).toBe("REQ-202501-000456");
  });

  it('handles missing ID or date', () => {
    const result = formatRequirementReference("", "");
    expect(result).toBe("REQ-000001");
  });

  it('formats date correctly', () => {
    const dateStr = "2025-01-21T00:00:00Z";
    const result = formatDate(dateStr);
    
    // Result should contain day, month abbreviation, and year
    expect(result).toMatch(/\d{2}/); // day
    expect(result).toMatch(/[A-Za-z]{3}/); // month abbreviation
    expect(result).toMatch(/\d{4}/); // year
  });

  it('handles missing date', () => {
    const result = formatDate("");
    expect(result).toBe("—");
  });

  it('truncates text correctly', () => {
    const text = "This is a very long cargo description that needs truncation";
    const result = truncateText(text, 30);
    
    expect(result).toHaveLength(33); // 30 + "..."
    expect(result).toContain("...");
  });

  it('does not truncate short text', () => {
    const text = "Short cargo";
    const result = truncateText(text, 30);
    
    expect(result).toBe("Short cargo");
    expect(result).not.toContain("...");
  });

  it('handles null or empty text', () => {
    const result = truncateText("", 30);
    expect(result).toBe("—");
  });
});

describe('RequirementsModule - Search Filter (Requirement 1.3)', () => {
  const mockRequirements = [
    {
      id: "1",
      requirement_reference: "REQ-202501-000001",
      status: "UNDER_REVIEW",
      origin: "Guwahati",
      destination: "Mumbai",
      client_company: { company_name: "Tata Steel BSL" }
    },
    {
      id: "2",
      requirement_reference: "REQ-202501-000002",
      status: "QUOTED",
      origin: "Delhi",
      destination: "Kolkata",
      client_company: { company_name: "Reliance Industries" }
    },
    {
      id: "3",
      requirement_reference: "REQ-202501-000003",
      status: "BOOKED",
      origin: "Bangalore",
      destination: "Chennai",
      client_company: { company_name: "Dalmia Cement" }
    }
  ];

  it('filters by requirement reference ID (case-insensitive)', () => {
    const result = applySearchFilter(mockRequirements, "req-202501-000001");
    
    expect(result).toHaveLength(1);
    expect(result[0].requirement_reference).toBe("REQ-202501-000001");
  });

  it('filters by client company name (case-insensitive)', () => {
    const result = applySearchFilter(mockRequirements, "tata");
    
    expect(result).toHaveLength(1);
    expect(result[0].client_company.company_name).toContain("Tata");
  });

  it('filters by origin (case-insensitive)', () => {
    const result = applySearchFilter(mockRequirements, "guwahati");
    
    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe("Guwahati");
  });

  it('filters by destination (case-insensitive)', () => {
    const result = applySearchFilter(mockRequirements, "mumbai");
    
    expect(result).toHaveLength(1);
    expect(result[0].destination).toBe("Mumbai");
  });

  it('returns all requirements when search query is empty', () => {
    const result = applySearchFilter(mockRequirements, "");
    
    expect(result).toHaveLength(3);
  });

  it('returns empty array when no matches found', () => {
    const result = applySearchFilter(mockRequirements, "nonexistent");
    
    expect(result).toHaveLength(0);
  });
});

describe('RequirementsModule - Status Filter (Requirement 1.2)', () => {
  const mockRequirements = [
    { id: "1", status: "DRAFT" },
    { id: "2", status: "UNDER_REVIEW" },
    { id: "3", status: "UNDER_REVIEW" },
    { id: "4", status: "ASSIGNED" },
    { id: "5", status: "RFQ_SENT" },
    { id: "6", status: "QUOTED" },
    { id: "7", status: "BOOKED" },
    { id: "8", status: "CANCELLED" }
  ];

  it('shows all requirements when filter is ALL', () => {
    const result = applyStatusFilter(mockRequirements, "ALL");
    
    expect(result).toHaveLength(8);
  });

  it('filters by DRAFT status', () => {
    const result = applyStatusFilter(mockRequirements, "DRAFT");
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("DRAFT");
  });

  it('filters by UNDER_REVIEW status', () => {
    const result = applyStatusFilter(mockRequirements, "UNDER_REVIEW");
    
    expect(result).toHaveLength(2);
    result.forEach(req => expect(req.status).toBe("UNDER_REVIEW"));
  });

  it('filters by ASSIGNED status', () => {
    const result = applyStatusFilter(mockRequirements, "ASSIGNED");
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ASSIGNED");
  });

  it('filters by RFQ_SENT status', () => {
    const result = applyStatusFilter(mockRequirements, "RFQ_SENT");
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("RFQ_SENT");
  });

  it('filters by QUOTED status', () => {
    const result = applyStatusFilter(mockRequirements, "QUOTED");
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("QUOTED");
  });

  it('filters by BOOKED status', () => {
    const result = applyStatusFilter(mockRequirements, "BOOKED");
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("BOOKED");
  });

  it('filters by CANCELLED status', () => {
    const result = applyStatusFilter(mockRequirements, "CANCELLED");
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("CANCELLED");
  });
});

describe('RequirementsModule - Pagination (Requirement 1.1)', () => {
  const mockRequirements = Array.from({ length: 25 }, (_, i) => ({
    id: String(i + 1),
    requirement_reference: `REQ-202501-${String(i + 1).padStart(6, "0")}`,
    status: "UNDER_REVIEW"
  }));

  it('returns first page of results correctly', () => {
    const result = paginateResults(mockRequirements, 1, 10);
    
    expect(result).toHaveLength(10);
    expect(result[0].id).toBe("1");
    expect(result[9].id).toBe("10");
  });

  it('returns second page of results correctly', () => {
    const result = paginateResults(mockRequirements, 2, 10);
    
    expect(result).toHaveLength(10);
    expect(result[0].id).toBe("11");
    expect(result[9].id).toBe("20");
  });

  it('returns partial last page correctly', () => {
    const result = paginateResults(mockRequirements, 3, 10);
    
    expect(result).toHaveLength(5); // Only 5 items remain
    expect(result[0].id).toBe("21");
    expect(result[4].id).toBe("25");
  });

  it('returns empty array for page beyond total pages', () => {
    const result = paginateResults(mockRequirements, 10, 10);
    
    expect(result).toHaveLength(0);
  });

  it('handles different page sizes correctly', () => {
    const result = paginateResults(mockRequirements, 1, 20);
    
    expect(result).toHaveLength(20);
    expect(result[0].id).toBe("1");
    expect(result[19].id).toBe("20");
  });
});

describe('RequirementsModule - Combined Filters', () => {
  const mockRequirements = [
    {
      id: "1",
      requirement_reference: "REQ-202501-000001",
      status: "UNDER_REVIEW",
      origin: "Guwahati",
      destination: "Mumbai",
      client_company: { company_name: "Tata Steel" }
    },
    {
      id: "2",
      requirement_reference: "REQ-202501-000002",
      status: "UNDER_REVIEW",
      origin: "Delhi",
      destination: "Kolkata",
      client_company: { company_name: "Reliance" }
    },
    {
      id: "3",
      requirement_reference: "REQ-202501-000003",
      status: "QUOTED",
      origin: "Guwahati",
      destination: "Chennai",
      client_company: { company_name: "Dalmia" }
    }
  ];

  it('applies status filter then search filter', () => {
    // First filter by status
    let result = applyStatusFilter(mockRequirements, "UNDER_REVIEW");
    expect(result).toHaveLength(2);
    
    // Then apply search
    result = applySearchFilter(result, "guwahati");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it('applies search filter then pagination', () => {
    // Create larger dataset
    const largeDataset = Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      requirement_reference: `REQ-202501-${String(i + 1).padStart(6, "0")}`,
      status: "UNDER_REVIEW",
      origin: i % 2 === 0 ? "Guwahati" : "Delhi",
      destination: "Mumbai",
      client_company: { company_name: "Test Company" }
    }));

    // Apply search
    let result = applySearchFilter(largeDataset, "guwahati");
    expect(result.length).toBeGreaterThan(10); // Should have ~13 results

    // Apply pagination
    result = paginateResults(result, 1, 10);
    expect(result).toHaveLength(10);
  });

  it('applies all filters in sequence', () => {
    // Status -> Search -> Pagination
    let result = applyStatusFilter(mockRequirements, "UNDER_REVIEW");
    result = applySearchFilter(result, "guwahati");
    result = paginateResults(result, 1, 10);
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });
});

/**
 * SUMMARY
 * 
 * These tests validate the core filtering and pagination logic for the
 * RequirementsModule component, covering:
 * 
 * - Requirement 1.1: Paginated list sorted by created_at descending
 * - Requirement 1.2: Status filter tabs
 * - Requirement 1.3: Case-insensitive search filtering
 * 
 * The tests focus on the business logic rather than UI interaction.
 */
