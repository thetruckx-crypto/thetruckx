import React from 'react';

interface SkeletonTextProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  width = '100%',
  height = '14px',
  borderRadius = '6px',
  style,
  className = '',
}) => {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        display: 'inline-block',
        ...style,
      }}
    />
  );
};

interface SkeletonCardProps {
  style?: React.CSSProperties;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ style }) => {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonText width="40%" height="13px" />
        <SkeletonText width="36px" height="36px" borderRadius="8px" />
      </div>
      <SkeletonText width="65%" height="28px" borderRadius="6px" />
      <SkeletonText width="50%" height="12px" />
    </div>
  );
};

interface SkeletonTableRowProps {
  columns?: number;
}

export const SkeletonTableRow: React.FC<SkeletonTableRowProps> = ({ columns = 5 }) => {
  return (
    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '16px 18px' }}>
          <SkeletonText
            width={i === 0 ? '70%' : i === 1 ? '85%' : '60%'}
            height="14px"
          />
        </td>
      ))}
    </tr>
  );
};

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  style?: React.CSSProperties;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 5,
  style,
}) => {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        ...style,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} style={{ padding: '14px 18px', textAlign: 'left' }}>
                <SkeletonText width="60%" height="12px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
