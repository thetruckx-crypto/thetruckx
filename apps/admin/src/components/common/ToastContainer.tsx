import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast, ToastItem } from '../../context/ToastContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '420px',
        width: 'calc(100vw - 48px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const config = {
    success: {
      borderColor: '#10B981',
      bgColor: '#FFFFFF',
      iconBg: '#ECFDF5',
      iconColor: '#10B981',
      titleColor: '#065F46',
      icon: <CheckCircle2 size={18} color="#10B981" />,
    },
    error: {
      borderColor: '#EF4444',
      bgColor: '#FFFFFF',
      iconBg: '#FEF2F2',
      iconColor: '#EF4444',
      titleColor: '#991B1B',
      icon: <AlertCircle size={18} color="#EF4444" />,
    },
    warning: {
      borderColor: '#F59E0B',
      bgColor: '#FFFFFF',
      iconBg: '#FFFBEB',
      iconColor: '#D97706',
      titleColor: '#92400E',
      icon: <AlertTriangle size={18} color="#D97706" />,
    },
    info: {
      borderColor: '#F05A22',
      bgColor: '#FFFFFF',
      iconBg: '#FFF7ED',
      iconColor: '#F05A22',
      titleColor: '#0A1931',
      icon: <Info size={18} color="#F05A22" />,
    },
  }[toast.type];

  return (
    <div
      style={{
        pointerEvents: 'auto',
        backgroundColor: config.bgColor,
        borderRadius: '12px',
        borderLeft: `5px solid ${config.borderColor}`,
        boxShadow: '0 12px 28px -6px rgba(10, 25, 49, 0.16), 0 4px 12px -2px rgba(10, 25, 49, 0.08)',
        borderTop: '1px solid #F1F5F9',
        borderRight: '1px solid #F1F5F9',
        borderBottom: '1px solid #F1F5F9',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        animation: 'toastSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: config.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {config.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingTop: '1px' }}>
        {toast.title && (
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: config.titleColor,
              marginBottom: '2px',
              letterSpacing: '-0.01em',
            }}
          >
            {toast.title}
          </div>
        )}
        <div
          style={{
            fontSize: '12.5px',
            color: '#334155',
            lineHeight: '1.45',
            wordBreak: 'break-word',
          }}
        >
          {toast.message}
        </div>
      </div>

      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          color: '#94A3B8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          transition: 'color 0.15s ease, background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#1E293B';
          e.currentTarget.style.backgroundColor = '#F1F5F9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#94A3B8';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>

      {/* Auto-dismiss progress line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2.5px',
          backgroundColor: config.borderColor,
          width: '100%',
          opacity: 0.6,
          animation: `toastProgress ${toast.duration || 4000}ms linear forwards`,
        }}
      />
    </div>
  );
};
