import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface HierarchyBreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  onHomeClick?: () => void;
}

export const HierarchyBreadcrumbs: React.FC<HierarchyBreadcrumbsProps> = ({
  items,
  showHome = true,
  onHomeClick
}) => {
  if (items.length === 0 && !showHome) return null;

  return (
    <nav className="flex items-center gap-2 text-sm">
      {/* Home Button */}
      {showHome && onHomeClick && (
        <>
          <button
            onClick={onHomeClick}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Voltar ao início"
          >
            <Home className="w-4 h-4" />
            <span className="font-medium">Início</span>
          </button>
          {items.length > 0 && (
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          )}
        </>
      )}

      {/* Breadcrumb Items */}
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            {item.onClick ? (
              <button
                onClick={item.onClick}
                className="px-2 py-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors font-medium truncate max-w-[200px]"
                title={item.label}
              >
                {item.label}
              </button>
            ) : (
              <span
                className={`px-2 py-1 rounded-md truncate max-w-[200px] ${
                  isLast
                    ? 'text-gray-900 font-semibold bg-gray-100'
                    : 'text-gray-600'
                }`}
                title={item.label}
              >
                {item.label}
              </span>
            )}

            {!isLast && (
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
